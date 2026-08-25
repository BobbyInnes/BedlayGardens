import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  BedDouble,
  Building2,
  Check,
  ClipboardList,
  DoorClosed,
  DoorOpen,
  Footprints,
  Globe,
  LayoutGrid,
  ListChecks,
  Pill,
  TreePine,
  UtensilsCrossed,
  Users,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Prisma, type BookingStatus } from "@/generated/prisma/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { isSameDay, parseDateParam, startOfDay, toDateInputValue } from "@/lib/dates"
import { ensureCareTasksForToday } from "@/lib/care-tasks"
import { getSetting } from "@/lib/settings"
import { formatPence, fullName } from "@/lib/format"
import { ToDoList } from "@/components/admin/todo-list"
import { CareTaskRecordButton } from "@/components/admin/care-task-record-button"
import { DailyDatePicker } from "@/components/admin/daily-date-picker"

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
  assignedStaff: true,
} satisfies Prisma.BookingInclude
type ScheduledServiceBooking = Prisma.BookingGetPayload<{ include: typeof scheduledServiceInclude }>

const occupantsInclude = {
  customer: true,
  service: true,
  kennelUnit: true,
  payments: true,
  bookingDogs: { include: { dog: { include: { flags: true } } } },
} satisfies Prisma.BookingInclude
type OccupantBooking = Prisma.BookingGetPayload<{ include: typeof occupantsInclude }>

type IconType = React.ComponentType<{ className?: string }>

// Shared table styling so every list on the page reads as one system.
const TABLE_HEAD_ROW =
  "border-b border-border bg-muted/40 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase"
const TABLE_CELL = "px-4 py-2.5"
const TABLE_ROW = "border-b border-border last:border-0 hover:bg-muted/30"

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

// "N days till check-out" for the Occupants table, relative to the day
// being viewed (not necessarily the real today) so it stays meaningful
// when browsing forward/back with the date picker.
function checkoutCountdownCell(booking: OccupantBooking, viewedDate: Date) {
  if (isSameDay(booking.endDate, viewedDate)) {
    return <span className="text-xs font-medium text-amber-600">Checking out today</span>
  }
  const days = Math.round((booking.endDate.getTime() - viewedDate.getTime()) / 86_400_000)
  return (
    <span className="text-xs text-muted-foreground">
      {days} day{days === 1 ? "" : "s"} till check-out
    </span>
  )
}

