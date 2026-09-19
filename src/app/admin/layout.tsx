import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { PortalHeader } from "@/components/portal/portal-header"
import { AdminNav } from "@/components/admin/admin-nav"
import { isTestModeActive } from "@/lib/test-mode"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login")
  }
  const testModeActive = await isTestModeActive()

  return (
    <div className="flex min-h-full flex-col">
      {testModeActive && (
        <div className="bg-destructive px-4 py-2 text-center text-sm font-semibold text-destructive-foreground">
          TEST MODE IS ON — new dogs auto-bypass vaccination/Meet &amp; Greet checks, and every
          email is going to the business address instead of the real recipient.
        </div>
      )}
      <PortalHeader
        name={session.user.name ?? session.user.email ?? "Admin"}
        accountHref={`/staff/team/${session.user.id}`}
        role={session.user.role}
        isSuperAdmin={session.user.isSuperAdmin}
      />
      <div className="flex flex-1 flex-col md:flex-row">
        <AdminNav />
        <main className="flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
