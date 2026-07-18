import { defineConfig, devices } from "@playwright/test"
import { config as loadEnv } from "dotenv"

// Point the whole run at the isolated test database. Loaded into this process
// so the spawned dev server inherits DATABASE_URL — Next.js does not override
// an env var that is already set, so this wins over .env. All other vars
// (AUTH_SECRET, etc.) still come from .env via the dev server.
loadEnv({ path: ".env.test" })

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // "list" prints to the terminal; "html" writes a visual report to
  // playwright-report/ (open it with `npx playwright show-report`). open:
  // "never" so a run never blocks on serving the report.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
