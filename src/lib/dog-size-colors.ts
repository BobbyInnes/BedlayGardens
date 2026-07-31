import type { DogSize } from "@/generated/prisma/client"

export const DOG_SIZE_ORDER: DogSize[] = ["MINIATURE", "SMALL", "MEDIUM", "LARGE", "GIANT"]

export const DOG_SIZE_LABELS: Record<DogSize, string> = {
  MINIATURE: "Miniature",
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  GIANT: "Giant",
}

export const DOG_SIZE_COLORS: Record<DogSize, string> = {
  MINIATURE: "bg-pink-500",
  SMALL: "bg-purple-500",
  MEDIUM: "bg-red-500",
  LARGE: "bg-blue-500",
  GIANT: "bg-green-500",
}

export const UNKNOWN_SIZE_COLOR = "bg-gray-400"
export const UNKNOWN_SIZE_LABEL = "Size not set"

/** The largest size among a booking's dogs determines the bar's colour, since that's what the kennel is sized for. */
export function largestDogSize(sizes: (DogSize | null)[]): DogSize | null {
  let largest: DogSize | null = null
  for (const size of sizes) {
    if (!size) continue
    if (!largest || DOG_SIZE_ORDER.indexOf(size) > DOG_SIZE_ORDER.indexOf(largest)) {
      largest = size
    }
  }
  return largest
}

export function colorForDogSize(size: DogSize | null): string {
  return size ? DOG_SIZE_COLORS[size] : UNKNOWN_SIZE_COLOR
}
