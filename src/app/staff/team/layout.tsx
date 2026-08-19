import { redirect } from "next/navigation"
import { auth } from "@/auth"

// Staff account management (create/edit/deactivate/delete, password resets,
// admin promotion) — admin-only, even though it now lives under the staff
// portal's URL space so the left-hand nav stays put when navigating here.
// StaffLayout above already admits plain STAFF accounts into /staff/*, so
// that guard alone isn't enough — this one restricts this specific subtree.
export default async function StaffTeamLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/staff")
  }

  return <>{children}</>
}
