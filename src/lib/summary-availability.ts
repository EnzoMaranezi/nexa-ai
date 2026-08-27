import type { Locale, PersistedContentLocale } from "@/lib/i18n";
import type { StudySummary } from "@/lib/summary.schema";

export interface SummaryAvailabilityVariant {
  id: string;
  locale: PersistedContentLocale;
  createdAt: string;
  updatedAt: string;
  summary: StudySummary;
}

export function resolveSummaryAvailability(
  variants: SummaryAvailabilityVariant[],
  locale: Locale,
) {
  return {
    requestedLocale: locale,
    current: variants.find((variant) => variant.locale === locale) ?? null,
    alternatives: variants.filter((variant) => variant.locale !== locale),
  };
}
