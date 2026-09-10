import { NextResponse } from "next/server";
import { extractPdfText, LONG_SOURCE_WARNING_CHARS, MAX_PDF_BYTES, NEAR_EMPTY_CHARS } from "@/lib/pdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF file to continue." }, { status: 400 });
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "Unsupported course material. Please upload a PDF." }, { status: 415 });
    if (!file.size) return NextResponse.json({ error: "The selected PDF is empty." }, { status: 400 });
    if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "The PDF is larger than 15 MB. Split it into a smaller lecture or section." }, { status: 413 });

    const { text, pages } = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
    const warnings: string[] = [];
    if (text.length < NEAR_EMPTY_CHARS) warnings.push("Very little text was extracted. This may be an image-only PDF; OCR is not included in this MVP.");
    if (text.length > LONG_SOURCE_WARNING_CHARS) warnings.push("This is an unusually long source. Analysis may be slower or cost more; consider using one lecture or section at a time.");
    return NextResponse.json({ text, pages, characterCount: text.length, warnings });
  } catch (error) {
    const message = error instanceof Error && (error.message.includes("limit") || error.message.includes("timed out") || error.message.includes("characters") || error.message.includes("pages")) ? error.message : "Could not extract text from this PDF. It may be damaged, encrypted, or image-only.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
