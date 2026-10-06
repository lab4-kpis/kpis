const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

function isAllowedSupabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export const publicConfig = {
  supabaseUrl: url,
  publishableKey,
  valid: isAllowedSupabaseUrl(url) && publishableKey.length > 20,
};
