import sanitizeHtml from "sanitize-html"

// Small allowlist matching exactly what the admin RichTextEditor toolbar can
// produce (bold, underline, italic, coloured text, paragraphs/line breaks).
// Anything else — scripts, links, images, event handlers, arbitrary styles —
// is stripped. Used both when saving admin input and again at render time
// (defense in depth, and it upgrades old plain-text values automatically).
const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "span", "br", "p", "div"]

export function sanitizeRichText(value: string): string {
  // Legacy/plain-text values (and anything pasted without markup) use real
  // newline characters, which HTML collapses. Turn those into <br> first so
  // paragraph breaks are preserved either way.
  const withBreaks = value.replace(/\r\n|\r|\n/g, "<br>")

  return sanitizeHtml(withBreaks, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      span: ["style"],
    },
    allowedStyles: {
      span: {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
      },
    },
    disallowedTagsMode: "discard",
  }).trim()
}

// For contexts that can't render HTML (e.g. drawing text into a generated
// PDF) — turns block breaks into newlines, then strips every remaining tag
// and decodes entities.
export function htmlToPlainText(value: string): string {
  const withBreaks = value.replace(/<\/(p|div)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} }).trim()
}
