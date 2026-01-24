import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create client only if we have valid credentials (allows build without env vars)
export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

export type ApiKey = {
  id: string;
  key_prefix: string;
  environment: "live" | "test";
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type UsageRecord = {
  event_type: string;
  quantity: number;
  created_at: string;
};

export async function getApiKeys(): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, key_prefix, environment, name, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createApiKey(
  name: string,
  environment: "live" | "test" = "live"
): Promise<{ key: string; keyData: ApiKey }> {
  // Generate key client-side
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);

  const apiKey = `aa_${environment}_${randomPart}`;
  const keyPrefix = `aa_${environment}_`;

  // Hash the key
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Call the RPC function
  const { data: keyData, error } = await supabase.rpc("create_api_key", {
    key_hash: keyHash,
    key_prefix: keyPrefix,
    env: environment,
    key_name: name,
  });

  if (error) throw error;

  return { key: apiKey, keyData };
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("revoke_api_key", {
    key_id: keyId,
  });

  if (error) throw error;
  return data;
}

export async function getUsageStats(): Promise<{
  totalSessions: number;
  totalMessages: number;
  last7Days: { date: string; sessions: number; messages: number }[];
}> {
  const { data, error } = await supabase
    .from("usage_records")
    .select("event_type, created_at")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) throw error;

  const records = data || [];
  const totalSessions = records.filter((r) => r.event_type === "session.created").length;
  const totalMessages = records.filter((r) => r.event_type === "message.sent").length;

  // Group by day
  const dayMap = new Map<string, { sessions: number; messages: number }>();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().split("T")[0];
    dayMap.set(key, { sessions: 0, messages: 0 });
  }

  records.forEach((r) => {
    const day = r.created_at.split("T")[0];
    const entry = dayMap.get(day);
    if (entry) {
      if (r.event_type === "session.created") entry.sessions++;
      if (r.event_type === "message.sent") entry.messages++;
    }
  });

  const last7Days = Array.from(dayMap.entries()).map(([date, stats]) => ({
    date,
    ...stats,
  }));

  return { totalSessions, totalMessages, last7Days };
}
