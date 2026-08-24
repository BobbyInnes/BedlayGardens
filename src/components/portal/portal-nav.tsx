"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  PawPrint,
  Syringe,
  CalendarDays,
  UserCog,
  Camera,
  ListOrdered,
  Star,
  Home,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavLeaf = { href: string; label: string; icon: LucideIcon }
// A leaf that also carries children — always rendered, no collapse/expand,
// unlike the admin nav's toggleable groups. Waitlist sits under My Bookings
// this way since it's really a booking-adjacent view, not its own section.
type NavParent = NavLeaf & { children: NavLeaf[] }

const navItems: (NavLeaf | NavParent)[] = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/account", label: "Your Details", icon: UserCog },
  { href: "/portal/dogs", label: "My Dogs", icon: PawPrint },
  { href: "/portal/vaccinations", label: "Vaccinations", icon: Syringe },
  {
    href: "/portal/bookings",
    label: "My Bookings",
    icon: CalendarDays,
    children: [{ href: "/portal/waitlist", label: "Waitlist", icon: ListOrdered }],
  },
  { href: "/portal/pupdates", label: "Pet Updates", icon: Camera },
  { href: "/portal/reviews", label: "Reviews", icon: Star },
]

const linkClasses =
  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground"

export function PortalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-3 md:py-6">
      {navItems.map((item) => {
        const isActive =
          item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <div key={item.href} className="flex flex-col">
            <Link href={item.href} className={cn(linkClasses, isActive && "bg-muted text-foreground")}>
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
            {"children" in item && (
              <div className="ml-3 flex flex-col gap-1 border-l border-border py-1 pl-2 md:ml-4">
                {item.children.map((child) => {
                  const ChildIcon = child.icon
                  const isChildActive = pathname.startsWith(child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(linkClasses, isChildActive && "bg-muted text-foreground")}
                    >
                      <ChildIcon className="size-4" aria-hidden="true" />
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div className="my-2 border-t border-border md:mx-3" />

      <Link href="/" className={linkClasses}>
        <Home className="size-4" aria-hidden="true" />
        Home Page
      </Link>
    </nav>
  )
}
