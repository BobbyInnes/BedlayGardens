"use client"

import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function DogBookingFilter({
  dogs,
  selectedDogId,
}: {
  dogs: { id: string; name: string }[]
  selectedDogId?: string
}) {
  const router = useRouter()

  return (
    <Select
      value={selectedDogId ?? "all"}
      onValueChange={(value) => {
        router.push(value === "all" ? "/portal/bookings" : `/portal/bookings?dogId=${value}`)
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="All dogs" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All dogs</SelectItem>
        {dogs.map((dog) => (
          <SelectItem key={dog.id} value={dog.id}>
            {dog.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
