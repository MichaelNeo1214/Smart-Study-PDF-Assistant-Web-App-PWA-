export function relativeTime(timestamp?: number): string {
  if (!timestamp) return "just now";

  const difference = Date.now() - timestamp;
  if (difference < 45_000) return "just now";

  const minutes = Math.round(difference / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(timestamp);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Mirrors the ~4 characters per token heuristic used by aiService. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function snippet(text: string, maxLength = 120): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trimEnd()}…`;
}

export function initials(name?: string | null): string {
  if (!name) return "N";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "N";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
