import { supabase } from "@/lib/supabase";
import type { Database } from "@/integrations/supabase/types";
import { extractDocumentText } from "@/lib/documents.functions";
import { hasDocumentSummary } from "./document-summary-readiness";
import { nextPastedNoteTitle } from "./pasted-note-title";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

export interface UploadedDocument {
  id: string;
  title: string;
  filePath: string | null;
  status: string;
}

export class UploadError extends Error {}

function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
  return `${base || "material"}.${ext || "bin"}`;
}

/** Collision-safe object key scoped to the owner: documents/{userId}/{unique}-{name} */
function buildObjectPath(userId: string, fileName: string): string {
  const unique =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${unique}-${sanitizeFileName(fileName)}`;
}

/**
 * Uploads the real file to the private `documents` bucket and records it in
 * the `documents` table. Throws UploadError with a user-facing message.
 */
export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    throw new UploadError("You need to be signed in to upload material. Please sign in and try again.");
  }

  const path = buildObjectPath(user.id, file.name);

  const { error: storageError } = await supabase.storage
    .from("documents")
    .upload(path, file, file.type ? { upsert: false, contentType: file.type } : { upsert: false });

  if (storageError) {
    throw new UploadError(`Upload failed: ${storageError.message}`);
  }

  const { data: row, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: file.name,
      file_url: path,
      status: "uploaded",
    })
    .select("id, title, file_url, status")
    .single();

  if (insertError || !row) {
    // Best-effort cleanup so we don't leave an orphan object behind.
    await supabase.storage.from("documents").remove([path]);
    throw new UploadError(
      `We uploaded the file but couldn't save the record: ${insertError?.message ?? "unknown error"}`,
    );
  }

  return { id: row.id, title: row.title, filePath: row.file_url, status: row.status };
}

export async function createTextDocument(text: string, title: string): Promise<UploadedDocument> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    throw new UploadError("You need to be signed in to add material. Please sign in and try again.");
  }

  const trimmed = text.trim();
  if (!trimmed) throw new UploadError("Paste your notes before analyzing material.");

  const { data: existingDocuments, error: existingDocumentsError } = await supabase
    .from("documents")
    .select("title")
    .eq("user_id", user.id);

  if (existingDocumentsError) {
    throw new UploadError(`Couldn't prepare your notes: ${existingDocumentsError.message}`);
  }

  const uniqueTitle = nextPastedNoteTitle(
    title,
    (existingDocuments ?? []).map((document) => document.title),
  );

  const { data: row, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: uniqueTitle,
      file_url: null,
      status: "processed",
      extracted_text: trimmed,
      extraction_error: null,
      extracted_at: new Date().toISOString(),
    })
    .select("id, title, file_url, status")
    .single();

  if (error || !row) {
    throw new UploadError(`Couldn't save your notes: ${error?.message ?? "unknown error"}`);
  }

  return { id: row.id, title: row.title, filePath: row.file_url, status: row.status };
}

export class ExtractionError extends Error {}

/**
 * Triggers server-side PDF text extraction for a document the caller owns.
 * The uploaded file and its row are always preserved on failure.
 */
export async function extractDocument(documentId: string): Promise<void> {
  try {
    await extractDocumentText({ data: { documentId } });
  } catch (error) {
    throw new ExtractionError(
      error instanceof Error && error.message
        ? error.message
        : "We couldn't read the text from this PDF.",
    );
  }
}

export class DeleteError extends Error {}

export interface StoredDocument {
  id: string;
  title: string;
  filePath: string | null;
  status: string;
  createdAt: string;
  hasSummary: boolean;
}

/** Lists the signed-in user's uploaded documents (RLS scopes rows to the owner). */
export async function listDocuments(): Promise<StoredDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, file_url, status, created_at, summaries(id, topic_id)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    filePath: row.file_url,
    status: row.status,
    createdAt: row.created_at,
    hasSummary: hasDocumentSummary(row.summaries),
  }));
}

export async function renameDocument(documentId: string, title: string): Promise<StoredDocument> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Material title can't be empty.");

  const { data: row, error } = await supabase
    .from("documents")
    .update({ title: trimmed })
    .eq("id", documentId)
    .select("id, title, file_url, status, created_at, summaries(id, topic_id)")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "We couldn't rename this material.");
  }

  return {
    id: row.id,
    title: row.title,
    filePath: row.file_url,
    status: row.status,
    createdAt: row.created_at,
    hasSummary: hasDocumentSummary(row.summaries),
  };
}

/**
 * Deletes a material the caller owns: the stored PDF first, then the row.
 * Storage + table policies both check auth.uid(), so another user's document
 * can never be removed. Summaries cascade with the document row.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from("documents")
    .select("id, file_url")
    .eq("id", documentId)
    .maybeSingle();

  if (fetchError) throw new DeleteError(fetchError.message);
  if (!row) throw new DeleteError("This material no longer exists.");

  if (row.file_url) {
    const { error: storageError } = await supabase.storage.from("documents").remove([row.file_url]);
    if (storageError) {
      throw new DeleteError(`Couldn't delete the stored file: ${storageError.message}`);
    }
  }

  const { error: deleteError } = await supabase.from("documents").delete().eq("id", row.id);
  if (deleteError) {
    throw new DeleteError(`Couldn't delete the material record: ${deleteError.message}`);
  }
}
