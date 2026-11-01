const FALLBACK_INITIALS = "?";
const MAX_INITIALS = 2;

/** "Maria da Silva" → "MS"; one word → its first letter; blank → "?". */
export function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return FALLBACK_INITIALS;

  const firstAndLast =
    words.length === 1 ? words : [words[0], words[words.length - 1]];

  return firstAndLast
    .slice(0, MAX_INITIALS)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
