import { motion } from "motion/react";
import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

const SERIES = [22, 31, 28, 44, 51, 49, 63, 70, 68, 79, 82];

export function Analytics() {
  const { locale, t } = useI18n();
  const stats = landingContent[locale].featureStats;
  const max = Math.max(...SERIES);
  const points = SERIES.map((v, i) => `${(i / (SERIES.length - 1)) * 100},${100 - (v / max) * 92}`).join(" ");

  return (
    <section className="border-y border-border bg-surface/30 py-28 md:py-40">
      <div className="shell">
        <SectionLabel>{t("landing.analyticsLabel")}</SectionLabel>
        <Reveal>
          <h2 className="display-sm mt-7 max-w-[13ch]">
            {t("landing.analyticsTitle")}{" "}
            <span className="editorial text-lime">{t("landing.analyticsHighlight")}</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-4 lg:grid-cols-12">
          <div className="grid grid-cols-2 gap-4 lg:col-span-5 lg:grid-cols-2">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-border bg-background p-6">
                  <p className="label-mono">{s.label}</p>
                  <p
                    className={`mt-6 font-mono text-4xl tracking-tight ${i === 3 ? "text-foreground" : "text-lime"}`}
                  >
                    {s.value}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.12} className="lg:col-span-7">
            <div className="h-full rounded-2xl border border-border bg-background p-8">
              <div className="flex items-baseline justify-between">
                <p className="label-mono">{t("landing.masteryOverTime")}</p>
                <p className="label-mono">{t("landing.lastWeeks")}</p>
              </div>
              <div className="mt-8">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-52 w-full" aria-hidden>
                  {[25, 50, 75].map((y) => (
                    <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
                  ))}
                  <motion.polyline
                    points={points}
                    fill="none"
                    stroke="#D4FF4F"
                    strokeWidth="0.9"
                    vectorEffect="non-scaling-stroke"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
                <div className="mt-4 flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span>{t("landing.week01")}</span>
                  <span>{t("landing.week11")}</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
