"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  BookOpen,
  Tag,
  Settings,
  Truck,
  Syringe,
  Dog,
  Image as ImageIcon,
  FileText,
  UserCircle,
  BarChart3,
  ListOrdered,
  Star,
  ArrowLeftRight,
  Home,
  ShieldCheck,
  Receipt,
  Mail,
  LayoutTemplate,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavLeaf = { href: string; label: string; icon: LucideIcon }
type NavGroup = { label: string; icon: LucideIcon; children: NavLeaf[] }
type NavEntry = NavLeaf | NavGroup

function isGroup(item: NavEntry): item is NavGroup {
  return "children" in item
}

const navItems: NavEntry[] = [
  { href: "/admin", label: "Admin Control Panel", icon: LayoutDashboard },
  { href: "/admin/customers", label: "Customers", icon: UserCircle },
  { href: "/admin/dogs", label: "Dogs", icon: Dog },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/admin/occupancy", label: "Occupancy", icon: CalendarDays },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpen },
  { href: "/admin/waitlist", label: "Waitlist", icon: ListOrdered },
  {
    label: "Site Sections & Updates",
    icon: LayoutTemplate,
    children: [
      { href: "/admin/services", label: "Services", icon: Tag },
      { href: "/admin/media", label: "Media", icon: ImageIcon },
      { href: "/admin/content", label: "Content", icon: FileText },
    ],
  },
  { href: "/admin/pricing", label: "Pricing & Capacity", icon: Settings },
  { href: "/admin/van-runs", label: "Van Runs", icon: Truck },
  { href: "/admin/vaccinations", label: "Vaccinations", icon: Syringe },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/accounting", label: "Accounting", icon: Receipt },
  { href: "/admin/emails", label: "Sent Emails", icon: Mail },
  { href: "/admin/audit-log", label: "Audit Log", icon: ShieldCheck },
]

const linkClasses =
  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground"

export function AdminNav() {
  const pathname = usePathname()

  // Groups start open if the current page is one of their children, so
  // landing on e.g. /admin/media doesn't hide the very link you're on.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navItems
        .filter(isGroup)
        .map((group) => [group.label, group.children.some((child) => pathname.startsWith(child.href))])
    )
  )

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-3 md:py-6">
      {navItems.map((item) => {
        if (isGroup(item)) {
          const isOpen = openGroups[item.label] ?? false
          const isChildActive = item.children.some((child) => pathname.startsWith(child.href))
          const Icon = item.icon
          return (
            <div key={item.label} className="flex flex-col">
              <button
                type="button"
                onClick={() => setOpenGroups((prev) => ({ ...prev, [item.label]: !prev[item.label] }))}
                aria-expanded={isOpen}
                className={cn(linkClasses, "w-full", isChildActive && "text-foreground")}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronRight
                  className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-90")}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div className="ml-3 flex flex-col gap-1 border-l border-border py-1 pl-2 md:ml-4">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon
                    const isActive = pathname.startsWith(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(linkClasses, isActive && "bg-muted text-foreground")}
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
        }

        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(linkClasses, isActive && "bg-muted text-foreground")}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}

      <div className="my-2 border-t border-border md:mx-3" />

      <Link
        href="/staff"
        className={cn(linkClasses, pathname.startsWith("/staff") && "bg-muted text-foreground")}
      >
        <ArrowLeftRight className="size-4" aria-hidden="true" />
        Staff Portal
      </Link>

      <Link href="/" className={linkClasses}>
        <Home className="size-4" aria-hidden="true" />
        Home Page
      </Link>
    </nav>
  )
}
