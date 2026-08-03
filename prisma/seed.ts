/**
 * prisma/seed.ts
 *
 * Test data for Bedlay Gardens — covers every flow called out in the PRD so you
 * can click through the site and see each scenario without booking things by hand.
 *
 * HOW TO USE (ask Claude Code to do this for you if you're not sure):
 *   1. Copy this file to  prisma/seed.ts  in your project.
 *   2. Make sure prisma/schema.prisma field/model names match what's used here.
 *      (This follows the PRD's schema sketch in §9/§13.4 — if your real schema
 *      differs slightly, e.g. different enum names, Claude Code can adjust this
 *      file to match in a few seconds.)
 *   3. Add to package.json:
 *        "prisma": { "seed": "ts-node prisma/seed.ts" }
 *   4. Run:  npx prisma migrate reset   (applies schema + runs this seed)
 *      or:   npx prisma db seed         (just runs the seed on existing schema)
 *
 * WHAT'S IN HERE — a checklist of flows you can now test:
 *
 *   Login as:
 *     - admin@bedlaygardens.test   / Password123!   (ADMIN)
 *     - staff@bedlaygardens.test   / Password123!   (STAFF)
 *     - alice@example.test         / Password123!   (CUSTOMER — everything valid)
 *     - bob@example.test           / Password123!   (CUSTOMER — expired vaccination, failed balance payment)
 *     - carol@example.test         / Password123!   (CUSTOMER — no vaccination on file, on waitlist)
 *     - dave@example.test          / Password123!   (CUSTOMER — compatibility flags, outside service area)
 *     - erin@example.test          / Password123!   (CUSTOMER — voucher + account credit, active subscription)
 *
 *   Bookings covering every status in §6.4:
 *     draft, pending_payment, confirmed, checked_in, checked_out, completed,
 *     cancelled_by_customer, cancelled_by_admin, no_show
 *
 *   Payments (§6.3) — every type and status so the admin payments view and
 *   customer receipts aren't empty, and so refund/failure handling can be
 *   clicked through:
 *     DEPOSIT succeeded, BALANCE succeeded, BALANCE failed (card declined),
 *     BALANCE pending (webhook not yet received), REFUND succeeded (full),
 *     REFUND succeeded (partial, per cancellation policy)
 *     — plus a note on testing Stripe webhook idempotency (see comments below).
 *
 *   Validation / edge-case data (see "VALIDATION EDGE CASES" section):
 *     - vaccination gate: expired record, missing record entirely
 *     - service area check: postcode outside the allowed list
 *     - double-booking prevention: two bookings that WOULD overlap the same
 *       kennel/date if your unique constraint isn't working
 *     - trial-visit gate: first-time boarder without a passed trial
 *     - agreement gate: customers who have not e-signed
 *     - abandoned booking: a pending_payment booking left stale > 24h, to
 *       test the reminder-email job
 *     - dog compatibility flags blocking shared kennels / group walks
 *     - fully-booked kennel (no availability response)
 *     - voucher partial redemption + account credit reconciliation
 *     - seasonal price rule that must NOT alter an already-confirmed booking
 *     - subscription with a paused week and a failed payment
 *     - review in each moderation state (pending / approved / rejected)
 *
 * Note on Stripe test payment IDs: everything below uses fake IDs like
 * "pi_test_..." — these are NOT real Stripe objects. If you want to test the
 * actual webhook handlers end-to-end, use Stripe's test mode + CLI
 * (stripe trigger payment_intent.succeeded) against real Checkout Sessions
 * rather than relying on this seed data, which only fills the database.
 */

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@/generated/prisma/client';
import bcrypt from 'bcryptjs';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
};

const hoursFromNow = (n: number) => {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d;
};

