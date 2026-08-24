import type { Metadata } from "next"
import { EMAIL_TEMPLATE_TYPES, EMAIL_TEMPLATE_DEFS, getStoredEmailTemplate } from "@/lib/email-template-store"
import { EmailTemplateEditor } from "@/components/admin/email-template-editor"

export const metadata: Metadata = {
  title: "Email Templates | Admin",
}

export default async function AdminEmailTemplatesPage() {
  const templates = await Promise.all(
    EMAIL_TEMPLATE_TYPES.map(async (type) => ({
      def: EMAIL_TEMPLATE_DEFS[type],
      current: await getStoredEmailTemplate(type),
    }))
  )

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the subject and wording of these emails. Every email still keeps the same header,
          footer, and business branding — this only changes the text shown for the type you edit.
        </p>
      </div>

      {templates.map(({ def, current }) => (
        <section key={def.type} className="space-y-3 rounded-lg border border-border p-5">
          <div>
            <h2 className="text-lg font-semibold">{def.label}</h2>
            <p className="text-sm text-muted-foreground">{def.description}</p>
          </div>
          <EmailTemplateEditor
            type={def.type}
            mergeFields={def.mergeFields}
            defaultSubject={def.defaultSubject}
            defaultBody={def.defaultBody}
            initialSubject={current.subject}
            initialBody={current.body}
            isCustomized={current.isCustomized}
          />
        </section>
      ))}
    </div>
  )
}
