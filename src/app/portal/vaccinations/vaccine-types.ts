// Fixed vaccine rows the manual form lets someone tick and fill in together,
// alongside a free-text "Other" row for anything not listed here. Shared between
// the client form and the "use server" action (which can only export functions).
// maxValidityYears caps how far the expiry date can sit after the from date,
// matching how long each vaccine is typically valid for. maxFromDateAgeYears
// caps how far in the past the from date itself can be — same window as
// maxValidityYears for each of these.
export const FIXED_VACCINES = [
  { id: "DHPP", type: "DHPP", maxValidityYears: 3, maxFromDateAgeYears: 3 },
  { id: "Leptospirosis", type: "Leptospirosis", maxValidityYears: 1, maxFromDateAgeYears: 1 },
  { id: "KennelCough", type: "Kennel Cough", maxValidityYears: 1, maxFromDateAgeYears: 1 },
] as const
