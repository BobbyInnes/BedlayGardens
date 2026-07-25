import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { FloatingBookCta } from "@/components/marketing/floating-book-cta"
import { LocalBusinessSchema } from "@/components/marketing/local-business-schema"
import { getSettings } from "@/lib/settings"
import { NAV_LINKS, navSettingKey } from "@/lib/nav-links"

export const revalidate = 60

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getSettings()
  const businessName = settings.business_name ?? "Bedlay Gardens LTD"
  // Admin-controlled per item (Admin -> Content -> Main Menu) — visible unless
  // explicitly turned off, so nothing disappears for existing sites until an
  // admin actively hides it.
  const navLinks = NAV_LINKS.filter((link) => settings[navSettingKey(link.key)] !== "false")

  return (
    <div className="flex min-h-full flex-col">
      <LocalBusinessSchema />
      <SiteHeader businessName={businessName} navLinks={navLinks} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <SiteFooter />
      <FloatingBookCta />
    </div>
  )
}
