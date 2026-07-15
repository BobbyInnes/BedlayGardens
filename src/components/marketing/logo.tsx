import Image from "next/image"

import { cn } from "@/lib/utils"

// Real Bedlay Gardens logo — line-drawn pack of dogs plus the hand-lettered
// wordmark, baked into a single image (navy artwork on a white background).
export function Logo({
  businessName,
  className,
}: {
  businessName: string
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/images/logo.png"
        alt={businessName}
        width={2240}
        height={480}
        priority
        className="h-8 w-auto sm:h-9"
      />
    </span>
  )
}
