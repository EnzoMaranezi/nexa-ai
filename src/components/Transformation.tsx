import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function Transformation() {
  const { locale, t } = useI18n();
  const steps = landingContent[locale].transformationSteps;

  return (
    <section className="border-y border-border bg-surface/30 py-28 md:py-40">
      <div className="shell">
        <SectionLabel>{t("landing.transformationLabel")}</SectionLabel>
        <Reveal>
          <h2 className="display mt-7 max-w-[12ch]">
            {t("landing.transformationTitle")}{" "}
            <span className="editorial text-lime">{t("landing.transformationHighlight")}</span>
          </h2>
        </Reveal>

        <div className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12} className="bg-background">
              <div className="group h-full p-8 transition-colors duration-500 hover:bg-surface md:p-10">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-lime">{s.n}</span>
                  <span className="label-mono">{s.title}</span>
                </div>
                <p className="mt-10 text-2xl leading-snug tracking-tight">{s.line}</p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                <ul className="mt-8 space-y-2 border-t border-border pt-6">
                  {s.items.map((it) => (
                    <li
                      key={it}
                      className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground"
                    >
                      <span className="h-px w-4 bg-lime/60" aria-hidden />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
