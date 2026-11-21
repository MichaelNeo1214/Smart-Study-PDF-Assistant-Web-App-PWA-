import DOMPurify from "dompurify";
import { marked } from "marked";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { z } from "zod";
import type { Flashcard } from "../types/models";

// Bundled by Vite and served from our own origin, so PDF parsing keeps working
// in airplane mode (no CDN worker, no external fetch).
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const flashcardOutputSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().min(1).max(200),
        back: z.string().min(1).max(500),
        tag: z.string().max(60).optional(),
      })
    )
    .min(1)
    .max(50),
});

function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end <= start) {
    throw new Error("No JSON object found in the model output.");
  }
  return candidate.slice(start, end + 1);
}

function repairJson(input: string): string {
  return input
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u001f]+/g, " ");
}

/** Parses, repairs, and validates structured flashcard output. */
export function parseFlashcards(raw: string): Flashcard[] {
  const json = extractJsonObject(raw);

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    value = JSON.parse(repairJson(json));
  }

  const parsed = flashcardOutputSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
    throw new Error(`Flashcard output failed validation: ${details.join("; ")}`);
  }

  return parsed.data.cards;
}

export function normalizeMarkdown(raw: string): string {
  const fenced = raw.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/** Converts model Markdown to HTML and sanitizes it before rendering. */
export function renderSafeMarkdown(raw: string): string {
  const html = marked.parse(normalizeMarkdown(raw), { async: false }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

/* -------------------------------------------------------------------------- */
/* Client-side PDF extraction                                                 */
/* -------------------------------------------------------------------------- */

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export interface PdfProgress {
  page: number;
  totalPages: number;
  percent: number;
}

export interface PdfExtraction {
  title: string;
  text: string;
  pageCount: number;
}

function cleanPageText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pdfReadError(error: unknown): Error {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";

  if (name === "PasswordException") {
    return new Error("This PDF is password-protected. Remove the password and try again.");
  }
  if (name === "InvalidPDFException") {
    return new Error("This file is not a valid PDF.");
  }

  console.warn("[PDF] Failed to open document:", error);
  return new Error("Could not open this PDF. It may be corrupted or use an unsupported format.");
}

/**
 * Extracts selectable text from a local PDF entirely in the browser.
 * The PDF.js worker is bundled locally, so this never touches the network.
 */
export async function extractPdfText(
  file: File,
  onProgress?: (progress: PdfProgress) => void
): Promise<PdfExtraction> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    throw new Error("Please choose a PDF file.");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("This PDF is larger than 50 MB. Split it into smaller files and try again.");
  }
  if (file.size === 0) {
    throw new Error("This PDF is empty.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data });

  const pdf = await loadingTask.promise.catch((error: unknown) => {
    throw pdfReadError(error);
  });

  try {
    const totalPages = pdf.numPages;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const pageText = cleanPageText(
          content.items
            .map((item) => ("str" in item ? (item.hasEOL ? `${item.str}\n` : `${item.str} `) : ""))
            .join("")
        );
        pages.push(`## Page ${pageNumber}\n\n${pageText || "_No selectable text on this page._"}`);
      } finally {
        page.cleanup();
      }

      onProgress?.({
        page: pageNumber,
        totalPages,
        percent: Math.round((pageNumber / totalPages) * 100),
      });
    }

    const selectableCharacters = pages.join("").replace(/## Page \d+/g, "").trim().length;
    if (selectableCharacters < 20) {
      throw new Error(
        "This PDF has no selectable text. It looks like a scanned document — run OCR on it first, then import again."
      );
    }

    const title =
      file.name
        .replace(/\.pdf$/i, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Imported PDF";

    return {
      title,
      pageCount: totalPages,
      text: `# ${title}\n\n> Imported locally from ${file.name} · ${totalPages} page${
        totalPages === 1 ? "" : "s"
      }\n\n${pages.join("\n\n")}`,
    };
  } finally {
    await loadingTask.destroy();
  }
}
