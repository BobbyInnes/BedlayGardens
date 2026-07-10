"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ClipboardList, TreePine, Truck, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/staff", label: "Today", icon: LayoutDashboard },
  { href: "/staff/care-schedule", label: "Care Schedule", icon: ClipboardList },
  { href: "/staff/walk-roster", label: "Walk Roster", icon: TreePine },
  { href: "/staff/van-runs", label: "Van Runs", icon: Truck },
  { href: "/staff/incidents", label: "Incidents", icon: AlertTriangle },
]

export function StaffNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-3 md:py-6">
      {navItems.map((item) => {
        const isActive =
          item.href === "/staff" ? pathname === "/staff" : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
