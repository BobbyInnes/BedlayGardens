import type { TrialOutcome } from "@/generated/prisma/client"

export const TRIAL_OUTCOME_LABELS: Record<TrialOutcome, string> = {
  PASSED: "Passed",
  RETRY: "Needs another visit",
  NOT_SUITABLE: "Not suitable",
}
