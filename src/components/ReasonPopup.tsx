import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Note = { id: string; title: string; body: string | null };

export function ReasonPopup() {
  const { user } = useAuth();
  const qc = useQueryClient();
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
    if (!ready || open || !data[0]) return;
    setOpen(data[0]);
    const extra = data.slice(1).map((n) => n.id);
    if (extra.length) supabase.from("notifications").update({ read: true }).in("id", extra);
  }, [data, open, ready]);

  const close = async () => {
    if (open) await supabase.from("notifications").update({ read: true }).eq("id", open.id);
    setOpen(null);
    qc.invalidateQueries({ queryKey: ["popups"] });
    qc.invalidateQueries({ queryKey: ["unread"] });
  };

  if (!ready) return null;
  return (
    <Dialog open={!!open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg rounded-3xl border border-pink-100 bg-white p-6 sm:p-8">
        <DialogHeader><DialogTitle className="font-display text-2xl text-[#5c2344]">{open?.title}</DialogTitle></DialogHeader>
        <p className="text-base font-medium text-[#5c2344]">{open?.body}</p>
        <Button className="h-12 rounded-full bg-[#ff4d94] text-base" onClick={close}>OK</Button>
      </DialogContent>
    </Dialog>
  );
}
