// What the "Evaluation Information" panel shows for a dog. A real Meet & Greet
// TrialVisit outcome always wins; otherwise an evaluation carried over from a
// customer import file (stored on the Dog itself) fills the panel in.

type TrialLike = { outcome: string | null; completedAt: Date | null; notes: string | null } | undefined

type DogLike = {
  importedEvaluationComplete: boolean
  importedEvaluationDate: Date | null
  importedEvaluationNotes: string | null
}

export type EvaluationView = {
  hasRecord: boolean
  fromImport: boolean
  outstanding: boolean
  complete: string
  passed: string
  date: string
  notes: string
}

export function evaluationView(dog: DogLike, trial: TrialLike): EvaluationView {
  if (trial?.outcome || !dog.importedEvaluationComplete) {
    return {
      hasRecord: !!trial,
      fromImport: false,
      outstanding: !trial?.outcome,
      complete: trial ? (trial.outcome ? "Yes" : "No") : "\u2014",
      passed: trial ? (trial.outcome && trial.outcome !== "NOT_SUITABLE" ? "Yes" : "No") : "\u2014",
      date: trial?.completedAt ? trial.completedAt.toLocaleDateString("en-GB") : "\u2014",
      notes: trial?.notes || "\u2014",
    }
  }
  return {
    hasRecord: true,
    fromImport: true,
    outstanding: false,
    complete: "Yes",
    passed: "Yes",
    date: dog.importedEvaluationDate ? dog.importedEvaluationDate.toLocaleDateString("en-GB") : "\u2014",
    notes: dog.importedEvaluationNotes || "\u2014",
  }
}
