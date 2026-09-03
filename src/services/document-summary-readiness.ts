export interface SummaryReference {
  topic_id: string | null;
}

/** A material summary is only ready when it is scoped to the whole document. */
export function hasDocumentSummary(
  summaries: readonly SummaryReference[] | null | undefined,
): boolean {
  return summaries?.some((summary) => summary.topic_id === null) ?? false;
}
