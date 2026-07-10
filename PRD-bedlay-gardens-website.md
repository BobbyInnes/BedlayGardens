# PRD — Bedlay Gardens Kennels Website & Booking Platform

**Version:** 1.0 · **Date:** 2026-07-10 · **Owner:** Robert
**Audience:** This document is written to be consumed directly by Claude Code as the build specification.

---

## 1. Overview

Bedlay Gardens Kennels is a dog boarding and daycare business. Build a full-stack website that serves as:

1. A public marketing site (services, gallery, about, contact)
2. An online booking system with real-time availability and Stripe payments
3. A customer portal (accounts, dog profiles, vaccination records, booking history)
4. A staff/admin dashboard (occupancy, check-in/out, daily care schedules)

### Goals

- Convert visitors into bookings without phone calls
- Reduce admin time: no double-entry, no paper vaccination checks
- Give staff a single daily view of who's in, arriving, and leaving

### Non-goals (v1)

- Grooming or retail services
- Native mobile apps (responsive web only)
- Multi-location support
- Cattery / non-dog boarding

---

## 2. Services Offered

| Service | Description | Pricing model |
|---|---|---|
| Overnight boarding | Multi-night kennel stays, per dog per night | Per night; discount for 2nd dog sharing a kennel |
| Daycare | Day visits, drop-off morning / pick-up evening | Per day; half-day rate optional |
| Secure forest walks | Escorted walks in enclosed private woodland, bookable as add-on to a stay or standalone session | Per session (30/60 min) |
| Dog walking | Regular dog walking service with **van collection and drop-off**: dogs are picked up from the customer's home, walked, and returned home | Per walk; discount for recurring weekly slots |

### Dog walking — van pickup/drop-off

- Customer supplies pickup address (defaults to account address, overridable per booking), access instructions, and preferred time window
- Admin defines van routes/runs (e.g. morning run, afternoon run) with a **max dogs per run** capacity; a walk booking consumes a run slot
- Staff view for each run: ordered pickup list with addresses, phone numbers, access notes, and dog details; tick off collected / walked / dropped-off per dog
- Customer receives email notification at pickup and drop-off (status ticked by staff)
- Admin can set a service area (list of postcodes/radius); bookings outside it are rejected with a friendly message and a contact prompt

All prices are admin-configurable — never hard-code prices. Currency: **GBP (£)**.

**Services are data, not code.** The three services above are the launch set, but admin must be able to add, amend, deactivate, and delete services (name, description, pricing model, capacity rules, active flag) without a code change. New services appear automatically on the public Services page and in the booking flow. Deleting a service with historical bookings soft-deletes (deactivates) it to preserve booking records.

---

## 3. Users & Roles

| Role | Description | Access |
|---|---|---|
| Visitor | Anonymous browser | Public pages, start booking flow |
| Customer | Registered dog owner | Portal: profiles, bookings, payments |
| Staff | Kennel workers | Dashboard: daily ops, check-in/out, care notes |
| Admin | Owner/manager | Everything: pricing, capacity, content, refunds, user management |

---

## 4. Tech Stack

- **Framework:** Next.js 15+ (App Router, TypeScript)
- **Styling:** Tailwind CSS; shadcn/ui components
- **Database:** PostgreSQL via Prisma ORM (use SQLite in dev if simpler; keep schema portable)
- **Auth:** Auth.js (NextAuth) — email/password + magic link; role field on user
- **Payments:** Stripe (Checkout Sessions + webhooks); Stripe Customer Portal for saved cards
- **Email:** Resend (or SMTP abstraction) for transactional email
- **Document extraction:** Claude API (vision) for reading vaccination certificates into structured data; process uploads asynchronously (queue or background route) so multiple simultaneous files don't block the UI
- **Image storage:** Local `/public` for gallery in v1; uploads (vaccination docs, dog photos) to S3-compatible storage or local disk behind an abstraction
- **Hosting target:** Vercel or any Node host; database on Neon/Supabase/RDS
- **Testing:** Vitest for unit, Playwright for the booking flow end-to-end

