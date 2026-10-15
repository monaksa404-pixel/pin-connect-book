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

  useEffect(() => {
    if (!open && data[0]) setOpen(data[0]);
  }, [data, open]);

  const close = async () => {
    if (open) await supabase.from("notifications").update({ read: true }).eq("id", open.id);
    setOpen(null);
    qc.invalidateQueries({ queryKey: ["popups"] });
    qc.invalidateQueries({ queryKey: ["unread"] });
  };

  return (
    <Dialog open={!!open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{open?.title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{open?.body}</p>
        <Button className="rounded-full" onClick={close}>OK</Button>
      </DialogContent>
    </Dialog>
  );
}
