import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Reveal, SectionLabel, Bar } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function Personalization() {
  const { locale, t } = useI18n();
  const profiles = landingContent[locale].personalizationProfiles;
  const [active, setActive] = useState("a");
  const profile = profiles.find((p) => p.id === active) ?? profiles[0]!;

  return (
    <section className="shell py-28 md:py-40">
      <SectionLabel>{t("landing.personalizationLabel")}</SectionLabel>
      <Reveal>
        <h2 className="display-sm mt-7 max-w-[14ch]">
          {t("landing.personalizationTitle")}{" "}
          <span className="editorial">{t("landing.personalizationHighlight")}</span>
        </h2>
      </Reveal>

      <div className="mt-14 flex gap-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            aria-pressed={active === p.id}
            className="relative rounded-full px-5 py-2.5 text-sm transition-colors"
          >
            {active === p.id && (
              <motion.span
                layoutId="profile-pill"
                className="absolute inset-0 rounded-full bg-lime"
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
              />
            )}
            <span className={`relative ${active === p.id ? "text-background" : "text-muted-foreground"}`}>
              {p.name}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={profile.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3"
        >
          <div className="bg-background p-8">
            <p className="label-mono">{t("landing.profile")}</p>
            <ul className="mt-6 space-y-3">
              {profile.traits.map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="h-px w-5 bg-lime/60" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-background p-8">
            <p className="label-mono">{t("landing.measured")}</p>
            <div className="mt-7 space-y-5">
              {profile.metrics.map(([l, v]) => (
                <div key={l as string}>
                  <div className="mb-2 flex justify-between font-mono text-[11px] text-muted-foreground">
                    <span>{l}</span>
                    <span>{v}%</span>
                  </div>
                  <Bar value={v as number} />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-background p-8">
            <p className="label-mono text-lime">{t("landing.agentAdapts")}</p>
            <ul className="mt-6 space-y-3">
              {profile.plan.map((t) => (
                <li key={t} className="text-sm leading-relaxed">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
