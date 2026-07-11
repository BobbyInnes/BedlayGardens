import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ProfileForm } from "@/components/portal/profile-form"
import { PasswordForm } from "@/components/portal/password-form"
import { DeleteAccountDialog } from "@/components/portal/delete-account-dialog"
import { BillingPortalButton } from "@/components/portal/billing-portal-button"
import { NotificationPreferenceForm } from "@/components/portal/notification-preference-form"
import { AbandonedBookingOptOut } from "@/components/portal/abandoned-booking-optout"

function parsePerType(perType: string | null | undefined): Record<string, string> {
  try {
    return JSON.parse(perType ?? "{}")
  } catch {
    return {}
  }
}

export const metadata: Metadata = {
  title: "Account",
}

export default async function AccountPage() {
  const session = await auth()
  const [user, notificationPreference] = await Promise.all([
    prisma.user.findUnique({ where: { id: session!.user.id } }),
    prisma.notificationPreference.findUnique({ where: { customerId: session!.user.id } }),
  ])
  const abandonedBookingOptedOut = parsePerType(notificationPreference?.perType).ABANDONED_BOOKING_REMINDER === "off"

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Contact details</h2>
        <ProfileForm
          name={user?.name ?? ""}
          phone={user?.phone ?? ""}
          address={user?.address ?? ""}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            How we contact you for pickup/drop-off updates, balance reminders, check-in reminders,
            and waitlist offers. SMS requires a phone number on file.
          </p>
        </div>
        <NotificationPreferenceForm channel={notificationPreference?.channel ?? "EMAIL"} />
        <AbandonedBookingOptOut initialOptedOut={abandonedBookingOptedOut} />
      </section>

      {user?.passwordHash && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Password</h2>
          <PasswordForm />
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Billing</h2>
          <p className="text-sm text-muted-foreground">
            View saved cards and payment history via Stripe.
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
  )
}
