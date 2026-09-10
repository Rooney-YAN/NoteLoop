import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_SOURCE_CHARS = 240_000;
export const LONG_SOURCE_WARNING_CHARS = 120_000;
export const NEAR_EMPTY_CHARS = 200;
const MAX_PAGES = 250;

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function removeRepeatedEdges(pages: string[]) {
  if (pages.length < 3) return pages;
  const edgeCounts = new Map<string, number>();
  const split = pages.map((page) => page.split(/\r?\n/).map(normalizeLine).filter(Boolean));

  for (const lines of split) {
    const edges = [...lines.slice(0, 2), ...lines.slice(-2)];
    for (const line of new Set(edges)) {
      if (line.length >= 3 && line.length <= 140) edgeCounts.set(line, (edgeCounts.get(line) ?? 0) + 1);
    }
  }

  const threshold = Math.max(3, Math.ceil(pages.length * 0.5));
  const repeated = new Set([...edgeCounts].filter(([, count]) => count >= threshold).map(([line]) => line));
  return split.map((lines) => lines.filter((line, index) => !(repeated.has(line) && (index < 2 || index >= lines.length - 2))).join("\n"));
}

export function normalizeExtractedText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfText(data: Uint8Array) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("PDF extraction timed out.")), 20_000);
  });
  const extraction = (async () => {
    const pdf = await getDocumentProxy(data, { maxImageSize: 16_777_216 });
    try {
      if (pdf.numPages > MAX_PAGES) throw new Error(`This PDF has ${pdf.numPages} pages. The current limit is ${MAX_PAGES}.`);
      const result = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(result.text) ? result.text : [result.text];
      const text = normalizeExtractedText(removeRepeatedEdges(pages).join("\n\n"));
      if (text.length > MAX_SOURCE_CHARS) {
        throw new Error(`Extracted text is ${text.length.toLocaleString()} characters. The current limit is ${MAX_SOURCE_CHARS.toLocaleString()}. Split the PDF into a smaller lecture or section.`);
      }
      return { text, pages: result.totalPages };
    } finally {
      await pdf.loadingTask.destroy();
    }
  })();
  try {
    return await Promise.race([extraction, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
