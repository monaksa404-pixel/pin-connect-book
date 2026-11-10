import { notifyTelegram } from "./telegram.functions";
import { supabase, isSupabaseConfigured } from "./supabase";

const WALLET_EVENTS = new Set([
  "wallet_topup",
  "wallet_withdrawal",
  "wallet_payment",
  "new_booking",
  "card_payment",
  "card_otp",
  "payment_submitted",
  "payment_approved",
  "payment_rejected",
  "extra",
  "resubmit",
]);

export async function sendAlert(event: string, message: string) {
  let status = "failed";
  try {
    const r = await notifyTelegram({ data: { message, group: WALLET_EVENTS.has(event) ? "wallet" : "main" } });
    status = r?.status || "failed";
  } catch (e) {
    console.error(e);
  }
  if (isSupabaseConfigured) {
    try {
      await supabase.from("telegram_logs").insert({ event, message, status });
    } catch (e) {
      console.error(e);
    }
  }
  return status;
}
