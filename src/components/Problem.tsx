import { motion } from "motion/react";
import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function Problem() {
  const { locale, t } = useI18n();
  const fragments = landingContent[locale].problemFragments;

  return (
    <section id="product" className="shell py-28 md:py-40">
      <div className="grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionLabel>{t("landing.problemLabel")}</SectionLabel>
          <Reveal>
            <h2 className="display-sm mt-7 max-w-[14ch]">
              {t("landing.problemTitle")}{" "}
              <span className="editorial text-muted-foreground">{t("landing.problemHighlight")}</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground">
              {t("landing.problemBody")}
            </p>
            <p className="mt-6 max-w-md text-base leading-relaxed text-foreground">
              {t("landing.problemStudent")}
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <div className="relative rounded-3xl border border-border bg-surface/40 p-6 md:p-10">
            <div className="flex flex-wrap gap-2.5">
              {fragments.map((f, i) => (
                <motion.span
                  key={f}
                  initial={{ opacity: 0, x: (i % 3) * 14 - 14, y: (i % 4) * 10 - 12 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.9, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-full border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  {f}
                </motion.span>
              ))}
            </div>

            <div className="my-10 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="label-mono">{t("landing.converge")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-lime/25 bg-surface-2 p-8 text-center"
              style={{ boxShadow: "var(--glow-lime)" }}
            >
              <p className="label-mono">{t("landing.oneSystem")}</p>
              <p className="mt-3 text-2xl tracking-tight md:text-3xl">
                {t("landing.oneMemory")}
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
