import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  aiGenerationStageKeys,
  startAiGenerationProgress,
  type AiGenerationType,
} from "@/lib/ai-generation-progress";
import { useI18n } from "@/lib/i18n";

export function AiGenerationProgress({
  type,
  waiting = false,
  className,
}: {
  type: AiGenerationType;
  waiting?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    setStageIndex(0);
    if (waiting) return;
    return startAiGenerationProgress(type, setStageIndex);
  }, [type, waiting]);

  const stageKey =
    aiGenerationStageKeys[type][stageIndex] ??
    aiGenerationStageKeys[type][0] ??
    "aiProgress.summary.preparing";
  const message = waiting ? t("aiProgress.waiting") : t(stageKey);

  return (
    <section
      className={cn("mt-6 rounded-xl border border-border bg-surface-2/50 p-4", className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <motion.p
        key={message}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-sm"
      >
        {message}
      </motion.p>
      <p className="mt-1 text-xs text-muted-foreground">{t("aiProgress.secondary")}</p>
      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-label={t("aiProgress.label")}
        aria-valuetext={message}
      >
        <div className="h-full w-2/5 rounded-full bg-lime animate-ai-generation-progress" />
      </div>
    </section>
  );
}
