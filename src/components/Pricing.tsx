import { Reveal, SectionLabel } from "./primitives";
import { useI18n } from "@/lib/i18n";

export function Pricing({ onStart }: { onStart?: () => void }) {
  const { t } = useI18n();

  return (
    <section id="beta" className="border-y border-border bg-surface/30 py-28 md:py-40">
      <div className="shell">
        <SectionLabel>{t("landing.betaLabel")}</SectionLabel>
        <Reveal>
          <h2 className="display-sm mt-7 max-w-[14ch]">
            {t("landing.betaTitle")} {" "}
            <span className="editorial text-lime">{t("landing.betaHighlight")}</span>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 max-w-2xl rounded-2xl border border-lime/30 bg-background p-8 md:p-10">
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              {t("landing.betaBody")}
            </p>
            <button
              type="button"
              onClick={onStart}
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3.5 text-sm font-medium text-background transition-all duration-300 hover:shadow-[var(--glow-lime)]"
            >
              {t("landing.betaCta")}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
