import { useEffect, useRef } from "react";
import { getGsap, prefersReducedMotion } from "@/animations/scroll";
import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function Intelligence() {
  const { locale, t } = useI18n();
  const pipeline = landingContent[locale].featurePipeline;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const { gsap, ScrollTrigger } = getGsap();

    const ctx = gsap.context(() => {
      gsap.to("[data-pipeline-line]", {
        scaleY: 1,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top 65%", end: "bottom 70%", scrub: 0.6 },
      });

      gsap.utils.toArray<HTMLElement>("[data-stage]").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0.22, x: -12 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 78%" },
          },
        );
        gsap.fromTo(
          el.querySelector("[data-stage-dot]"),
          { backgroundColor: "rgba(255,255,255,0.18)", scale: 1 },
          {
            backgroundColor: "#D4FF4F",
            scale: 1.5,
            duration: 0.5,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 78%" },
          },
        );
      });
    }, root);

    return () => {
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, []);

  return (
    <section id="intelligence" className="shell py-28 md:py-40">
      <SectionLabel>{t("landing.intelligenceLabel")}</SectionLabel>
      <Reveal>
        <h2 className="display mt-7 max-w-[14ch]">
          {t("landing.intelligenceTitle")}{" "}
          <span className="editorial text-lime">{t("landing.intelligenceHighlight")}</span>
        </h2>
      </Reveal>

      <div ref={ref} className="mt-20 grid gap-12 lg:grid-cols-12">
        <div className="relative lg:col-span-7">
          <div className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-border" aria-hidden />
          <div
            data-pipeline-line
            className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px origin-top scale-y-0 bg-lime"
            aria-hidden
          />
          <ol className="space-y-10">
            {pipeline.map((s, i) => (
              <li key={s.label} data-stage className="flex gap-6 pl-0">
                <span
                  data-stage-dot
                  className="mt-2 h-[15px] w-[15px] shrink-0 rounded-full border border-background bg-white/20"
                  aria-hidden
                />
                <div>
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-xl tracking-tight md:text-2xl">{s.label}</h3>
                  </div>
                  <p className="mt-2 pl-9 text-sm text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="lg:col-span-5 lg:pl-8">
          <div className="sticky top-32 rounded-2xl border border-border bg-surface/60 p-8">
            <p className="label-mono">{t("landing.agentLoop")}</p>
            <p className="mt-5 text-lg leading-relaxed">
              {t("landing.agentLoopBody")}
            </p>
            <div className="mt-8 grid grid-cols-2 gap-6 border-t border-border pt-6">
              <div>
                <p className="font-mono text-3xl text-lime">+34%</p>
                <p className="label-mono mt-1">{t("landing.retention30")}</p>
              </div>
              <div>
                <p className="font-mono text-3xl text-foreground">−41%</p>
                <p className="label-mono mt-1">{t("landing.organizingTime")}</p>
              </div>
            </div>
            <p className="mt-6 font-mono text-[11px] text-muted-foreground/70">
              {t("landing.placeholderMetrics")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
