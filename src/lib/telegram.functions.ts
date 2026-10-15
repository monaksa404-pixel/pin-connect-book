import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const notifyTelegram = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ message: z.string().min(1).max(1500) }).parse(d))
  .handler(async ({ data }) => {
    const token = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
    const chat = process.env["TELEGRAM_CHAT_ID"]?.trim();
    if (!token || !chat) return { status: "skipped" as const };
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: data.message }),
      });
      if (!res.ok) {
        console.error("Telegram failed", res.status, await res.text());
        return { status: "failed" as const };
      }
      return { status: "sent" as const };
    } catch (e) {
      console.error("Telegram error", e);
      return { status: "failed" as const };
    }
  });
