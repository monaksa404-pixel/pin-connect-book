import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const notifyTelegram = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ message: z.string().min(1).max(1500), group: z.enum(["main", "wallet"]).optional() }).parse(d))
  .handler(async ({ data }) => {
    const env = import.meta.env as Record<string, string | undefined>;
    const token = (process.env["TELEGRAM_BOT_TOKEN"] || env["TELEGRAM_BOT_TOKEN"])?.trim();
    const main = (process.env["TELEGRAM_CHAT_ID"] || env["TELEGRAM_CHAT_ID"])?.trim();
    const wallet = (process.env["TELEGRAM_WALLET_CHAT_ID"] || env["TELEGRAM_WALLET_CHAT_ID"])?.trim();
    const chat = data.group === "wallet" ? wallet || main : main;
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
