import path from "node:path"
import type { Page } from "@playwright/test"

// Full-page (not just the visible viewport) so a long form's submit button
// is never cropped out of the guide, even though the browser is opened at
// the fixed 1280x800 viewport (set in playwright.screenshots.config.ts) for
// consistent, non-responsive layout across every capture.
export function shooter(dir: string) {
  return (page: Page, filename: string) =>
    page.screenshot({ path: path.join(dir, filename), fullPage: true })
}
