import { useState } from "react";
import { motion } from "motion/react";
import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

type Node = { id: string; x: number; y: number; sub: string[]; mastery: number };

export function KnowledgeGraph() {
  const { locale, t } = useI18n();
  const nodes = landingContent[locale].knowledgeNodes as Node[];
  const [active, setActive] = useState<Node | null>(null);

  return (
    <section className="border-y border-border bg-surface/30 py-28 md:py-40">
      <div className="shell grid gap-14 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-4">
          <SectionLabel>{t("landing.graphLabel")}</SectionLabel>
          <Reveal>
            <h2 className="display-sm mt-7 max-w-[12ch]">
              {t("landing.graphTitle")} <span className="editorial">{t("landing.graphHighlight")}</span>
            </h2>
            <p className="mt-8 max-w-sm text-base leading-relaxed text-muted-foreground">
              {t("landing.graphBody")}
            </p>
          </Reveal>

          <div className="mt-10 min-h-[132px] rounded-2xl border border-border bg-surface p-6">
            {active ? (
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="label-mono">{t("landing.selectedNode")}</p>
                <p className="mt-2 text-lg tracking-tight">{active.id}</p>
                <p className="mt-1 font-mono text-xs text-lime">
                  {t("landing.mastery")} {active.mastery}%
                </p>
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                  {active.sub.join(" · ")}
                </p>
              </motion.div>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">
                {t("landing.hoverNode")}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="relative mx-auto aspect-square w-full max-w-[620px]">
            <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={t("landing.graphAria")}>
              {nodes.map((n) => (
                <line
                  key={n.id}
                  x1="50"
                  y1="50"
                  x2={n.x}
                  y2={n.y}
                  stroke={active?.id === n.id ? "#D4FF4F" : "rgba(255,255,255,0.12)"}
                  strokeWidth={active?.id === n.id ? 0.5 : 0.25}
                  className="transition-all duration-500"
                />
              ))}
              <circle cx="50" cy="50" r="9" fill="var(--surface-3)" stroke="rgba(212,255,79,0.4)" strokeWidth="0.4" />
              <text x="50" y="50.9" textAnchor="middle" fontSize="3.2" fill="#F5F5F0" fontFamily="var(--font-mono)" letterSpacing="0.4">
                {t("landing.you")}
              </text>

              {nodes.map((n) => (
                <g
                  key={n.id}
                  onMouseEnter={() => setActive(n)}
                  onMouseLeave={() => setActive(null)}
                  tabIndex={0}
                  onFocus={() => setActive(n)}
                  onBlur={() => setActive(null)}
                  className="cursor-pointer outline-none"
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={active?.id === n.id ? 6.4 : 5.2}
                    fill="var(--surface-2)"
                    stroke={active?.id === n.id ? "#D4FF4F" : "rgba(255,255,255,0.16)"}
                    strokeWidth="0.4"
                    className="transition-all duration-400"
                  />
                  <text
                    x={n.x}
                    y={n.y + 0.9}
                    textAnchor="middle"
                    fontSize="2.1"
                    fill={active?.id === n.id ? "#D4FF4F" : "rgba(245,245,240,0.75)"}
                    fontFamily="var(--font-mono)"
                  >
                    {n.id.length > 11 ? n.id.slice(0, 9) + "…" : n.id}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
