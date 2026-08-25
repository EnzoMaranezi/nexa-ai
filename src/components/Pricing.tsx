import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function Pricing({ onStart }: { onStart?: () => void }) {
  const { locale, t } = useI18n();
  const plans = landingContent[locale].pricingPlans;

  return (
    <section id="pricing" className="border-y border-border bg-surface/30 py-28 md:py-40">
      <div className="shell">
        <SectionLabel>{t("landing.pricingLabel")}</SectionLabel>
        <Reveal>
          <h2 className="display-sm mt-7 max-w-[14ch]">
            {t("landing.pricingTitle")}{" "}
            <span className="editorial text-lime">{t("landing.pricingHighlight")}</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-4 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className={`relative flex h-full flex-col rounded-2xl border p-8 ${
                  plan.featured
                    ? "border-lime/40 bg-background"
                    : "border-border bg-background/60"
                }`}
                style={{ boxShadow: plan.featured ? "var(--glow-lime)" : "none" }}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-8 rounded-full bg-lime px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-background">
                    {plan.badge}
                  </span>
                )}
                <p className="label-mono">{plan.name}</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl tracking-tight">{plan.price}</span>
                  <span className="font-mono text-xs text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{plan.description}</p>

                <ul className="mt-8 flex-1 space-y-3 border-t border-border pt-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <Check
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${plan.featured ? "text-lime" : "text-muted-foreground"}`}
                        aria-hidden
                      />
                      <span className={plan.featured ? "text-foreground" : "text-muted-foreground"}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={onStart}
                  className={`group mt-10 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium transition-all duration-300 ${
                    plan.featured
                      ? "bg-lime text-background hover:shadow-[var(--glow-lime)]"
                      : "border border-border text-foreground hover:border-lime/40"
                  }`}
                >
                  {plan.cta}
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </button>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
