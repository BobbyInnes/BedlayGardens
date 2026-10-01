import Image from "next/image"

import { cn } from "@/lib/utils"

// The business logo. An admin can upload their own (Admin -> Media -> Site
// logo, stored as the `logo_url` setting); until they do, this falls back to
// the bundled public/images/logo.png — a line-drawn pack of dogs plus the
// hand-lettered wordmark baked into a single image (navy artwork on a white
// background).
export function Logo({
  businessName,
  logoUrl,
  className,
}: {
  businessName: string
  logoUrl?: string | null
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      {logoUrl ? (
        // Uploaded logos can be any proportions and live on the public media
        // host, so a plain <img> (sized by height) is used instead of
        // next/image, which needs fixed dimensions and a configured host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={businessName} className="h-8 w-auto max-w-[220px] object-contain sm:h-9" />
      ) : (
        <Image
          src="/images/logo.png"
          alt={businessName}
          width={2240}
          height={480}
          priority
          className="h-8 w-auto sm:h-9"
        />
      )}
    </span>
  )
}
