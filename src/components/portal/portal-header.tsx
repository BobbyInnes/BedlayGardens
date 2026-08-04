import Link from "next/link"
import { PawPrint, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/portal/logout-button"

export function PortalHeader({
  name,
  accountHref = "/portal/account",
}: {
  name: string
  accountHref?: string
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-red-100 px-4 sm:px-6">
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
