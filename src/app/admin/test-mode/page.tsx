import type { Metadata } from "next"
import { auth } from "@/auth"
import { getSetting } from "@/lib/settings"
import { isTestModeEnvAllowed, TEST_MODE_SETTING_KEY } from "@/lib/test-mode"
import { TestModeToggle } from "@/components/admin/test-mode-toggle"

export const metadata: Metadata = {
  title: "Test Mode | Admin",
}

export default async function AdminTestModePage() {
  const session = await auth()
  const envAllowed = isTestModeEnvAllowed()
  const enabled = envAllowed && (await getSetting(TEST_MODE_SETTING_KEY, "false")) === "true"

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Test Mode</h1>
        <p className="text-sm text-muted-foreground">
          A site-wide switch for safely creating test data. While on: every new dog gets its
          vaccination and Meet &amp; Greet checks bypassed automatically, and every outgoing email
          is redirected to the business email address instead of the real recipient.
        </p>
      </div>

      {!session?.user.isSuperAdmin ? (
        <p className="text-sm text-destructive">Only a super admin can view or change this.</p>
      ) : !envAllowed ? (
        <p className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Test mode isn&rsquo;t available in this environment — the <code>ALLOW_TEST_MODE</code>{" "}
          environment variable isn&rsquo;t set. This is deliberate: it&rsquo;s the hard backstop
          that keeps test mode from ever running against the live production database, and it
          should only ever be set locally (<code>.env.test</code>) or in a non-production Vercel
          environment.
        </p>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{enabled ? "Test mode is ON" : "Test mode is off"}</p>
              <p className="text-sm text-muted-foreground">
                {enabled
                  ? "New dogs auto-bypass their checks, and every email is going to the business address."
                  : "Normal behaviour — checks are enforced and email goes to real recipients."}
              </p>
            </div>
            <TestModeToggle enabled={enabled} />
          </div>
        </div>
      )}
    </div>
  )
}
