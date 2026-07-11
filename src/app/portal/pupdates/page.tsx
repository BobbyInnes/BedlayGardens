import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Pupdates",
}

export default async function PortalPupdatesPage() {
  const session = await auth()
  const pupdates = await prisma.pupdate.findMany({
    where: { dog: { ownerId: session!.user.id } },
    orderBy: { createdAt: "desc" },
    include: { dog: true, mediaItem: true },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pupdates</h1>

      {pupdates.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pupdates.map((pupdate) => (
            <li key={pupdate.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
              {pupdate.mediaItem && (
                <div className="flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {pupdate.mediaItem.type === "IMAGE" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/${pupdate.mediaItem.url}`}
                      alt={pupdate.dog.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <video
                      src={`/api/files/${pupdate.mediaItem.url}`}
                      className="size-full object-cover"
                      controls
                    />
                  )}
                </div>
              )}
              <p className="font-medium">{pupdate.dog.name}</p>
              {pupdate.note && <p className="text-muted-foreground">{pupdate.note}</p>}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {pupdate.createdAt.toLocaleDateString("en-GB")}
                </p>
                {pupdate.mediaItem && (
                  <a
                    href={`/api/files/${pupdate.mediaItem.url}`}
                    download
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Download
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No pupdates yet — check back during your dog&rsquo;s next stay.
        </p>
      )}
    </div>
  )
}
