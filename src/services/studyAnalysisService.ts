import { analyzeMaterial } from "@/services/aiService";
import { storageService, type PendingInput } from "@/services/storageService";
import { supabase } from "@/lib/supabase";
import type { StudyAnalysis } from "@/types/study";

export async function loadProcessedDocumentInput(documentId: string): Promise<PendingInput> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, file_url, extracted_text, status")
    .eq("id", documentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("This material could not be found. It may have been deleted.");

  const extractedText = (data.extracted_text ?? "").trim();
  if (extractedText.length < 200) {
    throw new Error(
      data.status === "processing"
        ? "This material is still being processed. Try again in a moment."
        : "This material does not have enough readable extracted text to build a study plan yet.",
    );
  }

  return {
    kind: data.file_url ? "file" : "notes",
    name: data.title,
    text: extractedText,
    documentId: data.id,
    filePath: data.file_url ?? undefined,
  };
}

export async function getStudyAnalysisForDocument(documentId: string): Promise<StudyAnalysis> {
  const cached = storageService.getAnalysis();
  if (cached?.documentId === documentId) return cached;

  const input = await loadProcessedDocumentInput(documentId);
  const analysis = await analyzeMaterial(input);
  storageService.setAnalysis(analysis);
  return analysis;
}
