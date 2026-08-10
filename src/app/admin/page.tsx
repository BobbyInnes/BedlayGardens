import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Prisma, type BookingStatus } from "@/generated/prisma/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addDays, isSameDay, parseDateParam, startOfDay, toDateInputValue } from "@/lib/dates"
import { ensureCareTasksForToday } from "@/lib/care-tasks"
import { getSetting } from "@/lib/settings"
import { formatPence } from "@/lib/format"
import { ToDoList } from "@/components/admin/todo-list"
import { CareTaskRecordButton } from "@/components/admin/care-task-record-button"

export const metadata: Metadata = {
  title: "Daily Overview | Admin",
}

const ON_SITE_ACTIVE_STATUSES: BookingStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"]
const SCHEDULED_SERVICE_SLUGS = ["meet-greet", "secure-forest-walks", "dog-walking"] as const

const bookingListInclude = {
  customer: true,
  service: true,
  kennelUnit: true,
  payments: true,
  bookingDogs: { include: { dog: true } },
} satisfies Prisma.BookingInclude
type BookingListItem = Prisma.BookingGetPayload<{ include: typeof bookingListInclude }>

const scheduledServiceInclude = {
  customer: true,
  service: true,
  bookingDogs: { include: { dog: true } },
  vanRunStops: { include: { vanRun: { include: { staff: true } } } },
} satisfies Prisma.BookingInclude
type ScheduledServiceBooking = Prisma.BookingGetPayload<{ include: typeof scheduledServiceInclude }>

function dogsCell(bookingDogs: { dog: { name: string; breed: string } }[]): string {
  return bookingDogs.map((bd) => `${bd.dog.name} (${bd.dog.breed})`).join(", ")
}

function stayLabel(booking: BookingListItem): string {
  if (booking.service.slug === "overnight-boarding") {
    const nights = Math.round((booking.endDate.getTime() - booking.startDate.getTime()) / 86_400_000)
    return `${nights} night${nights === 1 ? "" : "s"}`
  }
  if (booking.service.slug === "daycare") {
    if (booking.daycareDuration === "HALF_DAY") {
      return `Half day${booking.daycareHalfDaySlot ? ` (${booking.daycareHalfDaySlot})` : ""}`
    }
    return "Full day"
  }
  return "—"
}

function statusCell(booking: BookingListItem, direction: "in" | "out") {
  if (direction === "in") {
    if (booking.status === "CHECKED_IN" || booking.status === "CHECKED_OUT") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          <Check className="size-4" aria-hidden="true" /> Checked in
        </span>
      )
    }
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/staff/bookings/${booking.id}/check-in`}>Check in</Link>
      </Button>
    )
  }
  if (booking.status === "CHECKED_OUT") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
        <Check className="size-4" aria-hidden="true" /> Checked out
      </span>
    )
  }
  if (booking.status === "CHECKED_IN") {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/staff/bookings/${booking.id}/check-out`}>Check out</Link>
      </Button>
    )
  }
  return <span className="text-xs text-muted-foreground">Not checked in</span>
}

function paymentCell(booking: BookingListItem) {
  const paidPence = booking.payments
    .filter((p) => (p.type === "DEPOSIT" || p.type === "BALANCE") && p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amountPence, 0)
  const outstandingPence = booking.totalPence - paidPence
  if (outstandingPence <= 0) return <Badge variant="secondary">Paid</Badge>
  if (booking.service.paymentTiming === "INVOICE_AFTER") {
    return <Badge variant="outline">Invoiced after</Badge>
  }
  return <Badge variant="destructive">{formatPence(outstandingPence)} due</Badge>
}

function StatBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function BookingTable({
  title,
  emptyMessage,
  bookings,
  direction,
}: {
  title: string
  emptyMessage: string
  bookings: BookingListItem[]
  direction: "in" | "out"
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        {title} ({bookings.length})
      </h2>
      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="p-2">Type</th>
                <th className="p-2">Customer</th>
                <th className="p-2">Dog(s)</th>
                <th className="p-2">Duration</th>
                <th className="p-2">Location</th>
                <th className="p-2">Status</th>
                <th className="p-2">Paid</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={`${direction}-${booking.id}`} className="border-b border-border last:border-0">
                  <td className="p-2">
                    <Badge variant="secondary">
                      {booking.service.slug === "daycare" ? "Daycare" : "Home Boarding"}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Link
                      href={`/admin/customers/${booking.customerId}`}
                      className="font-medium hover:underline"
                    >
                      {booking.customer.name}
                    </Link>
                  </td>
                  <td className="p-2">{dogsCell(booking.bookingDogs)}</td>
                  <td className="p-2">{stayLabel(booking)}</td>
                  <td className="p-2">
                    {booking.kennelUnit?.name ?? (booking.service.slug === "daycare" ? "Daycare" : "—")}
                  </td>
                  <td className="p-2">{statusCell(booking, direction)}</td>
                  <td className="p-2">{paymentCell(booking)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; assignee?: string }>
}) {
  const { date: dateParam, assignee: assigneeParam } = await searchParams
  const date = parseDateParam(dateParam)
  const realToday = startOfDay(new Date())
  const isToday = isSameDay(date, realToday)
  const prevDate = addDays(date, -1)
  const nextDate = addDays(date, 1)
  const assignee = assigneeParam || "ALL"

  if (isToday) await ensureCareTasksForToday()

  const [
    services,
    kennelUnitCount,
    crateOccupancyCount,
    boardingOccupantsTonight,
    boardingArrivals,
    boardingDepartures,
    daycareToday,
    scheduledServiceBookings,
    newOnlineBookingsCount,
    pendingBoardingCount,
    careTasksToday,
    toDoTasks,
    staffUsers,
    daycareCapacitySetting,
  ] = await Promise.all([
    prisma.service.findMany({
      where: { slug: { in: ["overnight-boarding", "daycare", ...SCHEDULED_SERVICE_SLUGS] } },
    }),
    prisma.kennelUnit.count({ where: { active: true } }),
    prisma.kennelOccupancy.count({ where: { date } }),
    prisma.booking.findMany({
      where: {
        service: { slug: "overnight-boarding" },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        startDate: { lte: date },
        endDate: { gt: date },
      },
      include: { bookingDogs: { include: { dog: { include: { flags: true } } } } },
    }),
    prisma.booking.findMany({
      where: {
        service: { slug: "overnight-boarding" },
        startDate: date,
        status: { in: ON_SITE_ACTIVE_STATUSES },
      },
      include: bookingListInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        service: { slug: "overnight-boarding" },
        endDate: date,
        status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
      },
      include: bookingListInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        service: { slug: "daycare" },
        startDate: date,
        status: { in: ON_SITE_ACTIVE_STATUSES },
      },
      include: bookingListInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        service: { slug: { in: [...SCHEDULED_SERVICE_SLUGS] } },
        startDate: date,
        status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW", "DRAFT"] },
      },
      include: scheduledServiceInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.count({
      where: {
        createdAt: { gte: realToday, lt: addDays(realToday, 1) },
        status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
      },
    }),
    prisma.booking.count({
      where: { service: { slug: "overnight-boarding" }, status: "PENDING_PAYMENT" },
    }),
    prisma.careTask.findMany({
      where: { date, type: { in: ["FEED", "MEDICATION"] } },
      include: { dog: true, completedBy: true, booking: { include: { customer: true, kennelUnit: true, service: true } } },
      orderBy: [{ dog: { name: "asc" } }],
    }),
    prisma.toDoTask.findMany({
      where:
        assignee === "ALL"
          ? {}
          : assignee === "UNASSIGNED"
            ? { assignedToId: null }
            : { assignedToId: assignee },
      include: { assignedTo: true },
      orderBy: [{ completed: "asc" }, { createdAt: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: { in: ["STAFF", "ADMIN"] }, active: true },
      orderBy: { name: "asc" },
    }),
    getSetting("daycare_max_capacity", "0"),
  ])

  const boardingService = services.find((s) => s.slug === "overnight-boarding")

  const boardingDogIds = new Set<string>()
  const soloManagedDogIds = new Set<string>()
  for (const booking of boardingOccupantsTonight) {
    for (const bd of booking.bookingDogs) {
      boardingDogIds.add(bd.dogId)
      if (bd.dog.flags.some((f) => f.type === "SOLO_MANAGED_BOARDING")) soloManagedDogIds.add(bd.dogId)
    }
  }
  const boardingPetCount = boardingDogIds.size
  const soloManagedPetCount = soloManagedDogIds.size
  const homeBoardingOnlyPetCount = boardingPetCount - soloManagedPetCount
  const pendingCheckIns = boardingArrivals.filter(
    (b) => b.status !== "CHECKED_IN" && b.status !== "CHECKED_OUT"
  ).length
  const pendingCheckOuts = boardingDepartures.filter((b) => b.status !== "CHECKED_OUT").length

  const daycareDogIds = new Set<string>()
  for (const b of daycareToday) for (const bd of b.bookingDogs) daycareDogIds.add(bd.dogId)
  const daycarePetCount = daycareDogIds.size
  const fullDayCount = daycareToday.filter((b) => b.daycareDuration !== "HALF_DAY").length
  const halfDayCount = daycareToday.filter((b) => b.daycareDuration === "HALF_DAY").length
  const daycareCapacity = Number(daycareCapacitySetting || 0)

  const dogWalkingBookings = scheduledServiceBookings.filter((b) => b.service.slug === "dog-walking")
  const meetGreetBookings = scheduledServiceBookings.filter((b) => b.service.slug === "meet-greet")
  const forestWalkBookings = scheduledServiceBookings.filter((b) => b.service.slug === "secure-forest-walks")
  const dogWalkingDogIds = new Set<string>()
  for (const b of dogWalkingBookings) for (const bd of b.bookingDogs) dogWalkingDogIds.add(bd.dogId)

  const checkingIn = [...boardingArrivals, ...daycareToday]
  const checkingOut = [...boardingDepartures, ...daycareToday]

  const feedingTasks = careTasksToday.filter((t) => t.type === "FEED")
  const medicationTasks = careTasksToday.filter((t) => t.type === "MEDICATION")

  const toDoTasksForClient = toDoTasks.map((t) => ({
    id: t.id,
    text: t.text,
    completed: t.completed,
    assignedTo: t.assignedTo ? { id: t.assignedTo.id, name: t.assignedTo.name } : null,
  }))

  function dayHref(target: Date): string {
    const params = new URLSearchParams({ date: toDateInputValue(target) })
    if (assignee !== "ALL") params.set("assignee", assignee)
    return `/admin?${params.toString()}`
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Overview</h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <Link href={dayHref(prevDate)} aria-label="Previous day" className="rounded p-1 hover:bg-muted">
              <ChevronLeft className="size-4" />
            </Link>
            <span className="font-medium text-foreground">
              {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <Link href={dayHref(nextDate)} aria-label="Next day" className="rounded p-1 hover:bg-muted">
              <ChevronRight className="size-4" />
            </Link>
            {!isToday && (
              <Link href={dayHref(realToday)} className="ml-2 font-medium text-primary hover:underline">
                Today
              </Link>
            )}
          </div>
        </div>
        <form className="flex items-end gap-2">
          {assignee !== "ALL" && <input type="hidden" name="assignee" value={assignee} />}
          <div className="space-y-1">
            <Label htmlFor="date" className="sr-only">
              Jump to date
            </Label>
            <Input id="date" name="date" type="date" defaultValue={toDateInputValue(date)} className="w-40" />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Go
          </Button>
        </form>
      </div>

      {(newOnlineBookingsCount > 0 || pendingBoardingCount > 0) && (
        <div className="space-y-2">
          {newOnlineBookingsCount > 0 && (
            <Link
              href="/admin/bookings"
              className="flex items-center justify-between gap-3 rounded-lg border-l-4 border-emerald-400 bg-emerald-50 p-4 text-sm hover:bg-emerald-100"
            >
              <div>
                <p className="font-semibold text-emerald-900">New online bookings today</p>
                <p className="text-emerald-800">Click to review and confirm</p>
              </div>
              <Badge variant="secondary">{newOnlineBookingsCount} total</Badge>
            </Link>
          )}
          {pendingBoardingCount > 0 && (
            <Link
              href={
                boardingService
                  ? `/admin/bookings?service=${boardingService.id}&status=PENDING_PAYMENT`
                  : "/admin/bookings"
              }
              className="flex items-center justify-between gap-3 rounded-lg border-l-4 border-blue-400 bg-blue-50 p-4 text-sm hover:bg-blue-100"
            >
              <div>
                <p className="font-semibold text-blue-900">
                  {pendingBoardingCount} Home Boarding booking{pendingBoardingCount === 1 ? "" : "s"} awaiting
                  payment
                </p>
                <p className="text-blue-800">Click to review and confirm</p>
              </div>
              <ArrowRight className="size-4 text-blue-700" />
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Home Boarding</CardTitle>
            <CardDescription>Real-time occupancy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="Pets" value={boardingPetCount} />
              <StatBlock label="Crates" value={crateOccupancyCount} />
            </div>
            <div className="space-y-1 border-t border-border pt-3">
              <StatRow label="Check In / Out" value={`${pendingCheckIns} / ${pendingCheckOuts}`} />
              <StatRow label="Home boarding" value={`${homeBoardingOnlyPetCount} pets`} />
              <StatRow label="Solo / managed boarding" value={`${soloManagedPetCount} pets`} />
              <StatRow label="Crates occupied" value={`${crateOccupancyCount} of ${kennelUnitCount}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dog Daycare</CardTitle>
            <CardDescription>Real-time occupancy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="Pets" value={daycarePetCount} />
              <StatBlock label="Bookings" value={daycareToday.length} />
            </div>
            <div className="space-y-1 border-t border-border pt-3">
              <StatRow label="Full day" value={fullDayCount} />
              <StatRow label="Half day" value={halfDayCount} />
              <StatRow
                label="Room allocation"
                value={daycareCapacity > 0 ? `${daycarePetCount} / ${daycareCapacity}` : daycarePetCount}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Other Types</CardTitle>
            <CardDescription>Scheduled today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium">Dog Walks</p>
              <p className="text-xs text-muted-foreground">
                {dogWalkingBookings.length} booking{dogWalkingBookings.length === 1 ? "" : "s"} ·{" "}
                {dogWalkingDogIds.size} pet{dogWalkingDogIds.size === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium">Meet &amp; Greet</p>
              <p className="text-xs text-muted-foreground">
                {meetGreetBookings.length} booking{meetGreetBookings.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium">Secure Forest Walks</p>
              <p className="text-xs text-muted-foreground">
                {forestWalkBookings.length} booking{forestWalkBookings.length === 1 ? "" : "s"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <BookingTable
        title="Checking In Today"
        emptyMessage="No arrivals today."
        bookings={checkingIn}
        direction="in"
      />

      <BookingTable
        title="Checking Out Today"
        emptyMessage="No departures today."
        bookings={checkingOut}
        direction="out"
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Scheduled Services ({scheduledServiceBookings.length})</h2>
        {scheduledServiceBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing else scheduled today.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="p-2">Booking</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2">Dog(s)</th>
                  <th className="p-2">Service</th>
                  <th className="p-2">Time</th>
                  <th className="p-2">Assigned to</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduledServiceBookings.map((booking: ScheduledServiceBooking) => {
                  const stop = booking.vanRunStops[0]
                  return (
                    <tr key={booking.id} className="border-b border-border last:border-0">
                      <td className="p-2">
                        <Link href={`/admin/bookings/${booking.id}`} className="font-medium hover:underline">
                          {booking.id.slice(-6).toUpperCase()}
                        </Link>
                      </td>
                      <td className="p-2">{booking.customer.name}</td>
                      <td className="p-2">{dogsCell(booking.bookingDogs)}</td>
                      <td className="p-2">{booking.service.name}</td>
                      <td className="p-2">{stop?.vanRun.startTime ?? "—"}</td>
                      <td className="p-2">{stop?.vanRun.staff?.name ?? "—"}</td>
                      <td className="p-2">
                        <Badge variant="outline">{booking.status.replace(/_/g, " ")}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">To-Do List</h2>
          <form className="flex items-center gap-2 text-sm">
            <input type="hidden" name="date" value={toDateInputValue(date)} />
            <Label htmlFor="assignee" className="text-muted-foreground">
              Assigned to
            </Label>
            <select
              id="assignee"
              name="assignee"
              defaultValue={assignee}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="ALL">All staff</option>
              <option value="UNASSIGNED">Unassigned</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Filter
            </Button>
          </form>
        </div>
        <ToDoList
          tasks={toDoTasksForClient}
          staff={staffUsers.map((u) => ({ id: u.id, name: u.name }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Feeding</h2>
        {feedingTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feeding tasks for today&rsquo;s in-house dogs.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="p-2">Pet</th>
                  <th className="p-2">Location</th>
                  <th className="p-2">Instructions</th>
                  <th className="p-2">Record</th>
                </tr>
              </thead>
              <tbody>
                {feedingTasks.map((task) => (
                  <tr key={task.id} className="border-b border-border last:border-0">
                    <td className="p-2 font-medium">{task.dog.name}</td>
                    <td className="p-2">{task.booking.kennelUnit?.name ?? task.booking.service.name}</td>
                    <td className="p-2 text-muted-foreground">{task.description}</td>
                    <td className="p-2">
                      <CareTaskRecordButton
                        taskId={task.id}
                        completed={!!task.completedAt}
                        completedByName={task.completedBy?.name ?? null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Medications</h2>
        {medicationTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medication tasks for today&rsquo;s in-house dogs.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="p-2">Pet</th>
                  <th className="p-2">Location</th>
                  <th className="p-2">Instructions</th>
                  <th className="p-2">Record</th>
                </tr>
              </thead>
              <tbody>
                {medicationTasks.map((task) => (
                  <tr key={task.id} className="border-b border-border last:border-0">
                    <td className="p-2 font-medium">{task.dog.name}</td>
                    <td className="p-2">{task.booking.kennelUnit?.name ?? task.booking.service.name}</td>
                    <td className="p-2 text-muted-foreground">{task.description}</td>
                    <td className="p-2">
                      <CareTaskRecordButton
                        taskId={task.id}
                        completed={!!task.completedAt}
                        completedByName={task.completedBy?.name ?? null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
