import DOMPurify from "dompurify";
import { marked } from "marked";
import { z } from "zod";
import type { Flashcard } from "../types/models";

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
