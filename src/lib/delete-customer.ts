import type { PrismaClient, Prisma } from "@/generated/prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Permanently deletes a customer and every record that depends on them:
 * bookings, dogs, reviews, subscriptions, waitlist entries, credit history,
 * signed agreements, notification preferences, message logs, trial visits,
 * audit log entries logged in their own name, and any walk-booking/van-run-
 * stop rows tied to their bookings or dogs. Irreversible.
 *
 * Deletion order matters — each of these has a foreign key back to the
 * customer (or one of their bookings) with no ON DELETE CASCADE, so they
 * have to go first or the later delete calls fail on a constraint violation.
 * Booking and Dog do cascade their own direct children (BookingDog, Pupdate,
 * KennelOccupancy, VaccinationRecord, DogFlag, etc.), so those don't need
 * handling here.
 *
 * AuditLog.actorId must be cleared here too: customers are now logged as the
 * actor of their own self-service actions (login, self-registration,
 * bookings, payments, vaccinations), not just admins/staff, so any customer
 * who has ever done one of those would otherwise fail deletion with a
 * foreign-key violation on AuditLog_actorId_fkey.
 *
 * Scoped to CUSTOMER accounts. A user who was ever STAFF/ADMIN can have
 * additional non-cascading references (VaccinationRecord.verifiedById,
 * IncidentReport.reportedById) not handled here — there's no path back from
 * STAFF/ADMIN to CUSTOMER in this app, so a genuine customer account should
 * never hit those.
 */
export async function deleteCustomerAndAllData(db: Db, customerId: string): Promise<void> {
  await db.auditLog.deleteMany({ where: { actorId: customerId } })
  await db.trialVisit.deleteMany({ where: { booking: { customerId } } })
  // WalkBooking.bookingId is nullable — a walk slot claimed for a dog isn't
  // always tied to a Booking row, so it has to be matched on the dog's
  // owner too, not just via booking.customerId.
  await db.walkBooking.deleteMany({
    where: { OR: [{ booking: { customerId } }, { dog: { ownerId: customerId } }] },
  })
  await db.vanRunStop.deleteMany({ where: { booking: { customerId } } })
  await db.review.deleteMany({ where: { customerId } })
  await db.signedAgreement.deleteMany({ where: { customerId } })
  await db.subscription.deleteMany({ where: { customerId } })
  await db.waitlistEntry.deleteMany({ where: { customerId } })
  await db.creditLedger.deleteMany({ where: { customerId } })
  await db.notificationPreference.deleteMany({ where: { customerId } })
  await db.messageLog.deleteMany({ where: { customerId } })
  await db.booking.deleteMany({ where: { customerId } })
  await db.dog.deleteMany({ where: { ownerId: customerId } })
  await db.user.delete({ where: { id: customerId } })
}
