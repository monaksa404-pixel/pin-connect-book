import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-key",
  {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  },
);

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (msg.includes("BOOKINGS_FULL")) return "Bookings are currently unavailable. Please try later.";
  if (msg.includes("BANK_DISABLED")) return "Bank transfer is currently turned off.";
  if (msg.includes("STC_DISABLED")) return "STC voucher payment is currently turned off.";
  if (msg.includes("INVALID_PIN") || msg.includes("STC_INVALID")) return "Please enter a valid STC recharge PIN.";
  if (msg.includes("SCREENSHOT_REQUIRED") || msg.includes("BANK_INVALID")) return "Please upload your payment screenshot.";
  if (msg.includes("EMPTY_CART")) return "Your cart is empty.";
  if (!isSupabaseConfigured) return "The database is not connected yet. Add your keys to the .env file.";
  return msg;
}
