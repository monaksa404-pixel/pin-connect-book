import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = { id: string; sender: "user" | "admin"; body: string; created_at: string };

export function ChatThread({ userId, as }: { userId: string; as: "user" | "admin" }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ["chat", userId],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_messages").select("id, sender, body, created_at").eq("user_id", userId).order("created_at");
      if (error) { toast.error(error.message); return [] as Msg[]; }
      return (data ?? []) as Msg[];
    },
  });
  const rows = Array.isArray(data) ? data : [];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim().slice(0, 2000);
    if (!body || !userId) return;
    setText("");
    try {
      const { error } = await supabase.from("support_messages").insert({ user_id: userId, sender: as, body });
      if (error) { toast.error(error.message); setText(body); return; }
      if (as === "user") await sendAlert("support", `New support message:\n${body}`);
      await qc.invalidateQueries({ queryKey: ["chat", userId] });
      box.current?.scrollTo({ top: box.current.scrollHeight });
    } catch (err) {
      toast.error((err as Error).message || "Message was not sent");
      setText(body);
    }
  };

  return (
    <div className="flex h-[60vh] flex-col rounded-3xl border border-border bg-card">
      <div ref={box} className="flex-1 space-y-2 overflow-y-auto p-4">
        {rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>}
        {rows.map((m) => (
          <div key={m.id} className={cn("flex", m.sender === as ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", m.sender === as ? "bg-primary text-primary-foreground" : "bg-muted")}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className="mt-1 text-[10px] opacity-70">{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <Input value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" className="rounded-full" />
        <Button type="submit" size="icon" className="shrink-0 rounded-full" aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
