"use client"

import * as React from "react"
import { useActionState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { EmailTemplateType, MergeFieldDef } from "@/lib/email-template-store"
import {
  saveEmailTemplate,
  resetEmailTemplate,
  previewEmailTemplate,
  sendTestEmailTemplate,
  type EmailTemplateActionState,
} from "@/app/admin/email-templates/actions"

const initialState: EmailTemplateActionState = { status: "idle" }

export function EmailTemplateEditor({
  type,
  mergeFields,
  defaultSubject,
  defaultBody,
  initialSubject,
  initialBody,
  isCustomized,
}: {
  type: EmailTemplateType
  mergeFields: MergeFieldDef[]
  defaultSubject: string
  defaultBody: string
  initialSubject: string
  initialBody: string
  isCustomized: boolean
}) {
  const [subject, setSubject] = React.useState(initialSubject)
  const [body, setBody] = React.useState(initialBody)
  const [state, formAction, saving] = useActionState(saveEmailTemplate.bind(null, type), initialState)

  const [preview, setPreview] = React.useState<{ subject: string; html: string } | null>(null)
  const [previewError, setPreviewError] = React.useState<string | null>(null)
  const [testMessage, setTestMessage] = React.useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handlePreview() {
    setPreviewError(null)
    startTransition(async () => {
      const result = await previewEmailTemplate(type, subject, body)
      if ("error" in result) {
        setPreviewError(result.error)
        setPreview(null)
      } else {
        setPreview(result)
      }
    })
  }

  function handleSendTest() {
    setTestMessage(null)
    startTransition(async () => {
      const result = await sendTestEmailTemplate(type, subject, body)
      setTestMessage(result.message ?? null)
    })
  }

  function handleReset() {
    setSubject(defaultSubject)
    setBody(defaultBody)
    setPreview(null)
    startTransition(async () => {
      await resetEmailTemplate(type)
    })
  }

  return (
    <div className="space-y-4">
      {isCustomized && (
        <p className="text-xs font-medium text-primary">Customized — no longer using the default wording.</p>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${type}-subject`}>Subject</Label>
          <Input
            id={`${type}-subject`}
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${type}-body`}>Body</Label>
          <Textarea
            id={`${type}-body`}
            name="bodyHtml"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="font-mono text-xs"
          />
        </div>

        <details className="rounded-md border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Available merge fields</summary>
          <ul className="mt-2 space-y-1.5">
            {mergeFields.map((field) => (
              <li key={field.key} className="text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">{`{{${field.key}}}`}</code>{" "}
                {field.description}
                {field.kind === "block" && (
                  <span className="ml-1 text-xs italic">
                    — system-generated, place it but its own content can&apos;t be edited
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={handlePreview} disabled={pending}>
            Preview
          </Button>
          <Button type="button" variant="outline" onClick={handleSendTest} disabled={pending}>
            Send test to me
          </Button>
          <Button type="button" variant="outline" onClick={handleReset} disabled={pending || !isCustomized}>
            Reset to default
          </Button>
          {state.message && (
            <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
              {state.message}
            </p>
          )}
          {testMessage && <p className="text-sm text-primary">{testMessage}</p>}
        </div>
      </form>

      {previewError && <p className="text-sm text-destructive">{previewError}</p>}
      {preview && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm">
            <span className="font-medium">Subject:</span> {preview.subject}
          </p>
          <iframe
            title={`${type} preview`}
            srcDoc={preview.html}
            className="h-[480px] w-full rounded border border-border bg-white"
          />
        </div>
      )}
    </div>
  )
}
