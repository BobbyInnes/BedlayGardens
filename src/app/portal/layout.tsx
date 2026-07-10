import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { PortalHeader } from "@/components/portal/portal-header"
import { PortalNav } from "@/components/portal/portal-nav"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-full flex-col">
      <PortalHeader name={session.user.name ?? session.user.email ?? "Account"} />
      <div className="flex flex-1 flex-col md:flex-row">
        <PortalNav />
        <main className="flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
