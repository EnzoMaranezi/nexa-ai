import { Reveal } from "./primitives";
import { useI18n } from "@/lib/i18n";

export function FinalCTA({ onStart }: { onStart?: () => void }) {
  const { t } = useI18n();

  return (
    <section className="relative grain overflow-hidden py-32 md:py-48">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 100%, color-mix(in oklab, var(--lime) 10%, transparent) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="shell relative text-center">
        <Reveal>
          <h2 className="display mx-auto max-w-[16ch]">
            {t("landing.finalTitle")}{" "}
            <span className="editorial text-lime">{t("landing.finalHighlight")}</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-8 max-w-sm text-base leading-relaxed text-muted-foreground">
            {t("landing.finalBody")}
          </p>
          <button
            type="button"
            onClick={onStart}
            className="group mt-10 inline-flex items-center gap-2.5 rounded-full bg-lime px-8 py-4 text-sm font-medium text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--glow-lime)]"
          >
            {t("landing.startStudying")}
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </button>
        </Reveal>
      </div>
    </section>
  );
}
