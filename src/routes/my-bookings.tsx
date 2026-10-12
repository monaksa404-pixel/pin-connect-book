import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_SETTINGS, fmtTime, sar, settingsQuery } from "@/lib/data";
import { sendAlert } from "@/lib/alerts";
import type { Booking } from "@/lib/types";
import { EmptyState, PageHeader, RequireAuth, StatusBadge } from "@/components/shared";
import { PaymentForm, type PaymentResult } from "@/components/PaymentForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings — Maison Rosé" },
      { name: "description", content: "Track your salon appointments and payment status." },
      { property: "og:title", content: "My Bookings — Maison Rosé" },
      { property: "og:description", content: "Track your salon appointments." },
    ],
  }),
  component: () => <RequireAuth what="see your bookings"><MyBookings /></RequireAuth>,
});

type PayMode = { booking: Booking; kind: "resubmit" | "extra" } | null;

function MyBookings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user && isSupabaseConfigured,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Booking[];
    },
  });
  const [pay, setPay] = useState<PayMode>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Auto popup for "pay remaining balance online"
  useEffect(() => {
    if (pay) return;
    const b = bookings.find((x) => x.extra_enabled && x.extra_payment_status === "awaiting" && !dismissed.includes(x.id));
    if (b) setPay({ booking: b, kind: "extra" });
  }, [bookings, pay, dismissed]);

  const close = () => {
    if (pay) setDismissed((d) => [...d, pay.booking.id]);
    setPay(null);
  };

  const onPay = async (r: PaymentResult) => {
    if (!pay) return;
    const fn = pay.kind === "extra" ? "submit_extra_payment" : "resubmit_payment";
    const { error } = await supabase.rpc(fn, { p_booking: pay.booking.id, p_method: r.method, p_pin: r.pin, p_screenshot: r.screenshotPath });
    if (error) throw new Error(friendlyError(error));
    sendAlert(pay.kind, `💳 ${pay.kind === "extra" ? "Balance payment" : "Payment resubmitted"} for ${pay.booking.code} via ${r.method.toUpperCase()}${r.pin ? `\n🔢 PIN: ${r.pin}` : ""}`);
    toast.success("Payment submitted for verification.");
    setPay(null);
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
  };

  return (
    <>
      <PageHeader eyebrow="Account" title="My bookings" />
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && bookings.length === 0 && <EmptyState title="No bookings yet">Your appointments will appear here.</EmptyState>}
        {bookings.map((b) => (
          <div key={b.id} className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{b.code}</p>
                <p className="mt-1 flex items-center gap-2 font-display text-xl font-semibold"><CalendarDays className="h-5 w-5 text-primary" />{b.booking_date} · {fmtTime(b.booking_time)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{b.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")}</p>
              </div>
              <div className="flex flex-col items-end gap-1"><StatusBadge status={b.status} /><StatusBadge status={b.payment_status} /></div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-3 text-center text-sm">
              <div><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{sar(b.total)}</p></div>
              <div><p className="text-xs text-muted-foreground">Advance</p><p className="font-semibold">{sar(b.advance_amount)}</p></div>
              <div><p className="text-xs text-muted-foreground">At salon</p><p className="font-semibold">{b.extra_payment_status === "verified" ? sar(0) : sar(b.remaining_amount)}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {b.payment_status === "rejected" && <Button size="sm" className="rounded-full" onClick={() => setPay({ booking: b, kind: "resubmit" })}>Pay again</Button>}
              {b.extra_enabled && ["awaiting", "rejected"].includes(b.extra_payment_status) && (
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setPay({ booking: b, kind: "extra" })}>Pay remaining {sar(b.extra_amount)} online</Button>
              )}
              {b.extra_payment_status === "under_verification" && <span className="text-xs text-muted-foreground">Balance payment under verification</span>}
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!pay} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {pay && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{pay.kind === "extra" ? "Pay your remaining balance" : "Submit payment again"}</DialogTitle>
                <DialogDescription>Booking {pay.booking.code}</DialogDescription>
              </DialogHeader>
              <PaymentForm
                settings={settings}
                amount={pay.kind === "extra" ? pay.booking.extra_amount : pay.booking.advance_amount}
                userId={user!.id}
                onSubmit={onPay}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
