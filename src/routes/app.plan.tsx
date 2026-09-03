import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AppCard, AppLabel, EmptyState, LinkButton, ProgressBar } from "@/components/app/ui";
import { KnowledgeMap } from "@/components/app/KnowledgeMap";
import { getDocumentReinforcementAreas } from "@/lib/questions.functions";
import { storageService } from "@/services/storageService";
import { getStudyAnalysisForDocument } from "@/services/studyAnalysisService";
import type { Concept, RecommendedSession, StudyAnalysis } from "@/types/study";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/plan")({
  validateSearch: (search: Record<string, unknown>) => ({
    documentId: typeof search["documentId"] === "string" ? search["documentId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Your study plan — NEXA Workspace" },
      { name: "description", content: "An AI-generated session built from your own material." },
      { property: "og:title", content: "Your study plan — NEXA Workspace" },
      { property: "og:description", content: "Session structure, knowledge map and weak areas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Plan,
});

function Plan() {
  const { documentId } = Route.useSearch();
  const { t } = useI18n();
  const [analysis, setAnalysis] = useState<StudyAnalysis | null | undefined>(undefined);
  const [reinforcement, setReinforcement] = useState<{
    completedSessions: number;
    areas: { title: string; misses: number; total: number; reason: string }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAnalysis(undefined);
    setReinforcement(null);

    if (!documentId) {
      setAnalysis(null);
      setReinforcement({ completedSessions: 0, areas: [] });
      return;
    }

    const stored = storageService.getAnalysis();
    if (stored?.documentId === documentId) setAnalysis(stored);

    getStudyAnalysisForDocument(documentId)
      .then((rebuilt) => {
        if (!cancelled) setAnalysis(rebuilt);
      })
      .catch(() => {
        if (!cancelled) setAnalysis(null);
      });

    getDocumentReinforcementAreas({ data: { documentId } })
      .then((result) => {
        if (!cancelled) setReinforcement(result);
      })
      .catch(() => {
        if (!cancelled) setReinforcement({ completedSessions: 0, areas: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (analysis === undefined) return null;
  if (!analysis) {
    return (
      <EmptyState
        title={t("plan.noPlanTitle")}
        body={t("plan.noPlanBody")}
        actionLabel={t("common.addMaterial")}
        actionTo="/app/material"
      />
    );
  }

  const areas = reinforcement?.areas ?? [];
  const hasCompletedSessions = (reinforcement?.completedSessions ?? 0) > 0;
  const session = buildSessionStructure(analysis.concepts, areas, t);

  return (
    <div className="mx-auto max-w-[1100px] space-y-8">
      <header>
        <AppLabel>{t("plan.title")}</AppLabel>
        <h1 className="display-sm mt-4">{analysis.subject}</h1>
        <p className="mt-3 text-base text-muted-foreground">{analysis.chapter}</p>
        <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs text-muted-foreground">
          <li>{t("plan.conceptsIdentified", { count: analysis.concepts.length })}</li>
          <li>{t("plan.areasNeed", { count: areas.length })}</li>
          <li className="text-lime">{t("plan.guidedReady")}</li>
        </ul>
      </header>

      <AppCard>
        <AppLabel>{t("plan.knowledgeMap")}</AppLabel>
        <p className="mt-3 text-sm text-muted-foreground">{t("plan.knowledgeMapDescription")}</p>
        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[560px]">
            <KnowledgeMap concepts={analysis.concepts} />
          </div>
        </div>
      </AppCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <AppCard>
          <AppLabel>{t("plan.structure")}</AppLabel>
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {session.blocks.map((b, i) => (
              <motion.li
                key={b.index}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[11px] text-lime">{b.index}</span>
                  <div>
                    <p className="text-sm">{b.title}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{b.detail}</p>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </AppCard>

        <AppCard>
          <AppLabel>
            {hasCompletedSessions ? t("plan.areasCount", { count: areas.length }) : t("plan.areas")}
          </AppLabel>
          {!hasCompletedSessions ? (
            <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              {t("plan.firstSessionEmpty")}
            </div>
          ) : areas.length > 0 ? (
            <>
              <ul className="mt-6 space-y-6">
                {areas.map((area, i) => (
                  <li key={area.title}>
                    <div className="flex items-baseline gap-4">
                      <span className="font-mono text-[11px] text-lime">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm">{area.title}</p>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {t("plan.missedTimes", { count: area.misses, plural: area.misses === 1 ? "" : "s" })}
                          </span>
                        </div>
                        <ProgressBar
                          value={(area.misses / Math.max(1, area.total)) * 100}
                          className="mt-3"
                          label={area.title}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">{area.reason}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                to="/app/session"
                search={{ documentId: analysis.documentId }}
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-lime/40 hover:bg-surface-2"
              >
                {t("plan.focusWeak")} <span aria-hidden>→</span>
              </Link>
            </>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              {t("plan.noIncorrect")}
            </div>
          )}
        </AppCard>
      </div>

      <div className="flex flex-wrap gap-3">
        {analysis.documentId ? (
          <Link
            to="/app/session"
            search={{ documentId: analysis.documentId }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--glow-lime)]"
          >
            {t("plan.startSession")} <span aria-hidden>→</span>
          </Link>
        ) : (
          <LinkButton to="/app/session">
            {t("plan.startSession")} <span aria-hidden>→</span>
          </LinkButton>
        )}
        <LinkButton to="/app/materials" variant="ghost">
          {t("common.reviewMaterial")}
        </LinkButton>
      </div>
    </div>
  );
}

function buildSessionStructure(
  concepts: Concept[],
  areas: { title: string }[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): RecommendedSession {
  const warmupConcepts = concepts.slice(0, 2).map((concept) => concept.title).join(", ");
  const reviewConcepts = concepts.slice(-2).map((concept) => concept.title).join(", ");
  const practiceDetail =
    areas.length > 0
      ? `${t("plan.practiceDetail")}; ${areas.map((area) => area.title).join(", ")}`
      : t("plan.practiceDetail");

  return {
    minutes: 0,
    blocks: [
      {
        index: "01",
        title: t("plan.blocks.warmup"),
        detail: warmupConcepts || t("plan.currentConcepts"),
        minutes: 0,
      },
      {
        index: "02",
        title: t("plan.blocks.core"),
        detail: `${concepts.length} ${t("plan.blocks.core").toLowerCase()}`,
        minutes: 0,
      },
      {
        index: "03",
        title: t("plan.blocks.practice"),
        detail: practiceDetail,
        minutes: 0,
      },
      {
        index: "04",
        title: t("plan.blocks.review"),
        detail: reviewConcepts
          ? `${t("plan.reviewDetail")}: ${reviewConcepts}`
          : t("plan.reviewDetail"),
        minutes: 0,
      },
    ],
  };
}
