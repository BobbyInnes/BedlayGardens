import Link from "next/link"
import { PawPrint } from "lucide-react"
import { LogoutButton } from "@/components/portal/logout-button"

export function PortalHeader({ name }: { name: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
      <Link href="/portal" className="flex items-center gap-2 font-semibold">
        <PawPrint className="size-6 text-primary" aria-hidden="true" />
        <span>Bedlay Gardens</span>
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
        <LogoutButton />
      </div>
    </header>
  )
}
