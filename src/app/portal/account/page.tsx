import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ProfileForm } from "@/components/portal/profile-form"
import { EmergencyContactForm } from "@/components/portal/emergency-contact-form"
import { VetPracticeForm } from "@/components/portal/vet-practice-form"
import { PasswordForm } from "@/components/portal/password-form"
import { DeleteAccountDialog } from "@/components/portal/delete-account-dialog"
import { BillingPortalButton } from "@/components/portal/billing-portal-button"
import { NotificationSettingsForm } from "@/components/portal/notification-settings-form"
import { formatCustomerNumber } from "@/lib/customer-dog-numbers"
import { getPetCareUpdatesPreference, isOptedOut } from "@/lib/notification-preferences"

export const metadata: Metadata = {
  title: "Account",
}

export default async function AccountPage() {
  const session = await auth()
  const [user, petCareUpdates, marketingOptedOut] = await Promise.all([
    prisma.user.findUnique({ where: { id: session!.user.id } }),
    getPetCareUpdatesPreference(session!.user.id),
    isOptedOut(session!.user.id, "ABANDONED_BOOKING_REMINDER"),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.email}
          {user ? ` · ${formatCustomerNumber(user.customerNumber)}` : ""}
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
          <h2 className="text-lg font-semibold">Contact details</h2>
          <ProfileForm
            salutation={user?.salutation ?? ""}
            forename={user?.forename ?? ""}
            surname={user?.surname ?? ""}
            homePhone={user?.homePhone ?? ""}
            phone={user?.phone ?? ""}
            workPhone={user?.workPhone ?? ""}
            addressLine1={user?.addressLine1 ?? ""}
            addressLine2={user?.addressLine2 ?? ""}
            addressCity={user?.addressCity ?? ""}
            addressPostcode={user?.addressPostcode ?? ""}
          />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
          <div>
            <h2 className="text-lg font-semibold">Emergency contact</h2>
            <p className="text-sm text-muted-foreground">
              Shared across all of your dogs — who we should contact if we can&apos;t reach you.
            </p>
          </div>
          <EmergencyContactForm
            salutation={user?.emergencyContactSalutation ?? ""}
            forename={user?.emergencyContactForename ?? ""}
            surname={user?.emergencyContactSurname ?? ""}
            homePhone={user?.emergencyContactHomePhone ?? ""}
            phone={user?.emergencyContactPhone ?? ""}
            workPhone={user?.emergencyContactWorkPhone ?? ""}
            addressLine1={user?.emergencyContactAddressLine1 ?? ""}
            addressLine2={user?.emergencyContactAddressLine2 ?? ""}
            addressCity={user?.emergencyContactCity ?? ""}
            addressPostcode={user?.emergencyContactPostcode ?? ""}
          />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
          <div>
            <h2 className="text-lg font-semibold">Vet practice</h2>
            <p className="text-sm text-muted-foreground">
              Shared across all of your dogs.
            </p>
          </div>
          <VetPracticeForm
            practiceName={user?.vetPracticeName ?? ""}
            practiceEmail={user?.vetEmail ?? ""}
            consultantName={user?.vetName ?? ""}
            phone={user?.vetPhone ?? ""}
            addressLine1={user?.vetAddressLine1 ?? ""}
            addressLine2={user?.vetAddressLine2 ?? ""}
            addressCity={user?.vetCity ?? ""}
            addressPostcode={user?.vetPostcode ?? ""}
          />
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
          <div>
            <h2 className="text-lg font-semibold">Notification Settings</h2>
            <p className="text-sm text-muted-foreground">
              How we contact you for pickup/drop-off updates, balance reminders, check-in reminders,
              waitlist offers, and marketing emails.
            </p>
          </div>
          <NotificationSettingsForm
            petCareEmail={petCareUpdates.email}
            petCareSms={petCareUpdates.sms}
            marketingEmail={!marketingOptedOut}
          />
        </section>

        {user?.passwordHash && (
          <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <h2 className="text-lg font-semibold">Password</h2>
            <PasswordForm />
          </section>
        )}

        <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
          <div>
            <h2 className="text-lg font-semibold">Billing</h2>
            <p className="text-sm text-muted-foreground">
              View saved credit/debit cards and payment history via Stripe.
            </p>
          </div>
          <BillingPortalButton />
        </section>

        <section className="space-y-4 rounded-lg border border-destructive/30 p-4">
          <div>
            <h2 className="text-lg font-semibold">Delete account</h2>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and personal data.
            </p>
          </div>
          <DeleteAccountDialog />
        </section>
      </div>
    </div>
  )
}
