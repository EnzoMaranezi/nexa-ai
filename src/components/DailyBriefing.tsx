import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function DailyBriefing() {
  const { locale, t } = useI18n();
  const tasks = landingContent[locale].dailyTasks;

  return (
    <section className="shell py-28 md:py-40">
      <div className="grid gap-14 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <SectionLabel>{t("landing.dailyLabel")}</SectionLabel>
          <Reveal>
            <h2 className="display-sm mt-7 max-w-[13ch]">
              {t("landing.dailyTitle")} <span className="editorial">{t("landing.dailyHighlight")}</span>
            </h2>
            <p className="mt-8 max-w-sm text-base leading-relaxed text-muted-foreground">
              {t("landing.dailyBody")}
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-border bg-surface/60 p-8 md:p-10">
              <p className="label-mono">{t("landing.goodEvening")}</p>
              <p className="mt-3 text-2xl tracking-tight">{t("landing.todayMatters")}</p>

              <ul className="mt-10 divide-y divide-border border-y border-border">
                {tasks.map(([n, task, d]) => (
                  <li
                    key={n}
                    className="group flex items-center justify-between gap-6 py-5 transition-colors hover:bg-surface-2/60"
                  >
                    <div className="flex items-baseline gap-5">
                      <span className="font-mono text-[11px] text-lime">{n}</span>
                      <span className="text-base">{task}</span>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{d}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-baseline justify-between">
                <span className="label-mono">{t("landing.total")}</span>
                <span className="font-mono text-2xl text-foreground">{t("landing.totalMinutes")}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
