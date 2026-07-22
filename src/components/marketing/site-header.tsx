"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { ChevronDown, LayoutDashboard, LogOut, Menu, UserRound } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Logo } from "@/components/marketing/logo"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
]

type SessionUser = {
  name?: string | null
  role?: "CUSTOMER" | "STAFF" | "ADMIN"
}

function dashboardFor(user: SessionUser) {
  if (user.role === "ADMIN") return { href: "/admin", label: "Admin dashboard" }
  if (user.role === "STAFF") return { href: "/staff", label: "Staff dashboard" }
  return { href: "/portal", label: "My portal" }
}

// Fetched client-side (not via `auth()` in the layout) so the marketing pages
// stay statically rendered with `revalidate = 60`.
function useSessionUser() {
  const [user, setUser] = React.useState<SessionUser | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        if (!cancelled) setUser(session?.user ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return user
}

export function SiteHeader({ businessName }: { businessName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const user = useSessionUser()

  function handleAdminClick(e: React.MouseEvent) {
    e.preventDefault()
    if (user?.role === "ADMIN") {
      router.push("/admin")
    } else {
      toast.error("Access only allowed to administrators")
    }
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${businessName} — home`}>
          <Logo businessName={businessName} />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium text-muted-foreground transition-colors hover:text-primary",
                pathname === link.href && "text-primary"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/admin"
            onClick={handleAdminClick}
            className={cn(
              "text-sm font-medium text-muted-foreground transition-colors hover:text-primary",
              pathname.startsWith("/admin") && "text-primary"
            )}
          >
            Admin
          </Link>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user?.name ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <UserRound className="size-4" aria-hidden="true" />
                  {user.name}
                  <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={dashboardFor(user).href}>
                    <LayoutDashboard className="size-4" aria-hidden="true" />
                    {dashboardFor(user).label}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/book">Book Now</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>
                <Logo businessName={businessName} />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                    pathname === link.href && "bg-muted text-primary"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/admin"
                onClick={handleAdminClick}
                className={cn(
                  "rounded-md px-3 py-2.5 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  pathname.startsWith("/admin") && "bg-muted text-primary"
                )}
              >
                Admin
              </Link>
              {user?.name ? (
                <>
                  <Link
                    href={dashboardFor(user).href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {dashboardFor(user).label}
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="rounded-md px-3 py-2.5 text-left text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Log in
                </Link>
              )}
            </nav>
            <div className="mt-4 px-4">
              <Button className="w-full" asChild>
                <Link href="/book" onClick={() => setOpen(false)}>
                  Book Now
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
