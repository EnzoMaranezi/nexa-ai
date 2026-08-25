import { Reveal, SectionLabel, Bar } from "./primitives";
import { useI18n } from "@/lib/i18n";

export function StudySession() {
  const { t } = useI18n();

  return (
    <section className="shell py-28 md:py-40">
      <div className="grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionLabel>{t("landing.studySessionLabel")}</SectionLabel>
          <Reveal>
            <h2 className="display-sm mt-7 max-w-[12ch]">
              {t("landing.studySessionTitle")}{" "}
              <span className="editorial text-lime">{t("landing.studySessionHighlight")}</span>
            </h2>
            <p className="mt-8 max-w-sm text-base leading-relaxed text-muted-foreground">
              {t("landing.studySessionBody")}
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-8">
          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface/60">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <span className="label-mono">{t("landing.session04")}</span>
                <span className="label-mono">{t("landing.question0812")}</span>
              </div>

              <div className="p-6 md:p-9">
                <p className="text-xs uppercase tracking-[0.2em] text-lime">
                  {t("landing.tcpConcept")}
                </p>
                <div className="mt-5">
                  <div className="mb-2 flex justify-between font-mono text-[11px] text-muted-foreground">
                    <span>{t("landing.demoProgress")}</span>
                    <span>78%</span>
                  </div>
                  <Bar value={78} />
                </div>

                <p className="mt-10 max-w-lg text-2xl leading-snug tracking-tight md:text-3xl">
                  {t("landing.demoQuestion")}
                </p>

                <div className="mt-8 rounded-xl border border-border bg-background p-5">
                  <p className="font-mono text-xs text-muted-foreground">{t("landing.yourAnswer")}</p>
                  <p className="mt-3 text-sm leading-relaxed">
                    {t("landing.demoAnswer")}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-lime/25 bg-surface-3 p-5">
                  <p className="font-mono text-xs text-lime">{t("landing.agentFeedback")}</p>
                  <p className="mt-3 text-sm leading-relaxed">
                    {t("landing.demoFeedback")}{" "}
                    <span className="text-lime">Fast Recovery</span>. {t("landing.demoFeedbackTail")}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
