import { prisma } from "@/lib/prisma"

/**
 * Whether a service actually gates on a passed Meet & Greet — same as
 * `service.requiresTrial`, except the meet-greet service itself is always
 * exempt regardless of that flag. requiresTrial is a plain admin-editable
 * setting (Admin -> Services -> "Requires trial"), and ticking it for
 * meet-greet itself creates a self-defeating booking flow — a dog would
 * need a passed Meet & Greet before it could book the Meet & Greet that
 * gets it one. Every place that checks requiresTrial to decide whether to
 * gate a booking should go through this instead, not the raw field.
 */
export function serviceRequiresTrial(service: { slug: string; requiresTrial: boolean }): boolean {
  return service.requiresTrial && service.slug !== "meet-greet"
}

/**
 * For a service that requires a trial visit, returns the names of dogs among
 * `dogIds` that don't have a PASSED TrialVisit yet. Empty array means the
 * booking can proceed. A dog with bypassMeetGreetChecks set (admin-only,
 * Admin -> Dogs) is skipped entirely regardless of trial history.
 *
 * `serviceId` isn't used to scope the check — TrialVisit isn't tied to a
 * specific service, so a passed trial (however it was earned) already
 * satisfies every requiresTrial service for that dog; kept as a parameter
 * only so call sites don't need to change if that ever becomes untrue.
 *
 * Deliberately does NOT exempt a dog just because it already has an earlier
 * booking of this same service (a bug fixed 2026-09-05 — that let a dog's
 * second-and-later booking of a requiresTrial service skip the check
 * entirely once any prior booking existed, regardless of whether a trial
 * had ever actually been passed).
 */
export async function checkTrialGate(_serviceId: string, dogIds: string[]): Promise<string[]> {
  const missing: string[] = []
  for (const dogId of dogIds) {
    const dog = await prisma.dog.findUnique({
      where: { id: dogId },
      select: { name: true, bypassMeetGreetChecks: true },
    })
    if (!dog || dog.bypassMeetGreetChecks) continue

    const passedTrial = await prisma.trialVisit.findFirst({ where: { dogId, outcome: "PASSED" } })
    if (!passedTrial) missing.push(dog.name)
  }
  return missing
}

/**
 * The standard customer-facing copy for "these dogs still need a passed
 * Meet & Greet" — shared so the wording is identical wherever the trial
 * gate blocks someone (the /book/[slug] page and the /book listing page).
 */
export function formatTrialGateMessage(missingNames: string[]): string {
  const plural = missingNames.length !== 1
  return `${missingNames.join(", ")} ${plural ? "haven't" : "hasn't"} had a Meet & Greet evaluation yet. This is mandatory before ${plural ? "they" : "it"} can book any service.`
}
