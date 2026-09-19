import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { monthParamFor } from "@/lib/dates"

export function OccupancyToolbar({
  basePath,
  year,
  monthIndex,
  dogFilter,
  ownerFilter,
}: {
  basePath: string
  year: number
  monthIndex: number
  dogFilter: string
  ownerFilter: string
}) {
  const prevMonth = new Date(year, monthIndex - 1, 1)
  const nextMonth = new Date(year, monthIndex + 1, 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`${basePath}?month=${monthParamFor(prevMonth.getFullYear(), prevMonth.getMonth())}`}
          className="font-medium text-primary hover:underline"
        >
          ← Prev
        </Link>
        <Link
          href={`${basePath}?month=${monthParamFor(nextMonth.getFullYear(), nextMonth.getMonth())}`}
          className="font-medium text-primary hover:underline"
        >
          Next →
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="month" value={monthParamFor(year, monthIndex)} />
        <div className="space-y-2">
          <Label htmlFor="dog">Dog name</Label>
          <Input id="dog" name="dog" defaultValue={dogFilter} className="w-48" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner">Owner name or email</Label>
          <Input id="owner" name="owner" defaultValue={ownerFilter} className="w-64" />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {(dogFilter || ownerFilter) && (
          <Button asChild variant="ghost">
            <Link href={`${basePath}?month=${monthParamFor(year, monthIndex)}`}>Clear</Link>
          </Button>
        )}
      </form>
    </div>
  )
}
