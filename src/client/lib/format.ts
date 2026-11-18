/** "2026-12-02" → "2 Dec 2026"; empty for no date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-11-30T14:15" → "30 Nov 2026, 14:15". */
export function formatDateTime(value: string): string {
  const [day, time] = value.split("T");
  return time ? `${formatDate(day)}, ${time.slice(0, 5)}` : formatDate(day);
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function fileKind(contentType: string): string {
  if (contentType === "application/pdf") return "PDF";
  if (contentType.startsWith("image/"))
    return `${contentType.slice(6).toUpperCase()} image`;
  return contentType;
}

/** The message of a failed server call, without framework prefixes. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    try {
      const parsed = JSON.parse(error.message);
      if (Array.isArray(parsed) && parsed[0]?.message) return parsed[0].message;
    } catch {
      // Not JSON: the message as thrown.
    }
    return error.message;
  }
  return "That didn't work. Try again.";
}
