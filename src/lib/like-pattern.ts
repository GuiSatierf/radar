/** Text typed in a search becomes a "contains" pattern where % and _ are letters, not wildcards. */
export function containsPattern(text: string): string {
  const escaped = text.replace(/[\\%_]/g, (character) => `\\${character}`);

  return `%${escaped}%`;
}
