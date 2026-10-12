import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { EmptyState, PageHeader, RequireAuth } from "@/components/shared";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Maison Rosé" },
      { name: "description", content: "Updates about your bookings and payments." },
      { property: "og:title", content: "Notifications — Maison Rosé" },
      { property: "og:description", content: "Updates about your bookings and payments." },
    ],
  }),
  component: () => <RequireAuth what="see notifications"><Notifications /></RequireAuth>,
});

type N = { id: string; title: string; body: string | null; read: boolean; created_at: string };

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user && isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as N[];
    },
  });

  useEffect(() => {
    if (!user || !data.some((n) => !n.read)) return;
    supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false).then(() => {
      qc.invalidateQueries({ queryKey: ["unread"] });
    });
  }, [data, user, qc]);

  return (
    <>
      <PageHeader eyebrow="Account" title="Notifications" />
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-10">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && data.length === 0 && <EmptyState title="No notifications yet" />}
        {data.map((n) => (
          <div key={n.id} className={cn("flex gap-4 rounded-3xl border bg-card p-5", n.read ? "border-border" : "border-primary/40")}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary"><Bell className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="font-semibold">{n.title}</p>
              {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
