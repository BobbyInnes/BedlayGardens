import Anthropic from "@anthropic-ai/sdk"
import sharp from "sharp"

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

export type ExtractedVaccine = {
  type: string | null
  dateGiven: string | null
  expiryDate: string | null
  vetPractice: string | null
}

export type ExtractionResult = {
  vaccines: ExtractedVaccine[]
  dogNameOnCertificate: string | null
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    vaccines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: ["string", "null"], description: "e.g. DHPP, Leptospirosis, Kennel Cough, Rabies" },
          dateGiven: { type: ["string", "null"], description: "ISO date yyyy-mm-dd" },
          expiryDate: { type: ["string", "null"], description: "ISO date yyyy-mm-dd" },
          vetPractice: { type: ["string", "null"] },
        },
        required: ["type", "dateGiven", "expiryDate", "vetPractice"],
        additionalProperties: false,
      },
    },
    dogNameOnCertificate: { type: ["string", "null"] },
  },
  required: ["vaccines", "dogNameOnCertificate"],
  additionalProperties: false,
} as const

const EXTRACTION_PROMPT = `You are reading a dog vaccination certificate. Extract every vaccine listed.

Rules:
- Dates on the certificate are in UK format (day/month/year). Convert every date to ISO format (yyyy-mm-dd).
- If a field is illegible or not present, set it to null rather than guessing.
- One certificate can list several vaccines (e.g. DHPP, Leptospirosis, Kennel Cough, Rabies) — return one entry per vaccine.
- "type" should be the vaccine name as written (e.g. "DHPP", "Leptospirosis", "Kennel Cough", "Rabies"), not a description.`

async function toJpegBase64(buffer: Buffer, mimeType: string): Promise<{ mediaType: string; data: string }> {
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    const converted = await sharp(buffer).jpeg().toBuffer()
    return { mediaType: "image/jpeg", data: converted.toString("base64") }
  }
  return { mediaType: mimeType, data: buffer.toString("base64") }
}

export async function extractVaccinationData(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult | null> {
  if (!client) return null

  try {
    const content: Anthropic.Messages.ContentBlockParam[] = []

    if (mimeType === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
      })
    } else {
      const { mediaType, data } = await toJpegBase64(buffer, mimeType)
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data },
      })
    }
    content.push({ type: "text", text: EXTRACTION_PROMPT })

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
      messages: [{ role: "user", content }],
    })

    if (response.stop_reason === "refusal") return null

    const textBlock = response.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") return null

    return JSON.parse(textBlock.text) as ExtractionResult
  } catch (error) {
    console.error("[vaccination-extraction] Failed to extract certificate data", error)
    return null
  }
}
