import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AppCard, AppLabel, EmptyState, GhostButton, PrimaryButton } from "@/components/app/ui";
import { getDocumentReinforcementAreas } from "@/lib/questions.functions";
import { useI18n } from "@/lib/i18n";
import { storageService } from "@/services/storageService";
import { getStudyAnalysisForDocument } from "@/services/studyAnalysisService";
import type { Concept, StudyAnalysis } from "@/types/study";

export const Route = createFileRoute("/app/session")({
  validateSearch: (search: Record<string, unknown>) => ({
    documentId: typeof search["documentId"] === "string" ? search["documentId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Study session — NEXA Workspace" },
      { name: "description", content: "Active recall session generated from your own material." },
      { property: "og:title", content: "Study session — NEXA Workspace" },
      { property: "og:description", content: "Answer, get feedback, build mastery." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Session,
});

function Session() {
  const { documentId } = Route.useSearch();
  const { t } = useI18n();
  const [analysis, setAnalysis] = useState<StudyAnalysis | null | undefined>(undefined);
  const [step, setStep] = useState<"warmup" | "core">("warmup");
  const [weakAreaTitles, setWeakAreaTitles] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setAnalysis(undefined);
    setWeakAreaTitles([]);

    if (!documentId) {
      setAnalysis(null);
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
        if (!cancelled) setWeakAreaTitles(result.areas.map((area) => area.title));
      })
      .catch(() => {
        if (!cancelled) setWeakAreaTitles([]);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (analysis === undefined) return null;
  if (!analysis || !documentId) {
    return (
      <EmptyState
        title={t("session.noTitle")}
        body={t("session.noBody")}
        actionLabel={t("common.goToMaterials")}
        actionTo="/app/materials"
      />
    );
  }

  const concepts = prioritizeConcepts(analysis.concepts, weakAreaTitles);
  const warmupConcepts = concepts.slice(0, 3);

  return (
    <div className="mx-auto max-w-[860px] space-y-8">
      <header>
        <AppLabel>{t("session.guided")}</AppLabel>
        <h1 className="display-sm mt-4">{analysis.subject}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{analysis.title}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        {t("session.steps").split("|").map((label, index) => (
          <div
            key={label}
            className={`rounded-xl border px-4 py-3 font-mono text-[11px] ${
              index === (step === "warmup" ? 0 : 1)
                ? "border-lime/50 text-lime"
                : "border-border text-muted-foreground"
            }`}
          >
            {String(index + 1).padStart(2, "0")} {label}
          </div>
        ))}
      </div>

      {step === "warmup" ? (
        <AppCard>
          <AppLabel>01 {t("plan.blocks.warmup")}</AppLabel>
          <h2 className="mt-4 text-2xl tracking-tight">{t("session.warmupTitle")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("session.warmupBody")}
          </p>

          <ConceptList concepts={warmupConcepts} />

          <PrimaryButton className="mt-8" onClick={() => setStep("core")}>
            {t("common.continue")} <span aria-hidden>→</span>
          </PrimaryButton>
        </AppCard>
      ) : (
        <AppCard>
          <AppLabel>02 {t("plan.blocks.core")}</AppLabel>
          <h2 className="mt-4 text-2xl tracking-tight">{t("session.coreTitle")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("session.coreBody")}
          </p>

          <ConceptList concepts={concepts} />

          <div className="mt-8 flex flex-wrap gap-3">
            <GhostButton onClick={() => setStep("warmup")}>{t("session.backWarmup")}</GhostButton>
            <Link
              to="/app/questions/$documentId"
              params={{ documentId }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--glow-lime)]"
            >
              {t("session.startPractice")} <span aria-hidden>→</span>
            </Link>
          </div>
        </AppCard>
      )}
    </div>
  );
}

function prioritizeConcepts(concepts: Concept[], weakAreaTitles: string[]) {
  if (weakAreaTitles.length === 0) return concepts;
  const weak = new Set(weakAreaTitles.map((title) => title.toLowerCase()));
  return [...concepts].sort((a, b) => {
    const aWeak = weak.has(a.title.toLowerCase()) ? 1 : 0;
    const bWeak = weak.has(b.title.toLowerCase()) ? 1 : 0;
    return bWeak - aWeak;
  });
}

function ConceptList({ concepts }: { concepts: Concept[] }) {
  const { t } = useI18n();
  if (concepts.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        {t("session.noConcepts")}
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-3 md:grid-cols-2">
      {concepts.map((concept, index) => (
        <motion.li
          key={concept.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04, duration: 0.3 }}
          className="rounded-xl border border-border bg-surface-2/40 p-4"
        >
          <p className="text-sm">{concept.title}</p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {concept.context ?? t("session.contextMissing")}
          </p>
        </motion.li>
      ))}
    </ul>
  );
}
