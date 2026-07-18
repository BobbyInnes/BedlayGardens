// Runs `next dev` against the isolated test database (.env.test) instead of the
// live one in .env — for safely testing flows that write data (e.g. payments)
// locally. Loads .env.test into the environment first; Next.js then fills in
// the remaining vars from .env without overriding the test DATABASE_URL.
import { spawn } from "node:child_process"
import { config } from "dotenv"

const result = config({ path: ".env.test" })
if (result.error || !process.env.DATABASE_URL) {
  console.error(
    "Could not load DATABASE_URL from .env.test. Create it with the Neon test-branch " +
      "connection string (see tests/e2e/README.md)."
  )
  process.exit(1)
}
console.log(
  `[dev:test] using test database: ${process.env.DATABASE_URL.replace(/.*@([^/]*)\/.*/, "$1")}`
)

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev"], {
  stdio: "inherit",
  env: process.env,
})
child.on("exit", (code) => process.exit(code ?? 0))
