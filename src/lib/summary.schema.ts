import { z } from "zod";

/** Structured academic summary derived strictly from a document's extracted text. */
export const summarySchema = z.object({
  title: z.string(),
  keyConcepts: z.array(z.string()).max(10),
  explanations: z
    .array(z.object({ heading: z.string(), body: z.string() }))
    .max(8),
  definitions: z.array(z.object({ term: z.string(), definition: z.string() })).max(10),
  relationships: z.array(z.string()).max(8),
  review: z.string(),
  limitations: z.string().nullable().optional(),
});

export type StudySummary = z.infer<typeof summarySchema>;
