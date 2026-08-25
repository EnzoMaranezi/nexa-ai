import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertCircle, Sparkles } from "lucide-react";
import { AppCard, AppLabel, GhostButton, PrimaryButton } from "@/components/app/ui";
import { generateDocumentSummary, getDocumentSummary } from "@/lib/summaries.functions";
import { useI18n } from "@/lib/i18n";
import { aiErrorMessage } from "@/lib/ai-errors";
import type { StudySummary } from "@/lib/summary.schema";
import { GeneratedContentLanguageState } from "@/components/app/GeneratedContentLanguageState";
import type { PersistedContentLocale } from "@/lib/i18n";

interface Props {
  documentId: string;
  documentTitle: string;
}

/** "Ready for analysis" card: generates and displays the AI study summary. */
export function DocumentSummaryPanel({ documentId, documentTitle }: Props) {
  const { locale, t } = useI18n();
  const [summary, setSummary] = useState<StudySummary | null>(null);
  const [currentAvailable, setCurrentAvailable] = useState(false);
  const [alternatives, setAlternatives] = useState<Array<{
    locale: PersistedContentLocale;
    summary: StudySummary;
  }>>([]);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loads the SAVED summary (no AI call). Generation is only ever user-triggered,
  // and only offered when this material has no stored summary yet.
  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    setSummary(null);
    setCurrentAvailable(false);
    setAlternatives([]);
    getDocumentSummary({ data: { documentId } })
      .then((res) => {
        if (cancelled) return;
        setAlternatives(res.alternatives);
        if (res.current) {
          setSummary(res.current.summary);
          setCurrentAvailable(true);
        }
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, locale]);

  async function generate(regenerate = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await generateDocumentSummary({ data: { documentId, regenerate } });
      setSummary(res.summary);
      setCurrentAvailable(true);
    } catch (err) {
      setError(aiErrorMessage(err, t, t("summary.errorGenerate")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppCard>
      <AppLabel>{summary ? t("summary.savedLabel") : t("summary.readyLabel")}</AppLabel>
      <p className="mt-4 truncate font-mono text-sm">{documentTitle}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {checking
          ? t("summary.checking")
          : summary
            ? t("summary.saved")
            : t("summary.ready")}
      </p>

      {!checking && (
        <div className="mt-6 flex flex-wrap gap-3">
          {!summary && alternatives.length === 0 ? (
            <PrimaryButton onClick={() => generate(false)} disabled={loading}>
              {loading ? t("summary.generating") : t("summary.generate")}{" "}
              <Sparkles className="h-4 w-4" aria-hidden />
            </PrimaryButton>
          ) : currentAvailable ? (
            <GhostButton
              onClick={() => {
                if (!loading) void generate(true);
              }}
              disabled={loading}
            >
              {loading ? t("summary.regenerating") : t("summary.regenerateShort")}
            </GhostButton>
          ) : null}
        </div>
      )}

      {!checking && !currentAvailable && alternatives.length > 0 ? (
        <GeneratedContentLanguageState
          currentLocale={locale}
          variants={alternatives}
          generating={loading}
          onGenerate={() => void generate(false)}
          onOpen={(variantLocale) => {
            const variant = alternatives.find((item) => item.locale === variantLocale);
            if (variant) setSummary(variant.summary);
          }}
        />
      ) : null}

      {error && (
        <p
          role="alert"
          className="mt-5 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
          {error}
        </p>
      )}

      {loading && !summary && (
        <p className="mt-6 font-mono text-xs text-muted-foreground" aria-live="polite">
          {t("summary.reading")}
        </p>
      )}

      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-8 space-y-8 border-t border-border pt-8"
        >
          <h2 className="text-lg">{summary.title}</h2>

          {summary.keyConcepts.length > 0 && (
            <section>
              <AppLabel>{t("summary.keyConcepts")}</AppLabel>
              <ul className="mt-3 flex flex-wrap gap-2">
                {summary.keyConcepts.map((c) => (
                  <li
                    key={c}
                    className="rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted-foreground"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {summary.explanations.length > 0 && (
            <section>
              <AppLabel>{t("summary.explanations")}</AppLabel>
              <div className="mt-3 space-y-4">
                {summary.explanations.map((e) => (
                  <div key={e.heading}>
                    <p className="text-sm text-lime">{e.heading}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {summary.definitions.length > 0 && (
            <section>
              <AppLabel>{t("summary.definitions")}</AppLabel>
              <dl className="mt-3 space-y-3">
                {summary.definitions.map((d) => (
                  <div key={d.term}>
                    <dt className="font-mono text-xs">{d.term}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {d.definition}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {summary.relationships.length > 0 && (
            <section>
              <AppLabel>{t("summary.relationships")}</AppLabel>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {summary.relationships.map((r) => (
                  <li key={r}>— {r}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <AppLabel>{t("summary.finalReview")}</AppLabel>
            <p className="mt-3 text-sm leading-relaxed">{summary.review}</p>
          </section>

          {summary.limitations && (
            <p className="font-mono text-[11px] text-muted-foreground">
              {t("summary.limitations")}: {summary.limitations}
            </p>
          )}
        </motion.div>
      )}
    </AppCard>
  );
}
