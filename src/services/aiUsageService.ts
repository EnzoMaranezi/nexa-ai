import { supabase } from "@/lib/supabase";

export interface AiGenerationUsage {
  used: number;
  limit: number;
}

export async function getAiGenerationUsageToday(): Promise<AiGenerationUsage> {
  const { data, error } = await supabase.rpc("get_ai_generation_usage_today");
  if (error) throw new Error(error.message);

  const row = data?.[0];
  return {
    used: row?.used_count ?? 0,
    limit: row?.limit_count ?? 20,
  };
}
