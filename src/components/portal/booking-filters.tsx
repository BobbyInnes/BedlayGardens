"use client"

import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function BookingFilters({
  dogs,
  services,
  selectedDogId,
  selectedServiceId,
}: {
  dogs: { id: string; name: string }[]
  services: { id: string; name: string }[]
  selectedDogId?: string
  selectedServiceId?: string
}) {
  const router = useRouter()

  function navigate(nextDogId: string | undefined, nextServiceId: string | undefined) {
    const params = new URLSearchParams()
    if (nextDogId && nextDogId !== "all") params.set("dogId", nextDogId)
    if (nextServiceId && nextServiceId !== "all") params.set("serviceId", nextServiceId)
    const query = params.toString()
    router.push(query ? `/portal/bookings?${query}` : "/portal/bookings")
  }

  return (
    <>
      {dogs.length > 1 && (
        <Select value={selectedDogId} onValueChange={(value) => navigate(value, selectedServiceId)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Dog" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {dogs.map((dog) => (
              <SelectItem key={dog.id} value={dog.id}>
                {dog.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {services.length > 1 && (
        <Select
          value={selectedServiceId}
          onValueChange={(value) => navigate(selectedDogId, value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  )
}
