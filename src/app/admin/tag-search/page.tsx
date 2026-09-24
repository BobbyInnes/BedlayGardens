import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCustomerNumber, formatDogNumber } from "@/lib/customer-dog-numbers"
import { fullName } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Find by Tag | Admin",
}

const MAX_RESULTS = 500

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

export default async function AdminTagSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; tag?: string | string[]; match?: string }>
}) {
  const params = await searchParams
  const type = params.type === "customer" ? "customer" : "dog"
  const match = params.match === "all" ? "all" : "any"

  const tagOptions =
    type === "dog"
      ? await prisma.dogTag.findMany({ orderBy: { name: "asc" } })
      : await prisma.customerTag.findMany({ orderBy: { name: "asc" } })

  // Ignore any ids that aren't tags of the selected type.
  const validIds = new Set(tagOptions.map((t) => t.id))
  const selectedIds = toArray(params.tag).filter((id) => validIds.has(id))
  const selectedNames = tagOptions.filter((t) => selectedIds.includes(t.id)).map((t) => t.name)

  const tagFilter = (id: string) => ({ adminTags: { some: { tagId: id } } })
  const tagWhere =
    match === "all"
      ? { AND: selectedIds.map(tagFilter) }
      : { adminTags: { some: { tagId: { in: selectedIds } } } }

  const dogs =
    type === "dog" && selectedIds.length > 0
      ? await prisma.dog.findMany({
          where: tagWhere,
          include: {
            owner: true,
            adminTags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
          },
          orderBy: { name: "asc" },
          take: MAX_RESULTS,
        })
      : []

  const customers =
    type === "customer" && selectedIds.length > 0
      ? await prisma.user.findMany({
          where: { role: "CUSTOMER", ...tagWhere },
          include: {
            _count: { select: { dogs: true } },
            adminTags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
          },
          orderBy: [{ surname: "asc" }, { forename: "asc" }],
          take: MAX_RESULTS,
        })
      : []

  const resultCount = type === "dog" ? dogs.length : customers.length
  const searched = selectedIds.length > 0

  const tabClasses = (active: boolean) =>
    cn(
      "rounded-md px-3 py-2 text-sm font-medium",
      active
        ? "bg-muted text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find by Tag</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          List the dogs with chosen dog tags, or the customers with chosen customer tags. Tags are
          only ever shown in the admin area.
        </p>
      </div>

      <div className="flex gap-1">
        <Link href="/admin/tag-search?type=dog" className={tabClasses(type === "dog")}>
          Dogs
        </Link>
        <Link href="/admin/tag-search?type=customer" className={tabClasses(type === "customer")}>
          Customers
        </Link>
      </div>

      <form className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
        <input type="hidden" name="type" value={type} />

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">
            {type === "dog" ? "Dog tags" : "Customer tags"}
          </legend>
          {tagOptions.length > 0 ? (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {tagOptions.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 text-sm"
                  title={tag.description ?? undefined}
                >
                  <input
                    type="checkbox"
                    name="tag"
                    value={tag.id}
                    defaultChecked={selectedIds.includes(tag.id)}
                  />
                  {tag.name}
                  {!tag.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No {type} tags yet — add some under Tags → Manage Tags.
            </p>
          )}
        </fieldset>

        {tagOptions.length > 1 && (
          <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <legend className="sr-only">Match</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="match" value="any" defaultChecked={match === "any"} />
              Has any of the selected tags
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="match" value="all" defaultChecked={match === "all"} />
              Has all of the selected tags
            </label>
          </fieldset>
        )}

        <Button type="submit" disabled={tagOptions.length === 0}>
          Find {type === "dog" ? "dogs" : "customers"}
        </Button>
      </form>

      {searched ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            {resultCount} {type === "dog" ? "dog" : "customer"}
            {resultCount === 1 ? "" : "s"} with {match === "all" ? "all of" : "any of"}:{" "}
            {selectedNames.join(", ")}
            {resultCount === MAX_RESULTS && ` (showing the first ${MAX_RESULTS})`}
          </h2>

          {resultCount === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches those tags.</p>
          ) : type === "dog" ? (
            <ul className="divide-y-2 divide-gray-400 rounded-lg border border-border dark:divide-gray-500">
              {dogs.map((dog) => (
                <li key={dog.id}>
                  <Link
                    href={`/admin/customers/${dog.owner.id}#dog-${dog.id}`}
                    className="block space-y-1 p-4 text-sm hover:bg-muted/50"
                  >
                    <p>
                      <span className="font-bold text-blue-700 underline dark:text-blue-300">
                        {dog.name}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        ({formatDogNumber(dog.dogNumber)}) —
                      </span>{" "}
                      <span className="font-bold text-blue-700 underline dark:text-blue-300">
                        {dog.breed}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Owner: {fullName(dog.owner)} ({dog.owner.email})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {dog.adminTags.map((a) => (
                        <Badge key={a.tagId} variant="secondary" title={a.tag.description ?? undefined}>
                          {a.tag.name}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y-2 divide-gray-400 rounded-lg border border-border dark:divide-gray-500">
              {customers.map((customer) => (
                <li key={customer.id}>
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="block space-y-1 p-4 text-sm hover:bg-muted/50"
                  >
                    <p className="font-medium">
                      {fullName(customer)}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({formatCustomerNumber(customer.customerNumber)})
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      {customer.email} · {customer._count.dogs} dog
                      {customer._count.dogs === 1 ? "" : "s"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {customer.adminTags.map((a) => (
                        <Badge key={a.tagId} variant="secondary" title={a.tag.description ?? undefined}>
                          {a.tag.name}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        tagOptions.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Tick one or more tags above, then press Find.
          </p>
        )
      )}
    </div>
  )
}