async function main() {
  console.log('Seeding test data…');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ---------------------------------------------------------------------
  // USERS
  // ---------------------------------------------------------------------
  const admin = await prisma.user.create({
    data: { email: 'admin@bedlaygardens.test', passwordHash, name: 'Robert Innes', phone: '07956301170', addressLine1: 'Bedlay Gardens, Cumbernauld Road, Chryston', addressCity: 'Glasgow', addressPostcode: 'G69 9HP', role: 'ADMIN', active: true },
  });

  const staff = await prisma.user.create({
    data: { email: 'staff@bedlaygardens.test', passwordHash, name: 'Jamie Staff', phone: '07700900001', role: 'STAFF', active: true },
  });

  await prisma.user.create({
    data: { email: 'formerstaff@bedlaygardens.test', passwordHash, name: 'Former Employee', phone: '07700900002', role: 'STAFF', active: false }, // deactivated: login blocked, history preserved
  });

  const alice = await prisma.user.create({
    data: { email: 'alice@example.test', passwordHash, name: 'Alice Walker', phone: '07700900010', addressLine1: '10 Example Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA', role: 'CUSTOMER', active: true, stripeCustomerId: 'cus_test_alice' },
  });

  const bob = await prisma.user.create({
    data: { email: 'bob@example.test', passwordHash, name: 'Bob Fraser', phone: '07700900011', addressLine1: '22 Example Street', addressCity: 'Glasgow', addressPostcode: 'G2 2BB', role: 'CUSTOMER', active: true, stripeCustomerId: 'cus_test_bob' },
  });

  const carol = await prisma.user.create({
    data: { email: 'carol@example.test', passwordHash, name: 'Carol Mitchell', phone: '07700900012', addressLine1: '5 Example Road', addressCity: 'Chryston', addressPostcode: 'G69 9AA', role: 'CUSTOMER', active: true },
  });

  const dave = await prisma.user.create({
    data: { email: 'dave@example.test', passwordHash, name: 'Dave Thomson', phone: '07700900013', addressLine1: '99 Outside Area Lane', addressCity: 'Edinburgh', addressPostcode: 'EH1 1AA', role: 'CUSTOMER', active: true }, // EH postcode: outside service area on purpose
  });

  const erin = await prisma.user.create({
    data: { email: 'erin@example.test', passwordHash, name: 'Erin Campbell', phone: '07700900014', addressLine1: '3 Example Crescent', addressCity: 'Muirhead', addressPostcode: 'G69 9XY', role: 'CUSTOMER', active: true, stripeCustomerId: 'cus_test_erin' },
  });

  // A soft-deleted / GDPR-deleted account, to test account deletion still
  // preserves referential integrity for past bookings/audit
  const deletedCustomer = await prisma.user.create({
    data: { email: 'deleted-user-4471@bedlaygardens.test', passwordHash, name: '[deleted]', role: 'CUSTOMER', active: false },
  });

  // ---------------------------------------------------------------------
  // SERVICES
  // ---------------------------------------------------------------------
  const meetGreet = await prisma.service.create({ data: { name: 'Meet & Greet', slug: 'meet-greet', description: 'First step before booking — a chance to make sure the fit is right', pricingModel: 'PER_SESSION', basePricePence: 1500, active: true, sortOrder: 1 } });
  const daycare = await prisma.service.create({ data: { name: 'Day Care', slug: 'daycare', description: 'Full day, or half day AM/PM', pricingModel: 'PER_DAY', basePricePence: 2600, active: true, sortOrder: 2 } });
  const forestWalk = await prisma.service.create({ data: { name: 'Secure Forest Walks', slug: 'secure-forest-walks', description: 'Private-hire securely enclosed woodland for off-lead exercise', pricingModel: 'PER_SESSION', basePricePence: 1500, active: true, sortOrder: 3 } });
  const boarding = await prisma.service.create({ data: { name: 'Home Boarding', slug: 'overnight-boarding', description: 'Overnight stay', pricingModel: 'PER_NIGHT', basePricePence: 5000, active: true, sortOrder: 4 } });
  const dogWalking = await prisma.service.create({ data: { name: 'Dog Walking (Van Collection)', slug: 'dog-walking', description: 'Picked up from home, walked, and returned', pricingModel: 'PER_SESSION', basePricePence: 1200, active: true, sortOrder: 5 } });
  await prisma.service.create({ data: { name: 'Weekend Grooming (retired)', slug: 'weekend-grooming', description: 'No longer offered', pricingModel: 'PER_SESSION', basePricePence: 3000, active: false, sortOrder: 99 } }); // soft-deleted service test

  const extraPlaytime = await prisma.addon.create({ data: { name: 'Extra Playtime', description: '15 extra minutes of one-to-one play', pricePence: 500, serviceId: boarding.id, active: true } });

  // Seasonal price rule (§13.2) — must apply to NEW bookings only, never to
  // bookingConfirmed below, which is created outside this window on purpose
  await prisma.priceRule.create({
    data: { serviceId: boarding.id, startDate: new Date(new Date().getFullYear(), 11, 20), endDate: new Date(new Date().getFullYear(), 11, 31), multiplier: 1.25, minNights: 3, label: 'Christmas peak pricing' },
  });

  // ---------------------------------------------------------------------
  // KENNEL UNITS + BLOCKED DATES
  // ---------------------------------------------------------------------
  const kennelSmall1 = await prisma.kennelUnit.create({ data: { name: 'Small Kennel 1', size: 'SMALL', dogCapacity: 1, active: true } });
  const kennelMedium1 = await prisma.kennelUnit.create({ data: { name: 'Medium Kennel 1', size: 'MEDIUM', dogCapacity: 2, active: true } });
  const kennelLarge1 = await prisma.kennelUnit.create({ data: { name: 'Large Kennel 1 (fully booked next month)', size: 'LARGE', dogCapacity: 1, active: true } });

  await prisma.blockedDate.create({ data: { date: new Date(new Date().getFullYear(), 11, 25), reason: 'Christmas Day — closed' } });

  // ---------------------------------------------------------------------
  // DOGS
  // ---------------------------------------------------------------------
  const aliceDog = await prisma.dog.create({ data: { ownerId: alice.id, name: 'Bramble', breed: 'Cockapoo', dob: new Date(2021, 3, 12), sex: 'FEMALE', neutered: true, weightKg: 9.5, feedingNotes: 'Half cup dry food twice a day', vetName: 'Chryston Vets', vetPhone: '01417001234', emergencyContact: 'Alice Walker 07700900010' } });
  const bobDog = await prisma.dog.create({ data: { ownerId: bob.id, name: 'Max', breed: 'Labrador', dob: new Date(2019, 7, 1), sex: 'MALE', neutered: true, weightKg: 28, feedingNotes: 'One and a half cups twice daily', vetName: 'Glasgow Vet Clinic', vetPhone: '01417005678', emergencyContact: 'Bob Fraser 07700900011' } });
  const carolDog = await prisma.dog.create({ data: { ownerId: carol.id, name: 'Poppy', breed: 'Spaniel', dob: new Date(2022, 1, 20), sex: 'FEMALE', neutered: false, weightKg: 12, vetName: 'Chryston Vets', vetPhone: '01417001234', emergencyContact: 'Carol Mitchell 07700900012' } });
  const daveDog = await prisma.dog.create({ data: { ownerId: dave.id, name: 'Rex', breed: 'German Shepherd', dob: new Date(2020, 5, 5), sex: 'MALE', neutered: true, weightKg: 34, behaviourNotes: 'Reactive to unfamiliar dogs — see compatibility flags', vetName: 'Edinburgh Vets', vetPhone: '01315559999', emergencyContact: 'Dave Thomson 07700900013' } });
  const erinDog = await prisma.dog.create({ data: { ownerId: erin.id, name: 'Luna', breed: 'Border Collie', dob: new Date(2021, 9, 9), sex: 'FEMALE', neutered: true, weightKg: 18, vetName: 'Muirhead Vets', vetPhone: '01417009999', emergencyContact: 'Erin Campbell 07700900014' } });

  // ---------------------------------------------------------------------
  // VACCINATION RECORDS
  // ---------------------------------------------------------------------
  await prisma.vaccinationRecord.create({ data: { dogId: aliceDog.id, type: 'DHPP', dateGiven: daysFromNow(-200), expiryDate: daysFromNow(165), status: 'VERIFIED', verifiedById: staff.id, verifiedAt: daysFromNow(-190) } });
  await prisma.vaccinationRecord.create({ data: { dogId: aliceDog.id, type: 'KENNEL_COUGH', dateGiven: daysFromNow(-100), expiryDate: daysFromNow(265), status: 'VERIFIED', verifiedById: staff.id, verifiedAt: daysFromNow(-95) } });
  await prisma.vaccinationRecord.create({ data: { dogId: aliceDog.id, type: 'LEPTOSPIROSIS', dateGiven: daysFromNow(-100), expiryDate: daysFromNow(265), status: 'VERIFIED', verifiedById: staff.id, verifiedAt: daysFromNow(-95) } });
  await prisma.vaccinationRecord.create({ data: { dogId: bobDog.id, type: 'DHPP', dateGiven: daysFromNow(-400), expiryDate: daysFromNow(-35), status: 'EXPIRED' } }); // EXPIRED: gate must block
  // carolDog: intentionally has NO record at all — gate must also block this case
  await prisma.vaccinationRecord.create({ data: { dogId: daveDog.id, type: 'RABIES', dateGiven: daysFromNow(-10), expiryDate: daysFromNow(720), status: 'UNVERIFIED', documentUrl: '/uploads/sample-cert-rex.pdf' } }); // sits in staff verification queue
  await prisma.vaccinationRecord.create({ data: { dogId: erinDog.id, type: 'DHPP', dateGiven: daysFromNow(-350), expiryDate: daysFromNow(15), status: 'VERIFIED', verifiedById: staff.id, verifiedAt: daysFromNow(-340) } }); // expiring soon: tests the expiry-warning email

  // ---------------------------------------------------------------------
  // DOG COMPATIBILITY FLAGS
  // ---------------------------------------------------------------------
  await prisma.dogFlag.create({ data: { dogId: daveDog.id, type: 'NOT_DOG_SOCIABLE', notes: 'Reactive on lead with unfamiliar dogs' } });
  await prisma.dogFlag.create({ data: { dogId: daveDog.id, type: 'NO_SHARED_KENNEL', notes: 'Must have own kennel' } });

  // ---------------------------------------------------------------------
  // BOARDING AGREEMENT
  // ---------------------------------------------------------------------
  const agreement = await prisma.agreement.create({ data: { version: '1', text: 'Standard boarding terms & liability waiver (placeholder text).', publishedAt: new Date(), active: true } });
  await prisma.signedAgreement.create({ data: { agreementId: agreement.id, customerId: alice.id, signedName: 'Alice Walker', signedAt: daysFromNow(-30), ipAddress: '203.0.113.5', pdfUrl: '/uploads/agreements/alice-signed.pdf' } });
  await prisma.signedAgreement.create({ data: { agreementId: agreement.id, customerId: erin.id, signedName: 'Erin Campbell', signedAt: daysFromNow(-60), ipAddress: '203.0.113.9', pdfUrl: '/uploads/agreements/erin-signed.pdf' } });
  // Bob, Carol, Dave deliberately have NOT signed — tests "booking blocked, needs signature" path

  // ---------------------------------------------------------------------
  // BOOKINGS — one per status in §6.4
  // ---------------------------------------------------------------------
  const bookingDraft = await prisma.booking.create({ data: { customerId: carol.id, serviceId: daycare.id, startDate: daysFromNow(10), endDate: daysFromNow(10), status: 'DRAFT', totalPence: 2600, depositPence: 0 } });

  // Pending payment, created 30 hours ago and untouched — this is the
  // "abandoned booking" case for the reminder-email job (§13.3, N hours config)
  const bookingPendingPayment = await prisma.booking.create({ data: { customerId: bob.id, serviceId: boarding.id, startDate: daysFromNow(20), endDate: daysFromNow(23), status: 'PENDING_PAYMENT', totalPence: 15000, depositPence: 3750, balanceDueDate: daysFromNow(13), createdAt: hoursFromNow(-30) } });

  const bookingConfirmed = await prisma.booking.create({ data: { customerId: alice.id, serviceId: boarding.id, startDate: daysFromNow(7), endDate: daysFromNow(10), status: 'CONFIRMED', kennelUnitId: kennelMedium1.id, totalPence: 15000, depositPence: 3750, balanceDueDate: daysFromNow(0) } });

  // Balance due today, but the auto-charge FAILED (card declined) — tests
  // the "outstanding balance blocks checkout" and the failed-payment email
  const bookingBalanceFailed = await prisma.booking.create({ data: { customerId: bob.id, serviceId: boarding.id, startDate: daysFromNow(2), endDate: daysFromNow(5), status: 'CONFIRMED', kennelUnitId: kennelSmall1.id, totalPence: 15000, depositPence: 3750, balanceDueDate: daysFromNow(-1) } });

  const bookingCheckedIn = await prisma.booking.create({ data: { customerId: alice.id, serviceId: boarding.id, startDate: daysFromNow(-1), endDate: daysFromNow(2), status: 'CHECKED_IN', kennelUnitId: kennelLarge1.id, totalPence: 15000, depositPence: 15000 } });

  const bookingCheckedOut = await prisma.booking.create({ data: { customerId: alice.id, serviceId: daycare.id, startDate: daysFromNow(-5), endDate: daysFromNow(-5), status: 'CHECKED_OUT', totalPence: 1500, depositPence: 1500 } });

  const bookingCompleted = await prisma.booking.create({ data: { customerId: erin.id, serviceId: forestWalk.id, startDate: daysFromNow(-14), endDate: daysFromNow(-14), status: 'COMPLETED', totalPence: 1500, depositPence: 1500 } });

  // Cancelled WITHIN free-cancellation window (>=14 days out) — full refund
  const bookingCancelledFreeWindow = await prisma.booking.create({ data: { customerId: erin.id, serviceId: daycare.id, startDate: daysFromNow(20), endDate: daysFromNow(20), status: 'CANCELLED_BY_CUSTOMER', totalPence: 2600, depositPence: 650, cancellationReason: 'Change of plans' } });

  // Cancelled WITHIN the deposit-forfeit window (<14 days out) — partial refund test
  const bookingCancelledForfeitWindow = await prisma.booking.create({ data: { customerId: bob.id, serviceId: daycare.id, startDate: daysFromNow(5), endDate: daysFromNow(5), status: 'CANCELLED_BY_CUSTOMER', totalPence: 2600, depositPence: 650, cancellationReason: 'Illness' } });

  const bookingCancelledByAdmin = await prisma.booking.create({ data: { customerId: carol.id, serviceId: boarding.id, startDate: daysFromNow(18), endDate: daysFromNow(20), status: 'CANCELLED_BY_ADMIN', totalPence: 10000, depositPence: 2500, cancellationReason: 'Vaccination requirement not met in time' } });

  const bookingNoShow = await prisma.booking.create({ data: { customerId: bob.id, serviceId: daycare.id, startDate: daysFromNow(-3), endDate: daysFromNow(-3), status: 'NO_SHOW', totalPence: 1500, depositPence: 1500 } });

  // Fully booked large kennel next month — for testing "no availability" AND
  // as the same-kennel/overlapping-date pair Claude Code should try to
  // double-book in a Playwright test to prove the unique constraint holds
  const bookingLargeKennelFull = await prisma.booking.create({ data: { customerId: alice.id, serviceId: boarding.id, startDate: daysFromNow(30), endDate: daysFromNow(35), status: 'CONFIRMED', kennelUnitId: kennelLarge1.id, totalPence: 25000, depositPence: 6250 } });

  await prisma.bookingDog.createMany({
    data: [
      { bookingId: bookingDraft.id, dogId: carolDog.id },
      { bookingId: bookingPendingPayment.id, dogId: bobDog.id },
      { bookingId: bookingConfirmed.id, dogId: aliceDog.id },
      { bookingId: bookingBalanceFailed.id, dogId: bobDog.id },
      { bookingId: bookingCheckedIn.id, dogId: aliceDog.id },
      { bookingId: bookingCheckedOut.id, dogId: aliceDog.id },
      { bookingId: bookingCompleted.id, dogId: erinDog.id },
      { bookingId: bookingCancelledFreeWindow.id, dogId: erinDog.id },
      { bookingId: bookingCancelledForfeitWindow.id, dogId: bobDog.id },
      { bookingId: bookingCancelledByAdmin.id, dogId: carolDog.id },
      { bookingId: bookingNoShow.id, dogId: bobDog.id },
      { bookingId: bookingLargeKennelFull.id, dogId: aliceDog.id },
    ],
  });

  await prisma.bookingAddon.create({ data: { bookingId: bookingConfirmed.id, addonId: extraPlaytime.id, quantity: 1, pricePence: 500 } });

  // ---------------------------------------------------------------------
  // PAYMENTS — every type × status combination worth testing
  // ---------------------------------------------------------------------
  // Successful deposits
  await prisma.payment.create({ data: { bookingId: bookingConfirmed.id, stripePaymentIntentId: 'pi_test_confirmed_deposit', type: 'DEPOSIT', amountPence: 3750, status: 'SUCCEEDED' } });
  await prisma.payment.create({ data: { bookingId: bookingCheckedIn.id, stripePaymentIntentId: 'pi_test_checkedin_deposit', type: 'DEPOSIT', amountPence: 15000, status: 'SUCCEEDED' } });
  await prisma.payment.create({ data: { bookingId: bookingLargeKennelFull.id, stripePaymentIntentId: 'pi_test_largekennel_deposit', type: 'DEPOSIT', amountPence: 6250, status: 'SUCCEEDED' } });

  // Deposit still pending — webhook not received yet (tests "awaiting confirmation" UI)
  await prisma.payment.create({ data: { bookingId: bookingPendingPayment.id, stripePaymentIntentId: 'pi_test_pending_deposit', type: 'DEPOSIT', amountPence: 3750, status: 'PENDING' } });

  // Balance auto-charge FAILED — card declined (tests dunning email + portal "pay now" prompt)
  await prisma.payment.create({ data: { bookingId: bookingBalanceFailed.id, stripePaymentIntentId: 'pi_test_balance_failed', type: 'BALANCE', amountPence: 11250, status: 'FAILED' } });
  await prisma.payment.create({ data: { bookingId: bookingBalanceFailed.id, stripePaymentIntentId: 'pi_test_balance_deposit', type: 'DEPOSIT', amountPence: 3750, status: 'SUCCEEDED' } });

  // Balance paid successfully (tests "balance-paid" confirmation email + checkout not blocked)
  await prisma.payment.create({ data: { bookingId: bookingCheckedOut.id, stripePaymentIntentId: 'pi_test_checkedout_deposit', type: 'DEPOSIT', amountPence: 1500, status: 'SUCCEEDED' } });

  // Refunds: full (free-cancellation window) and partial (forfeit window)
  await prisma.payment.create({ data: { bookingId: bookingCancelledFreeWindow.id, stripePaymentIntentId: 'pi_test_deposit_free_cancel', type: 'DEPOSIT', amountPence: 650, status: 'SUCCEEDED' } });
  await prisma.payment.create({ data: { bookingId: bookingCancelledFreeWindow.id, stripePaymentIntentId: 're_test_full_refund', type: 'REFUND', amountPence: 650, status: 'SUCCEEDED' } });
  await prisma.payment.create({ data: { bookingId: bookingCancelledForfeitWindow.id, stripePaymentIntentId: 'pi_test_deposit_forfeit_cancel', type: 'DEPOSIT', amountPence: 650, status: 'SUCCEEDED' } });
  await prisma.payment.create({ data: { bookingId: bookingCancelledForfeitWindow.id, stripePaymentIntentId: 're_test_partial_refund', type: 'REFUND', amountPence: 0, status: 'SUCCEEDED' } }); // £0 refund: deposit forfeited per policy — confirms admin UI shows "no refund due" correctly

  // NOTE on webhook idempotency testing: this seed cannot simulate Stripe
  // re-sending the same webhook event, because that happens at the API
  // layer, not in the database. To test it for real: in Stripe CLI test
  // mode, run `stripe trigger payment_intent.succeeded` twice with the same
  // event ID and confirm the booking/payment status only changes once.

  // ---------------------------------------------------------------------
  // VOUCHERS + ACCOUNT CREDIT (§13.1/13.4)
  // ---------------------------------------------------------------------
  const voucher = await prisma.voucher.create({ data: { code: 'WELCOME25', amountPence: 2500, remainingPence: 1000, purchaserId: admin.id, recipientEmail: erin.email, status: 'ACTIVE' } }); // partially redeemed: 2500 issued, 1000 left
  await prisma.creditLedger.create({ data: { customerId: erin.id, amountPence: -1500, reason: `Redeemed against voucher ${voucher.code}`, bookingId: bookingCompleted.id } });
  await prisma.creditLedger.create({ data: { customerId: erin.id, amountPence: 500, reason: 'Goodwill credit — admin issued' } });
  const fullyUsedVoucher = await prisma.voucher.create({ data: { code: 'USEDUP10', amountPence: 1000, remainingPence: 0, recipientEmail: bob.email, status: 'REDEEMED' } });
  const expiredVoucher = await prisma.voucher.create({ data: { code: 'EXPIRED10', amountPence: 1000, remainingPence: 1000, recipientEmail: carol.email, expiresAt: daysFromNow(-5), status: 'EXPIRED' } });

  // ---------------------------------------------------------------------
  // SUBSCRIPTION (§13.1) — one active-with-a-paused-week, one payment-failed
  // ---------------------------------------------------------------------
  await prisma.subscription.create({ data: { customerId: erin.id, serviceId: dogWalking.id, dogId: erinDog.id, weekdays: 'MON,WED,FRI', slot: '09:00', stripeSubscriptionId: 'sub_test_erin_walking', status: 'ACTIVE', pausedUntil: daysFromNow(7) } });
  await prisma.subscription.create({ data: { customerId: bob.id, serviceId: daycare.id, dogId: bobDog.id, weekdays: 'TUE,THU', slot: '09:00', stripeSubscriptionId: 'sub_test_bob_daycare', status: 'PAYMENT_FAILED' } });

  // ---------------------------------------------------------------------
  // REVIEWS (§13.1) — one in each moderation state
  // ---------------------------------------------------------------------
  await prisma.review.create({ data: { customerId: alice.id, bookingId: bookingCheckedOut.id, rating: 5, text: 'Bramble comes home happy every time.', status: 'APPROVED' } });
  await prisma.review.create({ data: { customerId: erin.id, bookingId: bookingCompleted.id, rating: 4, text: 'Great walk, would book again.', status: 'PENDING' } });
  await prisma.review.create({ data: { customerId: bob.id, bookingId: bookingNoShow.id, rating: 1, text: 'Confused review left after a no-show.', status: 'REJECTED' } });

  // ---------------------------------------------------------------------
  // CARE TASKS + INCIDENT LOG
  // ---------------------------------------------------------------------
  await prisma.careTask.create({ data: { bookingId: bookingCheckedIn.id, dogId: aliceDog.id, date: daysFromNow(0), type: 'FEED', description: 'Morning feed — half cup', completedById: staff.id, completedAt: new Date(), notes: 'Ate well' } });
  await prisma.careTask.create({ data: { bookingId: bookingCheckedIn.id, dogId: aliceDog.id, date: daysFromNow(0), type: 'WALK', description: 'Morning walk in forest area' } });
  await prisma.incidentReport.create({ data: { bookingId: bookingCheckedOut.id, dogId: aliceDog.id, reportedById: staff.id, description: 'Minor scrape on paw pad during play, cleaned and monitored', severity: 'LOW' } });

  // ---------------------------------------------------------------------
  // VAN RUNS
  // ---------------------------------------------------------------------
  const vanRunToday = await prisma.vanRun.create({ data: { date: daysFromNow(0), name: 'Morning Run', startTime: '08:00', maxDogs: 4, staffId: staff.id } });
  const walkBookingAlice = await prisma.booking.create({ data: { customerId: alice.id, serviceId: dogWalking.id, startDate: daysFromNow(0), endDate: daysFromNow(0), status: 'CONFIRMED', totalPence: 1200, depositPence: 1200 } });
  const walkBookingBob = await prisma.booking.create({ data: { customerId: bob.id, serviceId: dogWalking.id, startDate: daysFromNow(0), endDate: daysFromNow(0), status: 'CONFIRMED', totalPence: 1200, depositPence: 1200 } });
  await prisma.vanRunStop.create({ data: { vanRunId: vanRunToday.id, bookingId: walkBookingAlice.id, dogId: aliceDog.id, pickupAddress: `${alice.addressLine1}, ${alice.addressCity} ${alice.addressPostcode}`, accessNotes: 'Side gate, key safe code 1234', sortOrder: 1, status: 'DROPPED_OFF', collectedAt: daysFromNow(0), droppedOffAt: daysFromNow(0) } });
  await prisma.vanRunStop.create({ data: { vanRunId: vanRunToday.id, bookingId: walkBookingBob.id, dogId: bobDog.id, pickupAddress: `${bob.addressLine1}, ${bob.addressCity} ${bob.addressPostcode}`, accessNotes: 'Ring bell, dog is behind gate', sortOrder: 2, status: 'PENDING' } });

  // ---------------------------------------------------------------------
  // WAITLIST + TRIAL VISIT
  // ---------------------------------------------------------------------
  await prisma.waitlistEntry.create({ data: { customerId: carol.id, serviceId: boarding.id, dogId: carolDog.id, date: daysFromNow(30), status: 'WAITING' } });
  await prisma.waitlistEntry.create({ data: { customerId: dave.id, serviceId: boarding.id, dogId: daveDog.id, date: daysFromNow(30), status: 'OFFERED', offerExpiresAt: hoursFromNow(10) } }); // active time-limited claim window
  await prisma.trialVisit.create({ data: { dogId: daveDog.id, bookingId: bookingDraft.id, notes: 'Awaiting scheduling' } }); // no outcome yet: blocks first boarding

  // ---------------------------------------------------------------------
  // NOTIFICATION PREFS + MESSAGE LOG (§13.2)
  // ---------------------------------------------------------------------
  await prisma.notificationPreference.create({ data: { customerId: erin.id, channel: 'BOTH' } });
  await prisma.messageLog.create({ data: { customerId: alice.id, channel: 'EMAIL', type: 'BOOKING_CONFIRMATION', payload: `Booking ${bookingConfirmed.id} confirmed`, sentAt: daysFromNow(-2), status: 'DELIVERED' } });
  await prisma.messageLog.create({ data: { customerId: bob.id, channel: 'EMAIL', type: 'BALANCE_PAYMENT_FAILED', payload: `Balance charge failed for booking ${bookingBalanceFailed.id}`, sentAt: daysFromNow(-1), status: 'DELIVERED' } });
  await prisma.messageLog.create({ data: { customerId: erin.id, channel: 'SMS', type: 'PICKUP_NOTIFICATION', payload: 'Your dog has been collected', sentAt: daysFromNow(0), status: 'FAILED' } }); // failed send: tests retry/error surfacing

  // ---------------------------------------------------------------------
  // AUDIT LOG — a few representative entries
  // ---------------------------------------------------------------------
  await prisma.auditLog.create({ data: { actorId: admin.id, action: 'CANCEL_BOOKING', entity: 'Booking', entityId: bookingCancelledByAdmin.id, meta: JSON.stringify({ reason: 'Vaccination requirement not met in time' }) } });
  await prisma.auditLog.create({ data: { actorId: staff.id, action: 'VERIFY_VACCINATION', entity: 'VaccinationRecord', entityId: aliceDog.id, meta: JSON.stringify({ type: 'DHPP' }) } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: 'OVERRIDE_COMPATIBILITY_FLAG', entity: 'Dog', entityId: daveDog.id, meta: JSON.stringify({ note: 'Manually allowed group walk despite flag — test of logged override' }) } });

  // ---------------------------------------------------------------------
  // CONTENT: media, testimonials, FAQs, settings, contact message
  // ---------------------------------------------------------------------
  await prisma.mediaItem.createMany({
    data: [
      { type: 'IMAGE', url: '/images/placeholder-kennels-1.jpg', caption: 'One of our kennel units', category: 'kennels', usage: 'GALLERY', sortOrder: 1 },
      { type: 'IMAGE', url: '/images/placeholder-forest-1.jpg', caption: 'Secure forest walk area', category: 'forest walks', usage: 'GALLERY', sortOrder: 2 },
      { type: 'VIDEO', url: '/videos/placeholder-van-run.mp4', thumbnailUrl: '/images/placeholder-van-thumb.jpg', caption: 'A morning van run', category: 'van runs', usage: 'GALLERY', sortOrder: 3 },
      { type: 'IMAGE', url: '/images/placeholder-hero.jpg', caption: 'Dogs playing outdoors', category: 'homepage', usage: 'HERO', sortOrder: 1 },
    ],
  });

  await prisma.testimonial.createMany({
    data: [
      { author: 'Alice W.', text: 'Bramble comes home happy every time. Wonderful, trustworthy team.', visible: true },
      { author: 'Sarah T.', text: 'The booking system made everything so easy compared to phoning around.', visible: true },
      { author: 'Pending Review', text: 'Awaiting moderation — should not show publicly yet.', visible: false },
    ],
  });

  await prisma.faq.createMany({
    data: [
      { question: 'What vaccinations does my dog need?', answer: 'DHPP, kennel cough and (if boarding) leptospirosis must be in date, verified before check-in.', sortOrder: 1 },
      { question: "Do you offer a trial visit?", answer: "Yes — a Meet & Greet is required before a dog's first boarding stay.", sortOrder: 2 },
    ],
  });

  await prisma.contactMessage.create({ data: { name: 'Prospective Customer', email: 'prospect@example.test', phone: '07700900099', message: 'Hi, do you have space for 2 dogs next weekend?', handled: false } });

  // Deliberately messy contact message to test server-side validation
  // (Zod): invalid-looking email and an empty message. If validation is
  // enforced only client-side, this row proves the server would have let
  // it through — useful for a Claude Code review of the contact API route.
  await prisma.contactMessage.create({ data: { name: 'X', email: 'not-an-email', phone: '123', message: '', handled: false } });

  await prisma.setting.createMany({
    data: [
      { key: 'deposit_percent', value: '25' },
      { key: 'balance_due_days_before', value: '7' },
      { key: 'cancellation_free_days', value: '14' },
      { key: 'cancellation_no_refund_hours', value: '48' },
      { key: 'service_area_postcodes', value: 'G1,G2,G3,G4,G33,G64,G65,G66,G67,G68,G69' }, // note: Dave's EH postcode is deliberately excluded
      { key: 'abandoned_booking_reminder_hours', value: '24' },
      { key: 'daycare_max_capacity', value: '10' },
      // Short substrings on purpose: matched case-insensitively via .includes(), and this
      // avoids a false negative between this file's 'KENNEL_COUGH' convention and
      // tests/e2e/seed.ts's 'Kennel Cough' convention (space vs underscore).
      { key: 'required_vaccine_types', value: 'DHPP,Leptospirosis,Kennel' },
    ],
  });

  console.log('Done. Test accounts (all use password: Password123!):');
  console.log('  admin@bedlaygardens.test   (ADMIN)');
  console.log('  staff@bedlaygardens.test   (STAFF)');
  console.log('  alice@example.test  — happy path: valid vaccination, signed agreement, successful payments');
  console.log('  bob@example.test    — expired vaccination, unsigned agreement, FAILED balance payment, active subscription with payment failure');
  console.log('  carol@example.test  — no vaccination record at all, on waitlist, unsigned agreement');
  console.log('  dave@example.test   — compatibility flags, outside service area, unsigned agreement, waitlist offer pending');
  console.log('  erin@example.test   — voucher + account credit, active subscription (paused week), signed agreement');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
