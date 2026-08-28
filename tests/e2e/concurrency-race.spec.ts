import { execFileSync } from "node:child_process"
import { test, expect } from "@playwright/test"

// No browser involved — this drives real concurrent server-side booking
// creation directly (see concurrency-race.ts for why). Run as a standalone
// tsx process for the same reason as verify-balance-due-date.ts: the
// generated Prisma client is ESM-only and needs `tsx`, not Playwright's own
// TS loader.
test("kennel allocation and daycare capacity hold up under concurrent booking attempts", async () => {
  test.setTimeout(60_000)

  const output = execFileSync(
    "npx",
    ["tsx", "--env-file=.env.test", "tests/e2e/concurrency-race.ts"],
    { encoding: "utf-8", shell: true }
  )
  const { kennelRace, daycareRace } = JSON.parse(output) as {
    kennelRace: {
      attempted: number
      succeeded: number
      failed: number
      failureMessages: string[]
      distinctKennelNightsBooked: number
      doubleBookedNights: number
    }
    daycareRace: {
      capacity: number
      existingCount: number
      remaining: number
      attempted: number
      succeeded: number
      failed: number
      failureMessages: string[]
      threw: number
      threwErrors: string[]
      countAfterRace: number
      overBooked: boolean
    }
  }

  // --- Kennel allocation race ---
  // Only one LARGE-rated kennel exists in the seed data, so of N concurrent
  // requests for the same nights, exactly one should win.
  expect(kennelRace.doubleBookedNights, "no kennel/night should ever be booked twice").toBe(0)
  expect(kennelRace.succeeded, `expected exactly 1 of ${kennelRace.attempted} to win the only LARGE kennel — got ${kennelRace.succeeded} (failures: ${kennelRace.failureMessages.join(" | ")})`).toBe(1)
  expect(kennelRace.failed).toBe(kennelRace.attempted - 1)

  // --- Day Care capacity race ---
  expect(kennelRace.attempted).toBeGreaterThan(0) // sanity: the race actually ran
  expect(daycareRace.overBooked, `daycare capacity (${daycareRace.capacity}) was exceeded — ${daycareRace.countAfterRace - daycareRace.existingCount} bookings landed on top of ${daycareRace.existingCount} existing, only ${daycareRace.remaining} slots were free`).toBe(false)
  expect(
    daycareRace.succeeded,
    `expected exactly ${daycareRace.remaining} of ${daycareRace.attempted} concurrent daycare bookings to succeed — got ${daycareRace.succeeded}`
  ).toBe(daycareRace.remaining)
  // A losing request should get the clean "date just filled up" message, not
  // crash — isSerializationError() in book/actions.ts checks for a
  // PrismaClientKnownRequestError with code P2034, but this stack
  // (@prisma/adapter-neon) throws DriverAdapterError with
  // cause.kind === "TransactionWriteConflict" instead, so it isn't
  // recognised and the raw error escapes uncaught.
  expect(
    daycareRace.threw,
    `${daycareRace.threw} concurrent daycare booking(s) threw an uncaught error instead of failing cleanly: ${daycareRace.threwErrors.join(" | ")}`
  ).toBe(0)
})
