export function BookingDogTag({ names }: { names: string[] }) {
  if (names.length === 0) return null
  return <span className="font-bold text-blue-700 dark:text-blue-400">({names.join(", ")})</span>
}
