// Fixed list of salutation options offered on the create-account form (and
// anywhere else a title/salutation is captured) — not admin-editable, per
// Bobby's 2026-08-25 request.
export const SALUTATIONS = ["Mr", "Mrs", "Miss", "Ms", "Dr", "Rev"] as const
export type Salutation = (typeof SALUTATIONS)[number]
