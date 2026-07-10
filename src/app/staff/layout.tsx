import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { PortalHeader } from "@/components/portal/portal-header"
import { StaffNav } from "@/components/staff/staff-nav"

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-full flex-col">
      <PortalHeader name={session.user.name ?? session.user.email ?? "Staff"} homeHref="/staff" />
      <div className="flex flex-1 flex-col md:flex-row">
        <StaffNav />
        <main className="flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
