"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, PawPrint, Syringe, CalendarDays, UserCog, Camera, ListOrdered, Repeat, Star, Gift } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/dogs", label: "My Dogs", icon: PawPrint },
  { href: "/portal/vaccinations", label: "Vaccinations", icon: Syringe },
  { href: "/portal/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/portal/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/portal/pupdates", label: "Pupdates", icon: Camera },
  { href: "/portal/waitlist", label: "Waitlist", icon: ListOrdered },
  { href: "/portal/reviews", label: "Reviews", icon: Star },
  { href: "/portal/vouchers", label: "Vouchers", icon: Gift },
  { href: "/portal/account", label: "Account", icon: UserCog },
]

export function PortalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-3 md:py-6">
      {navItems.map((item) => {
        const isActive =
          item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href)
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
