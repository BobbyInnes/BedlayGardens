import sanitizeHtml from "sanitize-html"

// Small allowlist matching exactly what the admin RichTextEditor toolbar can
// produce (bold, underline, italic, coloured text, paragraphs/line breaks,
// and images uploaded through the editor's own image button). Anything else
// — scripts, links, arbitrary img sources, event handlers, arbitrary styles —
// is stripped. Used both when saving admin input and again at render time
// (defense in depth, and it upgrades old plain-text values automatically).
const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "span", "br", "p", "div", "img"]

export function sanitizeRichText(value: string): string {
  // Legacy/plain-text values (and anything pasted without markup) use real
  // newline characters, which HTML collapses. Turn those into <br> first so
  // paragraph breaks are preserved either way.
  const withBreaks = value.replace(/\r\n|\r|\n/g, "<br>")

  return sanitizeHtml(withBreaks, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      span: ["style"],
      img: ["src", "alt"],
    },
    allowedStyles: {
      span: {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
      },
    },
    // Uploaded images always come back as https R2 URLs — block javascript:/data:
    // URIs so a hand-crafted src can't be used to inject a script.
    allowedSchemesByTag: { img: ["https"] },
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

// For `line-clamp`-truncated previews (e.g. service cards). `-webkit-line-clamp`
// only clips correctly across a single flowing run of text — if the sanitized
// HTML has multiple <p>/<div> paragraphs, the clamp box's line-fragmentation
// math breaks down and paragraphs render overlapping each other instead of
// stacked. Flattening paragraph breaks to <br> keeps bold/italic/colour/images
// but avoids the nested-block layout that trips up the clamp.
export function sanitizeRichTextPreview(value: string): string {
  return sanitizeRichText(value)
    .replace(/<\/(p|div)>/gi, "<br>")
    .replace(/<(p|div)[^>]*>/gi, "")
    .replace(/(<br>\s*)+$/i, "")
    .replace(/^(\s*<br>)+/i, "")
}
