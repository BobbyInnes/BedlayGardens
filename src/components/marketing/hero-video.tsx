"use client"

import { useEffect, useRef } from "react"

/**
 * Hero background video. Chrome sometimes declines the declarative
 * autoplay attempt on the production domain even for muted video
 * (localhost is exempt from autoplay policy, so it works in dev) — an
 * explicit muted play() after hydration is reliably allowed.
 */
export function HeroVideo({ src, poster }: { src: string; poster?: string | null }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.muted = true
    const tryPlay = () => video.play().catch(() => {})
    tryPlay()
    video.addEventListener("canplay", tryPlay)
    return () => video.removeEventListener("canplay", tryPlay)
  }, [])

  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      autoPlay
      muted
      loop
      playsInline
      // object-cover so the video fills the banner edge-to-edge — a looping
      // clip doesn't need the whole frame visible at all times, and cover
      // reads better for motion footage than the letterboxed photo fallback.
      className="h-full w-full object-cover"
    />
  )
}
