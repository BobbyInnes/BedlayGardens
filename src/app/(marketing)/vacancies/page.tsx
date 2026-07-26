import type { Metadata } from "next"
import { getSetting } from "@/lib/settings"
import { sanitizeRichText } from "@/lib/sanitize-html"

export const metadata: Metadata = {
  title: "Vacancies",
  description: "Current job vacancies at Bedlay Gardens LTD.",
}

export const revalidate = 60

export default async function VacanciesPage() {
  const vacancies = await getSetting("vacancies", "")

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Vacancies</h1>
        <p className="mt-3 text-muted-foreground">Join the team at Bedlay Gardens LTD.</p>
      </div>

      {vacancies.trim() ? (
        <div
          className="space-y-4 text-sm leading-6 text-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_img]:inline [&_img]:align-middle"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(vacancies) }}
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          There are no current vacancies. Please check back soon.
        </p>
      )}
    </div>
  )
}
