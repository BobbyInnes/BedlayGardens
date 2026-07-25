export type NavLinkDef = {
  key: string
  href: string
  label: string
}

// Admin can show/hide each of these via Admin -> Content -> Main Menu — see
// navSettingKey(). "Home" is included for consistency even though the logo
// also links there.
export const NAV_LINKS: NavLinkDef[] = [
  { key: "home", href: "/", label: "Home" },
  { key: "services", href: "/services", label: "Services" },
  { key: "how_it_works", href: "/#how-it-works", label: "How It Works" },
  { key: "gallery", href: "/gallery", label: "Gallery" },
  { key: "about", href: "/about", label: "About Us" },
  { key: "vacancies", href: "/vacancies", label: "Vacancies" },
  { key: "contact", href: "/contact", label: "Contact" },
]

export function navSettingKey(key: string): string {
  return `nav_show_${key}`
}
