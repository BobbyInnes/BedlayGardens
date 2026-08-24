import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 50
const FONT_SIZE = 11
const LINE_HEIGHT = 16

function wrapText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, FONT_SIZE) > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
  }
  return lines
}

// The terms themselves now live in the uploaded PDF at documentUrl (see
// Agreement.documentUrl) rather than as text this function renders — this
// generates the customer's signature record instead: which version they
// signed, a link back to the exact document they agreed to, and who/when/
// from where. Kept as a separate PDF (rather than, say, stamping a
// signature page onto the uploaded document itself) so the original terms
// PDF an admin uploaded is never modified after the fact.
export async function generateAgreementPdf(options: {
  businessName: string
  version: string
  documentUrl: string
  signedName: string
  signedAt: Date
  ipAddress: string
}): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function drawLine(text: string, options?: { bold?: boolean; size?: number }) {
    if (y < MARGIN + LINE_HEIGHT) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
    page.drawText(text, {
      x: MARGIN,
      y,
      size: options?.size ?? FONT_SIZE,
      font: options?.bold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.1),
    })
    y -= LINE_HEIGHT
  }

  drawLine(`${options.businessName} — Our Terms and Conditions`, { bold: true, size: 16 })
  y -= 6
  drawLine(`Version: ${options.version}`)
  y -= 10

  for (const line of wrapText(
    `This confirms agreement to Our Terms and Conditions (version ${options.version}) available at:`,
    font,
    PAGE_WIDTH - MARGIN * 2
  )) {
    drawLine(line)
  }
  for (const line of wrapText(options.documentUrl, font, PAGE_WIDTH - MARGIN * 2)) {
    drawLine(line)
  }

  y -= 10
  drawLine("Signature", { bold: true })
  drawLine(`Signed by: ${options.signedName}`)
  drawLine(`Signed at: ${options.signedAt.toISOString()}`)
  drawLine(`IP address: ${options.ipAddress}`)

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
