"use client"

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
  Users,
  Syringe,
  Image as ImageIcon,
  FileText,
  UserCircle,
  BarChart3,
  ListOrdered,
  Star,
  ArrowLeftRight,
  Home,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/admin/occupancy", label: "Occupancy", icon: CalendarDays },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpen },
  { href: "/admin/waitlist", label: "Waitlist", icon: ListOrdered },
  { href: "/admin/services", label: "Services", icon: Tag },
  { href: "/admin/pricing", label: "Pricing & Capacity", icon: Settings },
  { href: "/admin/van-runs", label: "Van Runs", icon: Truck },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/vaccinations", label: "Vaccinations", icon: Syringe },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/customers", label: "Customers", icon: UserCircle },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-3 md:py-6">
      {navItems.map((item) => {
        const isActive =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
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

      <div className="my-2 border-t border-border md:mx-3" />

      <Link
        href="/staff"
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
          pathname.startsWith("/staff") && "bg-muted text-foreground"
        )}
      >
        <ArrowLeftRight className="size-4" aria-hidden="true" />
        Staff Portal
      </Link>

      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Home className="size-4" aria-hidden="true" />
        Home Page
      </Link>
    </nav>
  )
}
