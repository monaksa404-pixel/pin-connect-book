import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, Clock, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { supabase, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_SETTINGS, fmtTime, sar, serviceImage, servicesQuery, settingsQuery } from "@/lib/data";
import { sendAlert } from "@/lib/alerts";
import type { Booking } from "@/lib/types";
import { RequireAuth } from "@/components/shared";
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
  const { data: profile } = useProfile();
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
  const [pay, setPay] = useState<PayMode>(null);

  useEffect(() => {
    if (!pay) return;
    const live = bookings.find((x) => x.id === pay.booking.id);
    const extraOn = !!live && live.extra_enabled && ["awaiting", "rejected"].includes(live.extra_payment_status);
    const againOn = !!live && live.payment_status === "rejected";
    if (pay.kind === "extra" && !extraOn) setPay(null);
    if (pay.kind === "resubmit" && !againOn) setPay(null);
  }, [bookings, pay]);

  const close = () => setPay(null);

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
      <div className="min-h-screen bg-[#fff0f6] px-4 pb-28 pt-4 md:pb-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-widest text-[#ff4d94]">ACCOUNT</p>
          <h1 className="font-display text-4xl font-semibold text-[#3d2030]">My <span className="text-[#ff4d94]">Bookings</span></h1>
          <p className="text-[#9a5b78]">View and manage your appointments.</p>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {([
              ["all", "All Bookings", CalendarDays],
              ["upcoming", "Upcoming", Clock],
              ["completed", "Completed", Check],
              ["cancelled", "Cancelled", X],
            ] as const).map(([t, label, Icon]) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`inline-flex items-center justify-center gap-1 rounded-full px-1 py-2 text-[10px] font-semibold sm:text-sm ${tab === t ? "bg-[#ff4d94] text-white" : "bg-white text-[#9a5b78]"}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />{label}
              </button>
            ))}
          </div>
          {isLoading && <p className="mt-6 text-[#9a5b78]">Loading…</p>}
          <div className="mt-4 space-y-3">
            {shown.map((b) => {
              const pic = services.find((s) => s.id === b.items[0]?.service_id);
              const mins = b.items.reduce((sum, item) => sum + (services.find((s) => s.id === item.service_id)?.duration_min ?? 0) * item.qty, 0);
              const when = b.booking_date ? `${format(parseISO(b.booking_date), "yyyy-MM-dd")} · ${fmtTime(String(b.booking_time).slice(0, 5))}` : "";
              const appt = b.status === "confirmed" ? "Confirmed" : b.status === "completed" ? "Completed" : b.status === "cancelled" ? "Cancelled" : "Pending";
              const payLabel = b.status === "completed" && b.payment_status === "verified" ? "Paid" : b.status === "cancelled" && b.payment_status === "verified" ? "Refunded" : b.payment_status === "verified" ? "Verified" : b.payment_status === "rejected" ? "Rejected" : "Pending";
              const apptTone = b.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : b.status === "completed" ? "bg-sky-100 text-sky-700" : b.status === "cancelled" ? "bg-pink-100 text-[#e23b86]" : "bg-amber-100 text-amber-700";
              const payTone = b.payment_status === "verified" && b.status === "completed" ? "bg-sky-100 text-sky-700" : b.payment_status === "verified" && b.status === "cancelled" ? "bg-pink-100 text-[#e23b86]" : b.payment_status === "verified" ? "bg-emerald-100 text-emerald-700" : b.payment_status === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700";
              const atSalon = Math.max(0, Number(b.total) - Number(b.advance_amount) - (b.extra_payment_status === "verified" ? Number(b.extra_amount) : 0));
              const wa = (profile?.assigned_whatsapp || (profile?.contact_enabled ? settings.whatsapp : "") || "").replace(/\D/g, "");
              return (
                <article key={b.id} className="rounded-3xl bg-white p-3 shadow-sm">
                  <div className="flex gap-3">
                    <img src={pic ? serviceImage(pic) : "/images/slider1.jpeg"} alt="" className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#9a5b78]">{b.code}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-[#9a5b78]"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#ff4d94]" />{when}</p>
                          <p className="mt-1 font-semibold leading-tight text-[#3d2030]">{b.items.map((i) => i.name).join(", ")}</p>
                          {mins > 0 && <p className="mt-0.5 flex items-center gap-1 text-xs text-[#9a5b78]"><Clock className="h-3.5 w-3.5 text-[#ff4d94]" />{mins} min</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${apptTone}`}>{appt}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${payTone}`}>{payLabel}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-2xl bg-[#fff5f9] text-center">
                    <div className="px-1 py-2"><p className="text-[11px] text-[#9a5b78]">Total</p><p className="text-sm font-semibold text-[#3d2030]">{sar(b.total)}</p></div>
                    <div className="border-x border-pink-100 px-1 py-2"><p className="text-[11px] text-[#9a5b78]">Advance</p><p className="text-sm font-semibold text-[#3d2030]">{sar(b.advance_amount)}</p></div>
                    <div className="px-1 py-2"><p className="text-[11px] text-[#9a5b78]">At salon</p><p className="text-sm font-semibold text-[#3d2030]">{sar(atSalon)}</p></div>
                  </div>
                  {b.payment_status === "pending" && (
                    <p className="mt-3 rounded-2xl bg-[#ffe4f2] p-3 text-center text-sm font-medium text-[#5c2344]">Please wait for payment approval. Once your payment is approved, your assigned salon location and WhatsApp number will be available here.</p>
                  )}
                  {b.payment_status === "rejected" && (
                    <Button className="mt-3 h-11 w-full rounded-full bg-[#ff4d94]" onClick={() => setPay({ booking: b, kind: "resubmit" })}>Pay again</Button>
                  )}
                  {b.extra_enabled && ["awaiting", "rejected"].includes(b.extra_payment_status) && (
                    <Button className="mt-3 h-11 w-full rounded-full bg-[#ff4d94]" onClick={() => setPay({ booking: b, kind: "extra" })}>Pay remaining {sar(b.extra_amount)}</Button>
                  )}
                  {b.status === "confirmed" && b.payment_status === "verified" && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {wa ? (
                        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-2 py-2.5 text-sm font-semibold text-white">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden><path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l6-1.6A11 11 0 0 0 20.5 3.5zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.9.9-3.4-.2-.3A9 9 0 1 1 12 20.5zm5-6.7c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5c-.1-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.5 4c.6.3 1.1.4 1.5.5a3.6 3.6 0 0 0 1.7.1 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z" /></svg>
                          WhatsApp
                        </a>
                      ) : <span />}
                      <Link to="/location" className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1a73e8] px-2 py-2.5 text-sm font-semibold text-white ${wa ? "" : "col-span-2"}`}>
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="#fff" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" /><circle cx="12" cy="9" r="2.4" fill="#1a73e8" /></svg>
                        Location
                      </Link>
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
