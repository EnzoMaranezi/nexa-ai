import type { Locale } from "@/lib/i18n";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };

/** Formats a date using the language selected inside NEXA, not the browser default. */
export function formatAbsoluteDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, DATE_OPTIONS).format(date);
}

/** Formats date and time using the language selected inside NEXA. */
export function formatDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Human-friendly relative day label for session timestamps. */
export function relativeDay(iso: string | null | undefined, locale: Locale, now = new Date()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);

  if (days <= 0) return locale === "pt-BR" ? "Hoje" : "Today";
  if (days === 1) return locale === "pt-BR" ? "Ontem" : "Yesterday";
  if (days < 7) return locale === "pt-BR" ? `Há ${days} dias` : `${days} days ago`;
  return formatAbsoluteDate(iso, locale);
}
