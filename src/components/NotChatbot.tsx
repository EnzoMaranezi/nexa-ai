import { useState } from "react";
import { motion } from "motion/react";
import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function NotChatbot() {
  const { locale, t } = useI18n();
  const comparison = landingContent[locale].featureComparison;
  const [active, setActive] = useState(0);

  return (
    <section className="border-y border-border bg-surface/30 py-28 md:py-40">
      <div className="shell grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionLabel>{t("landing.positioningLabel")}</SectionLabel>
          <Reveal>
            <h2 className="display-sm mt-7 max-w-[13ch]">
              {t("landing.positioningTitle")}{" "}
              <span className="editorial text-muted-foreground">{t("landing.positioningHighlight")}</span>
            </h2>
            <p className="mt-8 max-w-sm text-base leading-relaxed text-muted-foreground">
              {t("landing.positioningBody")}
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border">
            {comparison.map(([before, after], i) => (
              <li key={before}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-pressed={active === i}
                  className="grid w-full grid-cols-2 items-center gap-4 bg-background px-5 py-5 text-left transition-colors duration-400 hover:bg-surface md:px-8"
                >
                  <span
                    className={`text-sm transition-colors duration-400 ${
                      active === i ? "text-muted-foreground line-through" : "text-muted-foreground/70"
                    }`}
                  >
                    {before}
                  </span>
                  <span className="relative flex items-center gap-3">
                    {active === i && (
                      <motion.span
                        layoutId="compare-marker"
                        className="absolute -left-4 h-6 w-px bg-lime"
                        transition={{ type: "spring", stiffness: 320, damping: 34 }}
                        aria-hidden
                      />
                    )}
                    <span
                      className={`text-sm transition-colors duration-400 ${
                        active === i ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {after}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-between px-1">
            <span className="label-mono">{t("landing.traditionalAi")}</span>
            <span className="label-mono text-lime">{t("landing.academicAgent")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
