/** Returns the first available localized pasted-note title without changing existing materials. */
export function nextPastedNoteTitle(baseTitle: string, existingTitles: readonly string[]): string {
  const normalizedTitles = new Set(existingTitles.map((title) => title.trim().toLocaleLowerCase()));
  const normalizedBase = baseTitle.trim().toLocaleLowerCase();

  if (!normalizedTitles.has(normalizedBase)) return baseTitle;

  let suffix = 2;
  while (normalizedTitles.has(`${normalizedBase} ${suffix}`)) suffix += 1;
  return `${baseTitle} ${suffix}`;
}