function stayRangeLabel(booking: OccupantBooking): string {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  return `${stayLabel(booking)} · ${fmt(booking.startDate)} – ${fmt(booking.endDate)}`
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
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

// A category tile inside the "Other Types" card — icon-led, same neutral
// treatment throughout so the row differentiates by shape, not colour.
function TypeRow({ icon: Icon, label, detail }: { icon: IconType; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

// One row inside the New Online Bookings alert card. Category is read from
// the icon + label; the destructive-tinted count is the one "needs action"
// signal, reused from the same token the outstanding-balance badges use.
function PendingBookingRow({
  href,
  icon: Icon,
  label,
  count,
}: {
  href: string
  icon: IconType
  label: string
  count: number
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3.5 text-sm transition-colors hover:border-primary/30 hover:bg-accent"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary ring-1 ring-border">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-muted-foreground">Click to review and confirm</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <Badge className="border-transparent bg-destructive/10 text-destructive tabular-nums">{count}</Badge>
        <ArrowRight
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>
    </Link>
  )
}

// Card shell shared by every list on the page: icon + title in the header,
// a count badge, and either the table/list content or an empty state.
function TableCard({
  title,
  icon: Icon,
  count,
  emptyMessage,
  action,
  children,
}: {
  title: string
  icon: IconType
  count: number
  emptyMessage: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          <CardTitle>{title}</CardTitle>
          <Badge variant="outline" className="tabular-nums">
            {count}
          </Badge>
        </div>
        {action}
      </CardHeader>
      <CardContent className={count === 0 ? "py-6" : "overflow-x-auto p-0"}>
        {count === 0 ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : children}
      </CardContent>
    </Card>
  )
}

function BookingTable({
  title,
  icon,
  emptyMessage,
  bookings,
  direction,
}: {
  title: string
  icon: IconType
  emptyMessage: string
  bookings: BookingListItem[]
  direction: "in" | "out"
}) {
  return (
    <TableCard title={title} icon={icon} count={bookings.length} emptyMessage={emptyMessage}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={TABLE_CELL}>Type</th>
            <th className={TABLE_CELL}>Customer</th>
            <th className={TABLE_CELL}>Dog(s)</th>
            <th className={TABLE_CELL}>Duration</th>
            <th className={TABLE_CELL}>Location</th>
            <th className={TABLE_CELL}>Status</th>
            <th className={TABLE_CELL}>Paid</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={`${direction}-${booking.id}`} className={TABLE_ROW}>
              <td className={TABLE_CELL}>
                <Badge variant="secondary">{booking.service.slug === "daycare" ? "Daycare" : "Home Boarding"}</Badge>
              </td>
              <td className={TABLE_CELL}>
                <Link href={`/admin/customers/${booking.customerId}`} className="font-medium hover:underline">
                  {fullName(booking.customer)}
                </Link>
              </td>
              <td className={TABLE_CELL}>{dogsCell(booking.bookingDogs)}</td>
              <td className={TABLE_CELL}>{stayLabel(booking)}</td>
              <td className={TABLE_CELL}>
                {booking.kennelUnit?.name ?? (booking.service.slug === "daycare" ? "Daycare" : "—")}
              </td>
              <td className={TABLE_CELL}>{statusCell(booking, direction)}</td>
              <td className={TABLE_CELL}>{paymentCell(booking)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
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
    pendingBoardingCount,
    pendingMeetGreetCount,
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
      include: occupantsInclude,
      orderBy: { endDate: "asc" },
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
      where: { service: { slug: "overnight-boarding" }, status: "PENDING_PAYMENT" },
    }),
    prisma.booking.count({
      where: { service: { slug: "meet-greet" }, status: "PENDING_PAYMENT" },
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
      orderBy: [{ surname: "asc" }, { forename: "asc" }],
    }),
    getSetting("daycare_max_capacity", "0"),
  ])

  const boardingService = services.find((s) => s.slug === "overnight-boarding")
  const meetGreetService = services.find((s) => s.slug === "meet-greet")
  const totalPendingConfirmation = pendingBoardingCount + pendingMeetGreetCount

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
    assignedTo: t.assignedTo ? { id: t.assignedTo.id, name: fullName(t.assignedTo) } : null,
  }))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Overview</h1>
          <DailyDatePicker date={toDateInputValue(date)} todayDate={toDateInputValue(realToday)} assignee={assignee} />
        </div>
      </div>

      {totalPendingConfirmation > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>New Online Bookings</CardTitle>
                <CardDescription>Click to review and confirm bookings</CardDescription>
              </div>
            </div>
            <Badge className="shrink-0 border-transparent bg-destructive/10 text-destructive tabular-nums">
              {totalPendingConfirmation} Total Pending
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingBoardingCount > 0 && (
              <PendingBookingRow
                href={
                  boardingService
                    ? `/admin/bookings?service=${boardingService.id}&status=PENDING_PAYMENT`
                    : "/admin/bookings"
                }
                icon={BedDouble}
                count={pendingBoardingCount}
                label={`${pendingBoardingCount} Home Boarding Booking${pendingBoardingCount === 1 ? "" : "s"} To Be Confirmed`}
              />
            )}
            {pendingMeetGreetCount > 0 && (
              <PendingBookingRow
                href={
                  meetGreetService
                    ? `/admin/bookings?service=${meetGreetService.id}&status=PENDING_PAYMENT`
                    : "/admin/bookings"
                }
                icon={Globe}
                count={pendingMeetGreetCount}
                label={`${pendingMeetGreetCount} Meet & Greet/Evaluation Booking${pendingMeetGreetCount === 1 ? "" : "s"} To Be Confirmed`}
              />
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 border-b">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BedDouble className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Home Boarding</CardTitle>
              <CardDescription>Real-time occupancy</CardDescription>
            </div>
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
          <CardHeader className="flex flex-row items-center gap-3 border-b">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy/10 text-navy">
              <Users className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Dog Daycare</CardTitle>
              <CardDescription>Real-time occupancy</CardDescription>
            </div>
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
          <CardHeader className="flex flex-row items-center gap-3 border-b">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <LayoutGrid className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Other Types</CardTitle>
              <CardDescription>Scheduled today</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <TypeRow
              icon={Footprints}
              label="Dog Walks"
              detail={`${dogWalkingBookings.length} booking${dogWalkingBookings.length === 1 ? "" : "s"} · ${dogWalkingDogIds.size} pet${dogWalkingDogIds.size === 1 ? "" : "s"}`}
            />
            <TypeRow
              icon={Globe}
              label="Meet & Greet"
              detail={`${meetGreetBookings.length} booking${meetGreetBookings.length === 1 ? "" : "s"}`}
            />
            <TypeRow
              icon={TreePine}
              label="Secure Forest Walks"
              detail={`${forestWalkBookings.length} booking${forestWalkBookings.length === 1 ? "" : "s"}`}
            />
          </CardContent>
        </Card>
      </div>

      <BookingTable
        title="Checking In Today"
        icon={DoorOpen}
        emptyMessage="No arrivals today."
        bookings={checkingIn}
        direction="in"
      />

      <TableCard
        title="Occupants"
        icon={Building2}
        count={boardingOccupantsTonight.length}
        emptyMessage="No dogs currently boarding."
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={TABLE_CELL}>Type</th>
              <th className={TABLE_CELL}>Customer</th>
              <th className={TABLE_CELL}>Dog(s)</th>
              <th className={TABLE_CELL}>Stay</th>
              <th className={TABLE_CELL}>Location</th>
              <th className={TABLE_CELL}>Status</th>
              <th className={TABLE_CELL}>Paid</th>
            </tr>
          </thead>
          <tbody>
            {boardingOccupantsTonight.map((booking) => (
              <tr key={`occupant-${booking.id}`} className={TABLE_ROW}>
                <td className={TABLE_CELL}>
                  <Badge variant="secondary">Home Boarding</Badge>
                </td>
                <td className={TABLE_CELL}>
                  <Link href={`/admin/customers/${booking.customerId}`} className="font-medium hover:underline">
                    {fullName(booking.customer)}
                  </Link>
                </td>
                <td className={TABLE_CELL}>{dogsCell(booking.bookingDogs)}</td>
                <td className={TABLE_CELL}>{stayRangeLabel(booking)}</td>
                <td className={TABLE_CELL}>{booking.kennelUnit?.name ?? "—"}</td>
                <td className={TABLE_CELL}>{checkoutCountdownCell(booking, date)}</td>
                <td className={TABLE_CELL}>{paymentCell(booking)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      <BookingTable
        title="Checking Out Today"
        icon={DoorClosed}
        emptyMessage="No departures today."
        bookings={checkingOut}
        direction="out"
      />

      <TableCard
        title="Scheduled Services"
        icon={ClipboardList}
        count={scheduledServiceBookings.length}
        emptyMessage="Nothing else scheduled today."
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={TABLE_CELL}>Booking</th>
              <th className={TABLE_CELL}>Customer</th>
              <th className={TABLE_CELL}>Dog(s)</th>
              <th className={TABLE_CELL}>Service</th>
              <th className={TABLE_CELL}>Time</th>
              <th className={TABLE_CELL}>Assigned to</th>
              <th className={TABLE_CELL}>Status</th>
            </tr>
          </thead>
          <tbody>
            {scheduledServiceBookings.map((booking: ScheduledServiceBooking) => {
              const stop = booking.vanRunStops[0]
              return (
                <tr key={booking.id} className={TABLE_ROW}>
                  <td className={TABLE_CELL}>
                    <Link href={`/admin/bookings/${booking.id}`} className="font-medium hover:underline">
                      {booking.id.slice(-6).toUpperCase()}
                    </Link>
                  </td>
                  <td className={TABLE_CELL}>{fullName(booking.customer)}</td>
                  <td className={TABLE_CELL}>{dogsCell(booking.bookingDogs)}</td>
                  <td className={TABLE_CELL}>{booking.service.name}</td>
                  <td className={TABLE_CELL}>{stop?.vanRun.startTime ?? booking.scheduledTime ?? "—"}</td>
                  <td className={TABLE_CELL}>{(stop?.vanRun.staff ? fullName(stop.vanRun.staff) : null) ?? (booking.assignedStaff ? fullName(booking.assignedStaff) : null) ?? "—"}</td>
                  <td className={TABLE_CELL}>
                    <Badge variant="outline">{booking.status.replace(/_/g, " ")}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableCard>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle>To-Do List</CardTitle>
          </div>
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
                  {fullName(u)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Filter
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <ToDoList tasks={toDoTasksForClient} staff={staffUsers.map((u) => ({ id: u.id, name: fullName(u) }))} />
        </CardContent>
      </Card>

      <TableCard
        title="Feeding"
        icon={UtensilsCrossed}
        count={feedingTasks.length}
        emptyMessage="No feeding tasks for today's in-house dogs."
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={TABLE_CELL}>Pet</th>
              <th className={TABLE_CELL}>Location</th>
              <th className={TABLE_CELL}>Instructions</th>
              <th className={TABLE_CELL}>Record</th>
            </tr>
          </thead>
          <tbody>
            {feedingTasks.map((task) => (
              <tr key={task.id} className={TABLE_ROW}>
                <td className={`${TABLE_CELL} font-medium`}>{task.dog.name}</td>
                <td className={TABLE_CELL}>{task.booking.kennelUnit?.name ?? task.booking.service.name}</td>
                <td className={`${TABLE_CELL} text-muted-foreground`}>{task.description}</td>
                <td className={TABLE_CELL}>
                  <CareTaskRecordButton
                    taskId={task.id}
                    completed={!!task.completedAt}
                    completedByName={task.completedBy ? fullName(task.completedBy) : null}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      <TableCard
        title="Medications"
        icon={Pill}
        count={medicationTasks.length}
        emptyMessage="No medication tasks for today's in-house dogs."
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={TABLE_CELL}>Pet</th>
              <th className={TABLE_CELL}>Location</th>
              <th className={TABLE_CELL}>Instructions</th>
              <th className={TABLE_CELL}>Record</th>
            </tr>
          </thead>
          <tbody>
            {medicationTasks.map((task) => (
              <tr key={task.id} className={TABLE_ROW}>
                <td className={`${TABLE_CELL} font-medium`}>{task.dog.name}</td>
                <td className={TABLE_CELL}>{task.booking.kennelUnit?.name ?? task.booking.service.name}</td>
                <td className={`${TABLE_CELL} text-muted-foreground`}>{task.description}</td>
                <td className={TABLE_CELL}>
                  <CareTaskRecordButton
                    taskId={task.id}
                    completed={!!task.completedAt}
                    completedByName={task.completedBy ? fullName(task.completedBy) : null}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  )
}
