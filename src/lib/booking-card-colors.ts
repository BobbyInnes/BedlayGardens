// Fixed pastel colour per service name, used for booking "cards" in the
// portal bookings list and the Next/Previous booking sections on the
// portal account and admin customer pages. Matched by substring so it
// still applies if a service name picks up a suffix (e.g. "Meet & Greet
// & Evaluation").
export function bookingCardClasses(serviceName: string): string {
  if (serviceName.includes("Day Care")) return "border-cyan-200 bg-cyan-100"
  if (serviceName.includes("Home Boarding")) return "border-sky-200 bg-sky-100"
  if (serviceName.includes("Meet & Greet")) return "border-blue-300 bg-blue-200"
  return "border-border bg-card"
}