---

## 5. Public Marketing Site

### 5.1 Pages

- **Home** — hero image, value proposition ("Secure countryside boarding near Glasgow"), service cards, testimonials, CTA "Book a stay"
- **Services** — one section (or subpage) each for Boarding, Daycare, Secure Forest Walks with pricing table pulled from DB
- **Gallery** — grid of photos **and videos** with lightbox; categories (kennels, forest walks, van runs, happy guests); videos play inline (muted autoplay preview optional, tap to play with sound); fully admin-managed (see Media management, §8.2)
- **About Us** — story, team, facility description, photos
- **Contact Us** — form (name, email, phone, message) → emails admin + stored in DB; map embed, address, phone, opening hours
- **FAQs** — accordion; admin-editable
- **Legal** — privacy policy, terms & conditions, cookie notice (UK GDPR)

### 5.2 Requirements

- Mobile-first responsive; Lighthouse ≥ 90 performance/accessibility/SEO
- SEO: per-page metadata, OpenGraph, sitemap.xml, robots.txt, LocalBusiness schema.org JSON-LD
- Sticky "Book now" CTA on all public pages
- Warm, trustworthy visual tone; greens/earth tones suiting a countryside kennel; large photography

---

## 6. Booking System

### 6.1 Availability model

- Admin defines **kennel units** (name, size: small/medium/large, capacity for dogs sharing)
- Admin defines **daycare capacity** (max dogs per day) and **walk slots** (times, max dogs per walk)
- Availability = units/slots not already booked for the requested date range
- Admin can block dates (holidays, maintenance) per unit or site-wide

### 6.2 Customer booking flow

1. Select service (boarding / daycare / forest walk / dog walking)
2. Pick dates (check-in/check-out for boarding; date for daycare/walks) → live availability check. For dog walking: pick a van run with free capacity, confirm pickup address (service-area check) and access notes; option to repeat weekly
3. Select or create dog profile(s) — login/register required at this step
4. **Vaccination gate (hard requirement):** a dog can only be booked if it has valid, in-date vaccination records covering the full stay (through the end date). If records are missing or expired, the booking cannot proceed — the customer is prompted to add vaccination details (manual entry or certificate upload, see §7.1) and may only continue once the required vaccines are recorded as valid
5. Add-ons: forest walks attached to a boarding stay, extra playtime (admin-configurable add-on list)
6. Review: itemised price, deposit vs balance
7. Pay via Stripe Checkout → confirmation page + email

### 6.3 Payments (Stripe)

