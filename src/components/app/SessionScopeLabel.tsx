import { useI18n } from "@/lib/i18n";
import type { SessionScope } from "@/lib/progress-overview";

export function SessionScopeLabel({ session }: { session: SessionScope }) {
  const { t } = useI18n();
  const labels: string[] = [];

  if (session.topicScopeId) {
    labels.push(
      session.topicTitle
        ? t("sessions.topic", { title: session.topicTitle })
        : t("sessions.deletedTopic"),
    );
  }
  if (session.kind === "practice") labels.push(t("results.practiceMistakes"));
  if (labels.length === 0) return null;

  return (
    <span className="mt-1 block break-words font-mono text-[11px] text-muted-foreground">
      {labels.join(" · ")}
    </span>
  );
}
