import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Downloads the caller's uploaded PDF from the private `documents` bucket,
 * extracts its text and stores it on the document row.
 *
 * Runs entirely with the caller's Supabase session, so RLS + storage ownership
 * policies guarantee a user can only extract their own documents.
 */
export const extractDocumentText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, title, file_url, status")
      .eq("id", data.documentId)
      .maybeSingle();

    if (docError || !doc) {
      throw new Error("Document not found.");
    }

    if (!doc.file_url || !doc.file_url.toLowerCase().endsWith(".pdf")) {
      return { status: "skipped" as const, characters: 0 };
    }

    await supabase.from("documents").update({ status: "processing" }).eq("id", doc.id);

    try {
      const { data: blob, error: downloadError } = await supabase.storage
        .from("documents")
        .download(doc.file_url);

      if (downloadError || !blob) {
        throw new Error(downloadError?.message ?? "Could not download the uploaded file.");
      }

      const { extractPdfText } = await import("./pdfExtraction.server");
      const text = await extractPdfText(await blob.arrayBuffer());

      const { error: updateError } = await supabase
        .from("documents")
        .update({
          extracted_text: text,
          extraction_error: null,
          extracted_at: new Date().toISOString(),
          status: "processed",
        })
        .eq("id", doc.id);

      if (updateError) throw new Error(updateError.message);

      return { status: "processed" as const, characters: text.length };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error while extracting the PDF text.";
      // The original file is intentionally kept in storage, and the row is kept too.
      await supabase
        .from("documents")
        .update({ status: "error", extraction_error: message })
        .eq("id", doc.id);
      throw new Error(message);
    }
  });
