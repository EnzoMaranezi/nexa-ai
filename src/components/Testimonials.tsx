import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function Testimonials() {
  const { locale, t } = useI18n();
  const testimonials = landingContent[locale].testimonials;

  return (
    <section className="shell py-28 md:py-40">
      <SectionLabel>{t("landing.voicesLabel")}</SectionLabel>
      <Reveal>
        <h2 className="display-sm mt-7 max-w-[14ch]">
          {t("landing.voicesTitle")} <span className="editorial">{t("landing.voicesHighlight")}</span>
        </h2>
      </Reveal>

      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {testimonials.map((item, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <figure className="flex h-full flex-col justify-between rounded-2xl border border-border bg-surface/60 p-8 transition-all duration-500 hover:-translate-y-1 hover:border-lime/25">
              <blockquote className="text-lg leading-snug tracking-tight">"{item.quote}"</blockquote>
              <figcaption className="mt-10 border-t border-border pt-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em]">{item.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.role}</p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
      <p className="mt-8 font-mono text-[11px] text-muted-foreground/60">
        {t("landing.placeholderQuotes")}
      </p>
    </section>
  );
}
