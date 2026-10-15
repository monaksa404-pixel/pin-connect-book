import { notifyTelegram } from "./telegram.functions";
import { supabase, isSupabaseConfigured } from "./supabase";

/** Sends a Telegram alert (if keys are set) and records it in Telegram logs. Never throws. */
export async function sendAlert(event: string, message: string) {
  let status = "failed";
  try {
    const r = await notifyTelegram({ data: { message } });
    status = r.status;
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
}
