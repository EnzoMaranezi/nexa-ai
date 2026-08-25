import type {
  MaterialRecord,
  SessionProgress,
  SessionResult,
  StudyAnalysis,
} from "@/types/study";

/**
 * Thin localStorage abstraction. Components never touch localStorage directly,
 * so this can be swapped for a backend API later without UI changes.
 */

const PREFIX = "nexa:";

const KEYS = {
  analysis: `${PREFIX}analysis`,
  materials: `${PREFIX}materials`,
  progress: `${PREFIX}session-progress`,
  results: `${PREFIX}results`,
  pendingInput: `${PREFIX}pending-input`,
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — prototype degrades to in-memory session */
  }
}

export interface PendingInput {
  kind: "file" | "notes";
  name: string;
  text?: string | undefined;
  sizeLabel?: string | undefined;
  fileType?: string | undefined;
  /** Supabase `documents` row id, present for real uploads. */
  documentId?: string | undefined;
  /** Storage object path inside the private `documents` bucket. */
  filePath?: string | undefined;
}

export const storageService = {
  getPendingInput: () => read<PendingInput | null>(KEYS.pendingInput, null),
  setPendingInput: (input: PendingInput) => write(KEYS.pendingInput, input),
  clearPendingInput: () => write(KEYS.pendingInput, null),

  getAnalysis: () => read<StudyAnalysis | null>(KEYS.analysis, null),
  setAnalysis: (analysis: StudyAnalysis) => write(KEYS.analysis, analysis),

  getMaterials: () => read<MaterialRecord[]>(KEYS.materials, []),
  addMaterial: (material: MaterialRecord) => {
    const list = read<MaterialRecord[]>(KEYS.materials, []);
    write(KEYS.materials, [material, ...list.filter((m) => m.id !== material.id)]);
  },

  getProgress: () => read<SessionProgress | null>(KEYS.progress, null),
  setProgress: (progress: SessionProgress) => write(KEYS.progress, progress),
  clearProgress: () => write(KEYS.progress, null),

  getResults: () => read<SessionResult[]>(KEYS.results, []),
  addResult: (result: SessionResult) => {
    const list = read<SessionResult[]>(KEYS.results, []);
    write(KEYS.results, [result, ...list].slice(0, 20));
  },
  getLastResult: () => read<SessionResult[]>(KEYS.results, [])[0] ?? null,
};
