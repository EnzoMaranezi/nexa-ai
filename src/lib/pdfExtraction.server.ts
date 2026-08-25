import { extractText, getDocumentProxy } from "unpdf";

export const MAX_EXTRACTED_CHARS = 200_000;

/** Extracts plain text from a PDF buffer. Throws on unreadable/empty PDFs. */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  const normalized = (Array.isArray(text) ? text.join("\n\n") : text)
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    throw new Error(
      "We couldn't read any text in this PDF. It may be a scanned image — try a text-based PDF.",
    );
  }

  return normalized.slice(0, MAX_EXTRACTED_CHARS);
}