- **Deposit model:** configurable % (default 25%) at booking; balance auto-charged N days before check-in (default 7) using saved payment method, or payable in portal
- Stripe Checkout Session for initial payment; save payment method for balance
- Webhooks: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` → update booking/payment status idempotently
- Refunds issued from admin dashboard per cancellation policy
- **Cancellation policy (admin-configurable defaults):** free ≥ 14 days before; deposit forfeit < 14 days; no refund < 48 hours
- All amounts stored in pence (integers); VAT flag configurable

### 6.4 Booking states

`draft → pending_payment → confirmed → checked_in → checked_out → completed`
plus `cancelled_by_customer`, `cancelled_by_admin`, `no_show`. State transitions logged with timestamp + actor.

### 6.5 Notifications (email)

- Booking confirmation, payment receipt, balance-due reminder, balance-paid, check-in reminder (24h before, incl. what to bring), vaccination-expiry warning, cancellation/refund confirmation
- All templates admin-brandable (logo, footer)

---

## 7. Customer Portal

- **Dashboard:** upcoming bookings, action alerts (balance due, vaccination expiring)
- **Dog profiles:** name, breed, DOB, sex, neutered, weight, photo, feeding instructions, medication, behavioural notes, vet name/phone, emergency contact
- **Vaccination records:** per dog — vaccine type (DHPP, leptospirosis, kennel cough, rabies), date given, expiry date, certificate document. Staff verify; status: `unverified / verified / expired`

### 7.1 Vaccination entry — manual or automatic extraction

Two ways to add vaccination records:

1. **Manual entry:** form per vaccine (type, date given, expiry date), optional certificate attachment
2. **Certificate upload with automatic extraction:** customer uploads certificate image(s) or PDF(s) and the system extracts the vaccine details automatically:
   - Accepted formats: JPEG, PNG, HEIC, PDF (multi-page PDFs supported)
   - **Multiple files can be uploaded in one action** (drag-and-drop or multi-select); each file is queued and processed independently with per-file progress shown; one failed file must not block the others
   - Extraction uses an AI vision model (Claude API — send the image/PDF pages and request structured JSON: dog name, vaccine type(s), date given, expiry/due date, vet practice). A single certificate listing several vaccines produces one record per vaccine
   - Extracted details are shown to the customer in an editable review screen before saving — the customer confirms or corrects each field; nothing is saved unverified by the customer
   - Extraction accuracy matters: dates must be parsed to the correct day (handle UK date formats), and any field the model is unsure of is left blank and flagged for the customer to fill rather than guessed
   - If extraction fails entirely (illegible image), fall back gracefully to the manual form with the file attached
   - Original files are stored against the record for staff verification; staff compare extracted data to the certificate when marking `verified`
- **Bookings:** view, cancel (per policy), pay outstanding balance, add add-ons before check-in
- **Account:** contact details, address, password, saved cards (Stripe Customer Portal link), delete account (GDPR)

---

## 8. Staff / Admin Dashboard

### 8.1 Staff (daily ops)

- **Today view:** arrivals, departures, in-house dogs with kennel assignments
- **Check-in:** verify vaccination status (hard warning if unverified/expired), confirm belongings, assign/confirm kennel
- **Check-out:** confirm balance paid (block if outstanding), record departure
- **Care schedule:** per-dog daily feed/medication/walk checklist generated from profile; staff tick off, add notes
- **Walk roster:** today's forest-walk groups
- **Van runs:** today's dog-walking runs with ordered pickup/drop-off list (address, phone, access notes, dog details); staff mark each dog collected / walked / dropped-off, triggering customer notifications; mobile-first layout for use in the van
- **Incident log:** per dog, per stay; flags visible on future bookings

### 8.2 Admin (management)

- **Occupancy calendar:** month grid of kennels × days; click into any booking; drag to reassign kennels
- **Bookings management:** search/filter, create manual booking (phone customers), modify dates, cancel + refund via Stripe
- **Services management:** add, edit, deactivate, and delete services (name, description, pricing, capacity rules); changes reflect immediately on the public site and booking flow; services with historical bookings are soft-deleted
- **Pricing & capacity:** edit prices, deposit %, cancellation policy, kennel units, daycare capacity, walk slots, blocked dates, add-ons
- **Van run management:** create/edit van runs (date, time, capacity, assigned staff), reorder stops, define the dog-walking service area (postcodes/radius)
- **Staff management:** add, edit, and remove staff members (name, email, phone, role, photo, active flag); removed staff are deactivated (login disabled) rather than hard-deleted so audit history and care-task attribution survive; admin can reset staff passwords and promote/demote between STAFF and ADMIN
- **Vaccination verification queue**
- **Media management:** full CRUD for images **and videos** — upload (drag-and-drop, multiple at once), amend (caption, category, alt text, sort order, replace file), and delete. Images auto-resized/compressed to web-friendly sizes with thumbnails; videos either uploaded directly (MP4/WebM, admin-configurable size limit, poster frame auto-generated) or embedded via YouTube/Vimeo URL. Deleting media removes it everywhere it appears; media in use (e.g. homepage hero) prompts a confirmation. Applies to gallery, homepage hero, service pages, and about page imagery
- **Content management:** FAQs, testimonials, opening hours
- **Customers:** list, view history, notes, ban flag
- **Reports:** occupancy %, revenue by service, upcoming-week forecast; CSV export

---

## 9. Data Model (Prisma sketch)

```
User(id, email, passwordHash?, name, phone, address, role[CUSTOMER|STAFF|ADMIN], active, photoUrl?, stripeCustomerId?, createdAt)
Service(id, name, slug, description, pricingModel[PER_NIGHT|PER_DAY|PER_SESSION], basePricePence, active, sortOrder)
Dog(id, ownerId→User, name, breed, dob, sex, neutered, weightKg, photoUrl, feedingNotes, medicationNotes, behaviourNotes, vetName, vetPhone, emergencyContact)
VaccinationRecord(id, dogId, type, dateGiven, expiryDate, documentUrl, status[UNVERIFIED|VERIFIED|EXPIRED], verifiedById?, verifiedAt?)
KennelUnit(id, name, size, dogCapacity, active)
Booking(id, customerId, serviceId→Service, startDate, endDate, status, kennelUnitId?, totalPence, depositPence, balanceDueDate, cancellationReason?, createdAt)
BookingDog(bookingId, dogId)
BookingAddon(id, bookingId, addonId, quantity, pricePence)
Addon(id, name, description, pricePence, serviceId→Service, active)
Payment(id, bookingId, stripePaymentIntentId, type[DEPOSIT|BALANCE|REFUND], amountPence, status, createdAt)
WalkSlot(id, date, time, durationMin, maxDogs)
WalkBooking(id, walkSlotId, bookingId?, dogId)
VanRun(id, date, name, startTime, maxDogs, staffId?)
VanRunStop(id, vanRunId, bookingId, dogId, pickupAddress, accessNotes, sortOrder, status[PENDING|COLLECTED|WALKED|DROPPED_OFF], collectedAt?, droppedOffAt?)
CareTask(id, bookingId, dogId, date, type[FEED|MEDICATION|WALK|OTHER], description, completedById?, completedAt?, notes)
IncidentReport(id, bookingId, dogId, reportedById, description, severity, createdAt)
BlockedDate(id, date, kennelUnitId?, reason)
ContactMessage(id, name, email, phone, message, handled, createdAt)
Setting(key, value)  // deposit %, policy text, opening hours, prices
MediaItem(id, type[IMAGE|VIDEO|EMBED], url, thumbnailUrl?, caption, altText, category, sortOrder, usage[GALLERY|HERO|SERVICE|ABOUT], createdAt)
Testimonial(id, author, text, visible)
Faq(id, question, answer, sortOrder)
AuditLog(id, actorId, action, entity, entityId, meta, createdAt)
```

---

## 10. Non-Functional Requirements

- **Devices & responsiveness:** the entire application — public site, booking flow, customer portal, and staff/admin dashboards — must work fully on mobile phones, tablets, and desktop browsers. Responsive layouts at all breakpoints (~360px phone, ~768px tablet, 1024px+ desktop); touch-friendly targets (min 44px); staff dashboard usable one-handed on a phone during check-in/out; test on latest Chrome, Safari (incl. iOS), Firefox, and Edge
- **Security:** role-based route protection (middleware); server-side validation with Zod; rate-limit auth + contact endpoints; Stripe webhook signature verification; secrets in env vars only
- **GDPR (UK):** cookie consent, privacy policy, data export + account deletion, uploaded vet documents access-controlled (no public URLs)
- **Accessibility:** WCAG 2.1 AA
- **Concurrency:** availability check re-validated inside the payment-creation transaction to prevent double-booking; unique constraint on (kennelUnitId, date) occupancy
- **Timezone:** Europe/London everywhere; store dates as date-only where possible
- **Audit:** all admin/staff mutations recorded in AuditLog

---

## 11. Build Plan (suggested milestones for Claude Code)

1. **Scaffold:** Next.js + Prisma + Auth.js + Tailwind/shadcn; schema + seed script (kennel units, prices, sample content)
2. **Public site:** all marketing pages with DB-driven pricing/gallery/FAQs
3. **Auth + customer portal:** registration, dog profiles, vaccination uploads
4. **Booking engine:** availability logic + booking flow (unpaid), booking states
5. **Stripe:** checkout, webhooks, deposits/balance, refunds
6. **Staff dashboard:** today view, check-in/out, care schedule
7. **Admin:** occupancy calendar, pricing/capacity config, content management, reports
8. **Emails, polish, tests:** transactional emails, Playwright e2e on booking flow, Lighthouse pass
9. **Extended features (§13):** compatibility flags + agreement + trial gate first (safety/legal), then pupdates, waitlist, seasonal pricing, SMS, subscriptions, reviews, vouchers, abandoned-booking recovery, local SEO pages

Each milestone should end with a working, deployable app.

---

## 12. Acceptance Criteria (key flows)

- A visitor can complete a boarding booking with deposit payment in under 3 minutes on a mobile phone; all pages and dashboards render and function correctly on phone, tablet, and desktop
- Double-booking a kennel unit is impossible even under concurrent requests
- A dog without valid, in-date vaccinations covering the stay cannot be booked at all; a dog with an expired vaccination cannot be checked in without an admin override (logged)
- Uploading several vaccination certificates at once processes all of them, extracts vaccine type and dates correctly (UK date formats), presents an editable review before saving, and one unreadable file doesn't block the rest
- Check-out is blocked while a balance is outstanding
- Admin can change any price/policy without a code change
- Admin can create a new service (or edit/deactivate an existing one) and it appears on the public site and booking flow immediately
- Admin can add a staff member who can then log in to the staff dashboard, and deactivating them blocks login while preserving their history in audit/care records
- Admin can upload, edit (caption/category/order/replace), and delete images and videos, with changes visible on the public site immediately and no broken references after deletion
- All Stripe webhook events are handled idempotently (replaying an event causes no duplicate state change)
- Cancelling within policy triggers the correct automatic refund amount

---

## 13. Extended Features

All of the following are in scope. Build them after the core milestones (§11), in the order listed within each group unless dependencies dictate otherwise.

### 13.1 Customer-facing

- **Stay "pupdates":** from the care schedule, staff can attach a photo/video and short note to a dog's stay; customer is notified by email/SMS and views it in the portal. Media stored per stay; customer can download. Admin toggle for whether pupdates are included free or as a paid add-on
- **Recurring bookings (subscriptions):** weekly daycare and dog-walking slots as Stripe Subscriptions; customer picks day(s) + slot, pause/skip individual weeks (per policy notice period), cancel anytime from the portal; failed subscription payments pause the slot and notify customer + admin
- **Waitlist:** when a date/service is full, customer can join a waitlist; on cancellation the first-in-line customer is auto-notified with a time-limited claim link (e.g. 12h, configurable) before the next is offered; admin can view/reorder the waitlist
- **Meet & greet / trial day:** admin flag per service requiring a completed trial visit before a dog's first boarding; trial is a bookable slot (free or priced, admin-set); the booking flow enforces "trial completed" for first-time boarders; staff mark trial outcome (passed / needs another visit / not suitable) with notes
- **Reviews:** automatic post-stay email asking for a rating + review; reviews enter an admin moderation queue; approved reviews display on the site (feed the testimonials section) with rating aggregate for schema.org
- **Gift vouchers / account credit:** vouchers purchasable via Stripe (fixed amounts or custom), delivered by email with a code; redeemable at checkout against any service; partial redemption leaves account credit; admin can issue goodwill credit manually

### 13.2 Operational

- **SMS notifications (Twilio):** SMS channel alongside email for pickup/drop-off, balance reminders, check-in reminders, and waitlist offers; per-customer notification preferences (email / SMS / both); all message sends logged
- **Peak/seasonal pricing:** admin defines date-range price rules per service (e.g. +25% Christmas period) and minimum-stay rules for peak windows; booking flow shows the itemised seasonal rate; rules never apply retroactively to confirmed bookings
- **Vet emergency info pack:** one-tap printable/PDF sheet per in-house dog — owner contacts, emergency contact, vet practice details, medications, allergies, behavioural warnings; accessible from the staff Today view and kennel occupancy calendar
- **Dog compatibility flags:** per-dog flags (not dog-sociable, no shared kennel, no group walks, resource guarding, escape risk); flags automatically block shared-kennel assignment and group walk/van-run inclusion, with visible warnings on staff views; admin override is logged
- **Digital boarding agreement:** T&Cs / liability waiver presented at first booking (and re-presented when admin publishes a new version); customer e-signs (typed name + checkbox + timestamp + IP); signed PDF stored against the customer; booking cannot be confirmed without a current signed agreement

### 13.3 Business & growth

- **Abandoned booking recovery:** bookings left at `pending_payment` for N hours (configurable) trigger a reminder email with a resume link; a second nudge after 24h; stops immediately if completed or cancelled; opt-out honoured
- **Google Business / local SEO:** LocalBusiness + AggregateRating schema, Google Maps embed on contact page, per-service landing pages targeting local search terms (e.g. "dog boarding near Glasgow", "dog walking Chryston"), review link to the Google Business profile in post-stay emails

### 13.4 Data model additions

```
Pupdate(id, bookingId, dogId, staffId, mediaItemId?, note, createdAt)
Subscription(id, customerId, serviceId, dogId, weekdays, slot, stripeSubscriptionId, status, pausedUntil?)
WaitlistEntry(id, customerId, serviceId, dogId, date, createdAt, status[WAITING|OFFERED|CLAIMED|EXPIRED], offerExpiresAt?)
TrialVisit(id, dogId, bookingId, outcome[PASSED|RETRY|NOT_SUITABLE]?, notes, completedAt?)
Review(id, customerId, bookingId, rating, text, status[PENDING|APPROVED|REJECTED], createdAt)
Voucher(id, code, amountPence, remainingPence, purchaserId?, recipientEmail?, expiresAt?, status)
CreditLedger(id, customerId, amountPence, reason, bookingId?, createdAt)
PriceRule(id, serviceId, startDate, endDate, multiplier?, overridePricePence?, minNights?, label)
DogFlag(id, dogId, type[NOT_DOG_SOCIABLE|NO_SHARED_KENNEL|NO_GROUP_WALKS|RESOURCE_GUARDING|ESCAPE_RISK], notes)
Agreement(id, version, text, publishedAt, active)
SignedAgreement(id, agreementId, customerId, signedName, signedAt, ipAddress, pdfUrl)
NotificationPreference(customerId, channel[EMAIL|SMS|BOTH], perType overrides)
MessageLog(id, customerId, channel, type, payload, sentAt, status)
```

### 13.5 Acceptance criteria additions

- A dog flagged "no shared kennel" can never be assigned to an occupied shared unit, and flagged dogs never appear in group walk/van rosters without a logged admin override
- A first-time boarding booking cannot be confirmed until the trial visit is marked passed (where the service requires one) and a current agreement is signed
- A cancellation on a full date offers the slot to the top waitlist entry automatically and expires the offer on schedule
- Seasonal price rules apply to new bookings in the window and never alter existing confirmed bookings
- Voucher redemption, partial redemption, and credit balances reconcile exactly with Stripe records

---

## 14. Open Questions

- Exact prices, deposit %, and cancellation windows (placeholders configurable via admin — confirm before launch)
- Whether balance should auto-charge or be manual-pay only (default: auto-charge with email notice)
- Photo assets and copy for gallery/about (use tasteful placeholders until provided)
- Domain, hosting account, Stripe account details (env-var driven)
