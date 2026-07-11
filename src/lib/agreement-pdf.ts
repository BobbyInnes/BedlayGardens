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

export async function generateAgreementPdf(options: {
  businessName: string
  version: string
  text: string
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

  drawLine(`${options.businessName} — Boarding Agreement`, { bold: true, size: 16 })
  y -= 6
  drawLine(`Version: ${options.version}`)
  y -= 10

  for (const line of wrapText(options.text, font, PAGE_WIDTH - MARGIN * 2)) {
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
