// Shared colour palette so a given service shows the same colour everywhere
// it appears (Calendar, Bookings list, etc). Colours are assigned by
// position in the services list, so every caller must fetch services with
// the same ordering — `[{ sortOrder: "asc" }, { name: "asc" }]` — for the
// mapping to line up consistently across pages.
export const SERVICE_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-lime-500",
  "bg-fuchsia-500",
]

export function buildServiceColorMap(services: { id: string }[]): Map<string, string> {
  return new Map(
    services.map((service, index) => [service.id, SERVICE_COLORS[index % SERVICE_COLORS.length]])
  )
}
