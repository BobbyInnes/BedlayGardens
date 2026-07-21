// Default copy for the editable About Us page sections. Used as the seed
// values (prisma/seed.ts) and as the render-time fallback on /about when the
// `about_story` / `about_facility` settings are empty, so the sections are
// never blank. Admins edit the live values via Admin → Content.
export const DEFAULT_ABOUT_STORY =
  "<p>Bedlay Gardens LTD started as a small, family-run boarding business set in the countryside near Glasgow, built on the belief that every dog deserves space to roam, a real walk every day, and staff who know them by name. What began with a handful of accommodation units has grown into a full boarding, daycare, and dog walking service — without losing the personal touch our regulars have come to rely on.</p>" +
  "<p>We're proud that most of our bookings come from returning guests and word of mouth. Every dog that stays with us gets an individual care plan covering feeding, medication, and behaviour, followed closely by our team from check-in to check-out.</p>"

export const DEFAULT_ABOUT_FACILITY =
  "<p>Our site sits within enclosed private woodland, giving us the space for secure, escorted forest walks away from roads and livestock. Accommodation units are sized small, medium, and large, with sharing available for dogs from the same household, heated in winter and well-ventilated in summer.</p>" +
  "<p>A dedicated van and driver handle our dog walking collection and drop-off service, and our daycare area gives day visitors room to play and rest between activities.</p>"
