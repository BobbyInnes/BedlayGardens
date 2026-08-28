import fs from 'fs';
import path from 'path';

type Discovered = { baseUrl: string; source: string; urls: string[] };

const file = path.join(process.cwd(), 'test-results', 'urls.json');

function load(): Discovered {
  if (!fs.existsSync(file)) {
    const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    return { baseUrl, source: 'fallback', urls: [baseUrl + '/'] };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const discovered = load();
export const pageUrls = discovered.urls;
export const baseUrl = discovered.baseUrl;

/** Short readable label for a URL, used as the test title. */
export const label = (u: string) => {
  try {
    const p = new URL(u).pathname;
    return p === '/' ? '/ (home)' : p;
  } catch {
    return u;
  }
};
