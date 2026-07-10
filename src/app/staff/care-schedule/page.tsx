import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { ensureCareTasksForToday } from "@/lib/care-tasks"
import { startOfDay } from "@/lib/dates"
import { CareTaskItem } from "@/components/staff/care-task-item"

export const metadata: Metadata = {
  title: "Care Schedule | Staff",
}

export default async function StaffCareSchedulePage() {
  await ensureCareTasksForToday()

  const date = startOfDay(new Date())
  const tasks = await prisma.careTask.findMany({
    where: { date },
    include: { dog: true, completedBy: true, booking: { include: { customer: true } } },
    orderBy: [{ dog: { name: "asc" } }, { type: "asc" }],
  })

  const byDog = new Map<string, typeof tasks>()
  for (const task of tasks) {
    const list = byDog.get(task.dogId) ?? []
    list.push(task)
    byDog.set(task.dogId, list)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Care Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {byDog.size > 0 ? (
        <div className="space-y-6">
          {Array.from(byDog.entries()).map(([dogId, dogTasks]) => (
            <section key={dogId} className="space-y-2">
              <h2 className="font-semibold">
                {dogTasks[0].dog.name}{" "}
                <span className="font-normal text-muted-foreground">
                  — {dogTasks[0].booking.customer.name}
                </span>
              </h2>
              <ul className="space-y-2">
                {dogTasks.map((task) => (
                  <CareTaskItem
                    key={task.id}
                    taskId={task.id}
                    type={task.type}
                    description={task.description}
                    completed={!!task.completedAt}
                    completedByName={task.completedBy?.name ?? null}
                    notes={task.notes}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No dogs in-house today.</p>
      )}
    </div>
  )
}
