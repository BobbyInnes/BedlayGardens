/**
 * Setup project: discovers every page on the site once, before the
 * "scaffold" project's tests run (wired up via that project's
 * `dependencies: ["scaffold-setup"]` in playwright.config.ts — Playwright's
 * globalSetup can't be scoped to one project, so this runs as a real test
 * in its own project instead).
 * Prefers sitemap.xml; falls back to a same-origin breadth-first crawl.
 * Result is written to test-results/urls.json and read by the spec files.
 */
import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const MAX_PAGES = Number(process.env.MAX_PAGES || 40);
const MAX_DEPTH = Number(process.env.MAX_DEPTH || 3);
const OUT = path.join(process.cwd(), 'test-results', 'urls.json');

// Paths you never want crawled (auth-walled, destructive, infinite, etc.)
const EXCLUDE = [
  /^\/api\//,
  /^\/admin(\/|$)/,
  /\/logout$/,
  /\/sign-?out$/,
  /^\/_next\//,
];

const isExcluded = (pathname: string) => EXCLUDE.some((re) => re.test(pathname));

async function fromSitemap(): Promise<string[]> {
  const candidates = [`${BASE_URL}/sitemap.xml`, `${BASE_URL}/sitemap-0.xml`];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const xml = await res.text();
      const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
      const same = locs.filter((u) => {
        try {
          const parsed = new URL(u);
          return parsed.origin === new URL(BASE_URL).origin && !isExcluded(parsed.pathname);
        } catch {
          return false;
        }
      });
      if (same.length) return same.slice(0, MAX_PAGES);
    } catch {
      /* try next */
    }
  }
  return [];
}

async function crawl(): Promise<string[]> {
  const origin = new URL(BASE_URL).origin;
  const seen = new Set<string>([BASE_URL + '/']);
  const found: string[] = [];
  let frontier: { url: string; depth: number }[] = [{ url: BASE_URL + '/', depth: 0 }];

  while (frontier.length && found.length < MAX_PAGES) {
    const next: typeof frontier = [];
    for (const { url, depth } of frontier) {
      if (found.length >= MAX_PAGES) break;
      let html = '';
      try {
        const res = await fetch(url, { headers: { accept: 'text/html' } });
        if (!res.ok) continue;
        const type = res.headers.get('content-type') || '';
        if (!type.includes('text/html')) continue;
        html = await res.text();
      } catch {
        continue;
      }
      found.push(url);
      if (depth >= MAX_DEPTH) continue;

      const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
      for (const href of hrefs) {
        if (/^(mailto:|tel:|javascript:|#|data:)/i.test(href)) continue;
        let abs: URL;
        try {
          abs = new URL(href, url);
        } catch {
          continue;
        }
        abs.hash = '';
        if (abs.origin !== origin) continue;
        if (isExcluded(abs.pathname)) continue;
        if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|pdf|zip|woff2?|mp4)$/i.test(abs.pathname)) continue;
        const key = abs.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ url: key, depth: depth + 1 });
      }
    }
    frontier = next;
  }
  return found;
}

setup('discover pages', async () => {
  let urls = await fromSitemap();
  const source = urls.length ? 'sitemap.xml' : 'crawl';
  if (!urls.length) urls = await crawl();
  if (!urls.length) urls = [BASE_URL + '/'];

  // Collapse same-page hash variants (e.g. sitemap entries like
  // /services#daycare) to one entry per pathname — otherwise every spec
  // file's `for (const url of pageUrls) test(...)` loop declares multiple
  // tests with the identical title (label() only looks at the pathname),
  // which Playwright rejects as a duplicate test title at collection time.
  const seenPaths = new Set<string>();
  urls = urls.filter((u) => {
    let key = u;
    try {
      key = new URL(u).pathname;
    } catch {
      /* keep the raw string as the key */
    }
    if (seenPaths.has(key)) return false;
    seenPaths.add(key);
    return true;
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ baseUrl: BASE_URL, source, urls }, null, 2));
  console.log(`\n[discover] ${urls.length} page(s) via ${source} from ${BASE_URL}`);
  for (const u of urls) console.log(`  - ${u}`);
  console.log('');
});
