// Colour per booking "card" in the portal bookings list, the Waitlist page,
// and the Next/Previous booking sections on the portal account and admin
// customer pages. Status wins over service — a confirmed booking is always
// green and a cancelled one always red, regardless of which service it's
// for — with the fixed pastel-per-service colour as the fallback for every
// other status. Matched by substring so it still applies if a service name
// picks up a suffix (e.g. "Meet & Greet & Evaluation").
export function bookingCardClasses(serviceName: string, status: string): string {
  if (status === "CONFIRMED") return "border-emerald-200 bg-emerald-100"
  if (status.includes("CANCELLED")) return "border-red-200 bg-red-100"
  if (serviceName.includes("Day Care")) return "border-cyan-200 bg-cyan-100"
  if (serviceName.includes("Home Boarding")) return "border-sky-200 bg-sky-100"
  if (serviceName.includes("Meet & Greet")) return "border-blue-300 bg-blue-200"
  return "border-border bg-card"
}
