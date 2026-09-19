import { defineConfig, devices } from "@playwright/test"
import { config as loadEnv } from "dotenv"

// Same pattern as playwright.config.ts: point the whole run at the isolated
// test database. Loaded into this process so the spawned dev server inherits
// DATABASE_URL — Next.js does not override an env var that is already set,
// so this wins over .env.
loadEnv({ path: ".env.test" })

export default defineConfig({
  testDir: "./scripts/screenshots",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // Fixed viewport (not a device preset) so every screenshot in the guide
    // is captured at the same, requested 1280x800 size regardless of what
    // machine generates them.
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "screenshots", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
})
