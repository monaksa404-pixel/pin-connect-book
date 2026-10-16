import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/lib/auth";
import { supabase, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_SETTINGS, fmtTime, sar, serviceImage, servicesQuery, settingsQuery } from "@/lib/data";
import { sendAlert } from "@/lib/alerts";
import type { Booking } from "@/lib/types";
import { EmptyState, RequireAuth } from "@/components/shared";
import { PaymentForm, type PaymentResult } from "@/components/PaymentForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings — The Beauty House" },
      { name: "description", content: "Track your salon appointments and payment status." },
      { property: "og:title", content: "My Bookings — The Beauty House" },
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
  const { data: services = [] } = useQuery(servicesQuery);
  const [tab, setTab] = useState<"all" | "upcoming" | "completed" | "cancelled">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pay, setPay] = useState<PayMode>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Auto popup for "pay remaining balance online"
  useEffect(() => {
    if (!pay) {
      const b = bookings.find((x) => x.extra_enabled && x.extra_payment_status === "awaiting" && !dismissed.includes(x.id));
      if (b) setPay({ booking: b, kind: "extra" });
      return;
    }
    const live = bookings.find((x) => x.id === pay.booking.id);
    const extraOn = !!live && live.extra_enabled && ["awaiting", "rejected"].includes(live.extra_payment_status);
    const againOn = !!live && live.payment_status === "rejected";
    if (pay.kind === "extra" && !extraOn) setPay(null);
    if (pay.kind === "resubmit" && !againOn) setPay(null);
  }, [bookings, pay, dismissed]);

  const close = () => {
    if (pay) setDismissed((d) => [...d, pay.booking.id]);
    setPay(null);
  };

  const onPay = async (r: PaymentResult) => {
    if (!pay) return;
    const fn = pay.kind === "extra" ? "submit_extra_payment" : "resubmit_payment";
    const { error } = await supabase.rpc(fn, { p_booking: pay.booking.id, p_method: r.method, p_screenshot: r.screenshotPath });
    if (error) throw new Error(friendlyError(error));
    await sendAlert(pay.kind, `${pay.kind === "extra" ? "Balance payment" : "Payment resubmitted"} ${pay.booking.code}\nUser ${pay.booking.user_code ?? ""}\nvia ${r.method}`);
    toast.success("Payment submitted for verification.");
    setPay(null);
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
  };

  const shown = bookings.filter((b) => {
    if (tab === "upcoming") return b.status === "pending" || b.status === "confirmed";
    if (tab === "completed") return b.status === "completed";
    if (tab === "cancelled") return b.status === "cancelled";
    return true;
  });
  return (
    <>
      <div className="min-h-screen bg-[#ffd6e8] px-4 pb-28 pt-4 md:pb-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-widest text-rose-400">ACCOUNT</p>
          <h1 className="font-display text-4xl font-semibold text-rose-950">My <span className="text-rose-600">Bookings</span></h1>
          <p className="text-rose-900/60">View and manage your appointments.</p>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {(["all", "upcoming", "completed", "cancelled"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold capitalize ${tab === t ? "bg-rose-600 text-white" : "bg-white text-rose-900/70"}`}>
                {t === "all" ? "All Bookings" : t}
              </button>
            ))}
          </div>
          {isLoading && <p className="mt-6 text-rose-900/60">Loading…</p>}
          {!isLoading && shown.length === 0 && <EmptyState title="No bookings yet">Your appointments will appear here.</EmptyState>}
          <div className="mt-4 space-y-3">
            {shown.map((b) => {
              const pic = services.find((s) => s.id === b.items[0]?.service_id);
              const when = b.booking_date ? format(parseISO(b.booking_date), "EEE, dd MMM yyyy") : "";
              return (
                <article key={b.id} className="rounded-3xl bg-white p-3 shadow-sm">
                  <div className="flex gap-3">
                    <img src={pic ? serviceImage(pic) : "/images/slider1.jpeg"} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-rose-900/50">{b.code}</p>
                          <p className="text-xs text-rose-900/70">{when} · {fmtTime(String(b.booking_time).slice(0, 5))}</p>
                          <p className="font-semibold text-rose-950">{b.items.map((i) => i.name).join(", ")}</p>
                          <p className="text-xs text-rose-900/60">{b.items[0]?.qty ? "" : ""}{pic?.duration_min ?? ""}{pic ? " min" : ""}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${b.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : b.status === "completed" ? "bg-sky-100 text-sky-700" : b.status === "cancelled" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{b.status}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${b.payment_status === "verified" ? "bg-emerald-100 text-emerald-700" : b.payment_status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{b.payment_status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 rounded-2xl bg-rose-50 py-2 text-center text-xs">
                    <div><p className="text-rose-900/50">Total</p><p className="font-semibold">{sar(b.total)}</p></div>
                    <div><p className="text-rose-900/50">Advance</p><p className="font-semibold">{sar(b.advance_amount)}</p></div>
                    <div><p className="text-rose-900/50">At salon</p><p className="font-semibold">{sar(b.remaining_amount)}</p></div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    {(b.status === "pending" || b.status === "confirmed") && <Button asChild size="sm" variant="outline" className="rounded-full border-rose-200 text-rose-700"><Link to="/book">Reschedule</Link></Button>}
                    {(b.status === "completed" || b.status === "cancelled") && <Button asChild size="sm" variant="outline" className="rounded-full border-rose-200 text-rose-700"><Link to="/services">Book Again</Link></Button>}
                    <Button size="sm" className="rounded-full bg-rose-600" onClick={() => setOpenId(openId === b.id ? null : b.id)}><Eye className="mr-1 h-4 w-4" />View Details</Button>
                  </div>
                  {openId === b.id && (
                    <div className="mt-3 space-y-2 rounded-2xl bg-rose-50 p-3 text-sm">
                      <p>Total {sar(b.total)} · Advance {sar(b.advance_amount)} · Remaining {b.extra_payment_status === "verified" ? sar(0) : sar(b.remaining_amount)}</p>
                      <p>Payment: {b.payment_status}</p>
                      {b.payment_status === "rejected" && <Button size="sm" className="rounded-full bg-rose-600" onClick={() => setPay({ booking: b, kind: "resubmit" })}>Pay again</Button>}
                      {b.extra_enabled && ["awaiting", "rejected"].includes(b.extra_payment_status) && (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setPay({ booking: b, kind: "extra" })}>Pay remaining {sar(b.extra_amount)}</Button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
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
