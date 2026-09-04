// Wakes a possibly-suspended Neon compute before `prisma migrate deploy`
// runs as part of `npm run build`. That step's own advisory-lock wait has
// a hard ~10s ceiling (see https://pris.ly/d/migrate-advisory-locking) —
// cold-start latency alone can exceed that, causing "P1002 ... Timed out
// trying to acquire a postgres advisory lock" even when nothing is
// actually holding the lock (confirmed once via Neon's SQL Editor:
// pg_locks was empty). Separately, running several migrate deploy
// attempts back-to-back in a short window (e.g. a quick redeploy retry)
// can itself cause brief real lock contention between them — this
// warm-up doesn't fix that case, but it does mean cold-start latency is
// never also stacked on top of it. Retrying a trivial query here first,
// with a much longer overall budget, means the compute is already awake
// by the time migrate deploy's tight window runs.
//
// Deliberately never fails the build itself (always exits 0) — if the
// database is genuinely unreachable, `prisma migrate deploy` will report
// that with its own, clearer error. This script is a best-effort warm-up,
// not a health gate.
import "dotenv/config"
import { Client } from "@neondatabase/serverless"

const DATABASE_URL = process.env.DATABASE_URL
const MAX_ATTEMPTS = 6
const RETRY_DELAY_MS = 5000

async function attempt(n) {
  const client = new Client(DATABASE_URL)
  try {
    await client.connect()
    await client.query("select 1")
    console.log(`[warm-db] database is awake (attempt ${n}/${MAX_ATTEMPTS})`)
    return true
  } catch (err) {
    console.log(`[warm-db] attempt ${n}/${MAX_ATTEMPTS} failed: ${err instanceof Error ? err.message : err}`)
    return false
  } finally {
    await client.end().catch(() => {})
  }
}

async function main() {
  if (!DATABASE_URL) {
    console.log("[warm-db] DATABASE_URL not set — skipping warm-up")
    return
  }
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    if (await attempt(n)) return
    if (n < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }
  console.log("[warm-db] could not confirm the database is awake after retries — continuing anyway")
}

main()
