import type { Metadata } from "next"
import { CustomerImportForm } from "@/components/admin/customer-import-form"

export const metadata: Metadata = {
  title: "Import Customers | Admin",
}

export default function AdminImportPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import Customers</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Upload the &ldquo;upload&rdquo; Excel template to create customer accounts, dogs and vet details in one go.
          Column A is the customer&rsquo;s email; data starts at row 5. Each row is one dog — a customer with several
          dogs appears as several rows repeating the same account details, and they&rsquo;re grouped back into one
          customer automatically. Preview first to see exactly what will be created — nothing is saved until you
          press Import. Customers whose email is already on the site are skipped, never overwritten. Imported
          customers have no password and are not emailed; they sign in with &ldquo;Forgot password&rdquo;.
        </p>
      </div>
      <CustomerImportForm />
    </div>
  )
}
