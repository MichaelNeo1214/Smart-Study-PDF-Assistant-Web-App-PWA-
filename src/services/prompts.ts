import { rcNumber } from "./remoteConfig";

export function buildFlashcardPrompt(text: string): string {
  const requested = rcNumber("flashcard_count") || 10;
  const count = Math.max(3, Math.min(20, requested));

  return [
    "You are an expert study assistant. Create a flashcard deck from the study text below.",
    `Produce exactly ${count} cards in English.`,
    "Each card has: front (question or term, max 120 characters), back (answer or explanation, max 300 characters), and tag (short topic label, optional).",
    'Return ONLY a JSON object with this shape: {"cards":[{"front":"...","back":"...","tag":"..."}]}',
    "No Markdown code fences, no commentary, no extra keys.",
    "Do not invent facts that are not supported by the text.",
    "",
    "STUDY TEXT:",
    text,
  ].join("\n");
}

export function buildFlashcardRepairPrompt(rawOutput: string): string {
  return [
    "The output below was meant to be one valid JSON object with a cards array, but it was malformed.",
    "Return only the corrected JSON object. No Markdown fences and no commentary.",
    "",
    rawOutput,
  ].join("\n");
}

export function buildExamGuidePrompt(text: string): string {
  return [
    "You are an expert study coach. Turn the study text below into a compact exam guide in English.",
    "Use exactly this Markdown structure, with no other top-level sections:",
    "# <Topic title>",
    "## 1. Quick Summary",
    "## 2. Key Concepts",
    "## 3. Formulas and Comparisons",
    "## 4. Sample Questions with Answers",
    "## 5. Final Checklist",
    "Rules: use only # and ## headings; prefer short bullet lists; do not invent facts outside the text;",
    "use a Markdown table in section 3 only when it genuinely helps; return only the Markdown document.",
    "",
    "STUDY TEXT:",
    text,
  ].join("\n");
}
