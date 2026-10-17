import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Note = { id: string; title: string; body: string | null; kind?: string | null };

export function ReasonPopup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const seen = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<Note | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["popups", user?.id],
    enabled: !!user && isSupabaseConfigured,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("id, title, body").eq("popup", true).eq("read", false).order("created_at", { ascending: false }).limit(5);
      if (error) return [];
      return data as Note[];
    },
  });

  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    if (!ready || open) return;
    const next = data.find((n) => !seen.current.has(n.id));
    if (!next) return;
    data.forEach((n) => seen.current.add(n.id));
    setOpen(next);
    supabase.from("notifications").update({ read: true }).in("id", data.map((n) => n.id));
  }, [data, open, ready]);

  const close = async () => {
    setOpen(null);
    qc.invalidateQueries({ queryKey: ["popups"] });
    qc.invalidateQueries({ queryKey: ["unread"] });
  };

  const rejected = open?.kind === "rejected" || /reject/i.test(open?.title ?? "");
  if (!ready) return null;
  return (
    <Dialog open={!!open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md rounded-[28px] border border-pink-100 bg-white p-6 text-center sm:p-8">
        <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${rejected ? "bg-red-50 text-red-600" : "bg-[#ffe4f2] text-[#ff4d94]"}`}>
          {rejected ? <X className="h-10 w-10" /> : <Check className="h-10 w-10" />}
        </div>
        <DialogTitle className="font-display text-2xl font-bold text-[#5c2344]">{open?.title}</DialogTitle>
        <p className="text-base font-medium leading-relaxed text-[#3d2030]">{open?.body}</p>
        <Button className="h-12 w-full rounded-full bg-[#ff4d94] text-base" onClick={close}>OK</Button>
      </DialogContent>
    </Dialog>
  );
}
