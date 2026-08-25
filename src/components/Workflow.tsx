import { useEffect, useRef } from "react";
import { getGsap, prefersReducedMotion } from "@/animations/scroll";
import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function Workflow() {
  const { locale, t } = useI18n();
  const log = landingContent[locale].workflowLog;
  const result = landingContent[locale].workflowResult;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const { gsap } = getGsap();

    const ctx = gsap.context(() => {
      gsap.from("[data-log-line]", {
        opacity: 0,
        y: 8,
        stagger: 0.18,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: { trigger: root, start: "top 70%" },
      });
      gsap.from("[data-result-cell]", {
        opacity: 0,
        y: 14,
        stagger: 0.08,
        duration: 0.6,
        delay: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 70%" },
      });
      gsap.fromTo(
        "[data-upload-bar]",
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.4,
          ease: "power2.inOut",
          scrollTrigger: { trigger: root, start: "top 75%" },
        },
      );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section className="border-y border-border bg-surface/30 py-28 md:py-40">
      <div className="shell">
        <SectionLabel>{t("landing.workflowLabel")}</SectionLabel>
        <Reveal>
          <h2 className="display-sm mt-7 max-w-[15ch]">
            {t("landing.workflowTitle")}{" "}
            <span className="editorial text-lime">{t("landing.workflowHighlight")}</span>
          </h2>
        </Reveal>

        <div ref={ref} className="mt-16 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-8">
            <p className="label-mono">{t("landing.upload")}</p>
            <div className="mt-6 rounded-xl border border-dashed border-border p-6">
              <p className="font-mono text-sm text-foreground">{t("landing.workflowFileName")}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{t("landing.workflowFileMeta")}</p>
              <div className="mt-5 h-px w-full bg-surface-3">
                <div data-upload-bar className="h-px origin-left bg-lime" />
              </div>
            </div>
            <div className="mt-8 space-y-2.5">
              {log.map((l, i) => (
                <p
                  key={l}
                  data-log-line
                  className={`font-mono text-xs ${i === log.length - 1 ? "text-lime" : "text-muted-foreground"}`}
                >
                  <span className="mr-3 opacity-50">{String(i + 1).padStart(2, "0")}</span>
                  {l}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-8">
            <p className="label-mono">{t("landing.resultChapter")}</p>
            <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-3">
              {result.map(([v, l]) => (
                <div key={l} data-result-cell>
                  <p className="font-mono text-3xl tracking-tight">{v}</p>
                  <p className="label-mono mt-1">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 border-t border-border pt-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("landing.workflowBody")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
