import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function HowItWorks() {
  const { locale, t } = useI18n();
  const steps = landingContent[locale].howSteps;

  return (
    <section id="how-it-works" className="border-y border-border bg-surface/30 py-28 md:py-40">
      <div className="shell">
        <SectionLabel>{t("landing.howLabel")}</SectionLabel>
        <Reveal>
          <h2 className="display-sm mt-7 max-w-[14ch]">
            {t("landing.howTitle")} <span className="editorial text-lime">{t("landing.howHighlight")}</span>
          </h2>
        </Reveal>

        <div className="relative mt-20">
          <div className="absolute left-0 top-[7px] hidden h-px w-full bg-border md:block" aria-hidden />
          <div className="absolute left-4 top-0 h-full w-px bg-border md:hidden" aria-hidden />

          <ol className="grid gap-12 md:grid-cols-3 md:gap-10">
            {steps.map(([n, title, d], i) => (
              <Reveal key={n} delay={i * 0.12}>
                <li className="relative pl-12 md:pl-0">
                  <span
                    className="absolute left-[13px] top-[1px] h-3.5 w-3.5 rounded-full border border-lime bg-background md:left-0"
                    aria-hidden
                  />
                  <div className="md:pt-10">
                    <span className="font-mono text-[11px] text-lime">{n}</span>
                    <h3 className="mt-3 text-2xl tracking-tight">{title}</h3>
                    <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{d}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
