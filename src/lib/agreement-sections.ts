// The fixed set of named sections an admin can compose the boarding
// agreement from — kept as a closed list (rather than free text) so every
// published agreement uses consistent, expected section names.
export const AGREEMENT_SECTION_NAMES = [
  "1. Cancellations, Rescheduling & Refunds",
  "2. Booking Terms & Opening Hours",
  "3. Health & Fitness to Attend",
  "4. Behaviour, Welfare & Early Termination",
  "5. Force Majeure",
  "6. General Terms & Injuries",
  "7. Client Acknowledgement",
] as const
