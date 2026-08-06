import Link from "next/link"
import { PawPrint, UserCog } from "lucide-react"
import type { Role } from "@/generated/prisma/client"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/portal/logout-button"
import { cn } from "@/lib/utils"

export function PortalHeader({
  name,
  accountHref = "/portal/account",
  role,
}: {
  name: string
  accountHref?: string
  // Pastel blue for admins (including super admins), pastel red for staff,
  // no tint for customers.
  role: Role
}) {
  return (
    <header
      className={cn(
        "flex h-16 items-center justify-between border-b border-border px-4 sm:px-6",
        role === "ADMIN" ? "bg-blue-100" : role === "STAFF" ? "bg-red-100" : ""
      )}
    >
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <PawPrint className="size-6 text-primary" aria-hidden="true" />
        <span>Bedlay Gardens</span>
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
        <Button asChild variant="outline" size="sm">
          <Link href={accountHref}>
            <UserCog className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">My Account</span>
          </Link>
        </Button>
        <LogoutButton />
      </div>
    </header>
  )
}
