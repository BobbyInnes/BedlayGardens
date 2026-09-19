// Renders a guide HTML file to PDF using the Chromium build @playwright/test
// already installs for the e2e/screenshot suites, rather than pulling in a
// separate PDF dependency (puppeteer, etc). Defaults to docs/customer-guide's
// input/output paths when run with no arguments; pass an explicit pair to
// export a different guide, e.g.:
//   node scripts/export-guide-pdf.mjs docs/screenshots/admin/admin-control-panel-guide.html docs/screenshots/admin/admin-control-panel-guide.pdf
import path from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "@playwright/test"

const projectRoot = process.cwd()
const [inputArg, outputArg] = process.argv.slice(2)
const htmlPath = path.resolve(projectRoot, inputArg ?? path.join("docs", "customer-guide.html"))
const pdfPath = path.resolve(projectRoot, outputArg ?? path.join("docs", "customer-guide.pdf"))

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" })
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
  })
  console.log(`Wrote ${path.relative(projectRoot, pdfPath)}`)
} finally {
  await browser.close()
}
