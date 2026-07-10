import type { Metadata } from "next"
import Link from "next/link"
import { Pencil, Trash2 } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { deleteDog } from "@/app/portal/dogs/actions"

export const metadata: Metadata = {
  title: "My Dogs",
}

export default async function DogsPage() {
  const session = await auth()
  const dogs = await prisma.dog.findMany({
    where: { ownerId: session!.user.id },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">My Dogs</h1>
        <Button size="sm" asChild>
          <Link href="/portal/dogs/new">Add a dog</Link>
        </Button>
      </div>

      {dogs.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {dogs.map((dog) => (
            <li
              key={dog.id}
              className="flex items-center gap-4 rounded-lg border border-border p-4"
            >
              {dog.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${dog.photoUrl}`}
                  alt={dog.name}
                  className="size-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                  No photo
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium">{dog.name}</p>
                <p className="text-sm text-muted-foreground">{dog.breed}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link href={`/portal/dogs/${dog.id}`} aria-label={`Edit ${dog.name}`}>
                    <Pencil className="size-4" />
                  </Link>
                </Button>
                <form action={deleteDog.bind(null, dog.id)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${dog.name}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No dogs yet. Add a profile to start booking.
        </p>
      )}
    </div>
  )
}
