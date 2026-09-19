import { getSetting } from "@/lib/settings"

export const TEST_MODE_SETTING_KEY = "test_mode_enabled"

// Safety gate for the admin "test mode" toggle (bypasses vaccination/meet-greet
// checks on new dogs, redirects all outgoing email to the business address).
// That toggle itself is a `Setting` row in the database, but a DB flag alone
// can't be trusted to stay off in production — if it were ever accidentally
// set there, real customers would stop receiving their real booking emails.
// This env var is the hard backstop: test mode has no effect unless this is
// also explicitly "true". It must only ever be set in `.env.test` / local
// dev — never added to Vercel's Production environment variables.
export function isTestModeEnvAllowed(): boolean {
  return process.env.ALLOW_TEST_MODE === "true"
}

// The one check every call site (email sending, dog creation) actually uses
// — env gate first (cheap, sync, closed by default) so the DB is never even
// queried in an environment where test mode can't run anyway.
export async function isTestModeActive(): Promise<boolean> {
  if (!isTestModeEnvAllowed()) return false
  return (await getSetting(TEST_MODE_SETTING_KEY, "false")) === "true"
}
