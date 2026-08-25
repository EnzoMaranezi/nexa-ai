import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, FileText } from "lucide-react";
import { AppCard, AppLabel, LinkButton, Skeleton } from "@/components/app/ui";
import { DocumentFlashcardsPanel } from "@/components/app/DocumentFlashcards";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/app/flashcards/$documentId")({ component: FlashcardsView });
function FlashcardsView() {
  const { documentId } = Route.useParams(); const { t } = useI18n();
  const [doc, setDoc] = useState<{ id: string; title: string; hasText: boolean } | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { let cancelled = false; supabase.from("documents").select("id, title, extracted_text").eq("id", documentId).maybeSingle().then(({ data }) => { if (!cancelled) { setDoc(data ? { id: data.id, title: data.title, hasText: (data.extracted_text ?? "").trim().length >= 200 } : null); setLoading(false); } }); return () => { cancelled = true; }; }, [documentId]);
  return <div className="mx-auto max-w-[860px] space-y-8"><div><Link to="/app/materials" className="inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground hover:text-lime"><ArrowLeft className="size-3" />{t("common.backToMaterials")}</Link><AppLabel>{t("flashcards.panel")}</AppLabel><h1 className="display-sm mt-3">{t("flashcards.title")}</h1></div>
    {loading ? <AppCard className="space-y-4"><Skeleton className="w-1/3" /><Skeleton className="w-2/3" /></AppCard> : !doc ? <AppCard className="border-destructive/30"><AlertCircle className="size-4 text-destructive" /> <p>{t("questions.materialMissing")}</p><LinkButton to="/app/materials" variant="ghost" className="mt-5">{t("common.backToMaterials")}</LinkButton></AppCard> : <div className="space-y-5"><AppCard><FileText className="size-4 text-lime" /><AppLabel>{t("summary.source")}</AppLabel><p className="mt-3 text-lg">{doc.title}</p></AppCard>{doc.hasText ? <DocumentFlashcardsPanel documentId={doc.id} /> : <AppCard className="border-dashed"><AppLabel>{t("flashcards.noText")}</AppLabel><p className="mt-4 text-sm text-muted-foreground">{t("flashcards.noTextBody")}</p></AppCard>}</div>}
  </div>;
}
