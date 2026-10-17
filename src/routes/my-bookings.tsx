import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronRight, Clock, Eye, MapPin, MessageCircle, X } from "lucide-react";
import { useCart } from "@/lib/cart";
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
  const navigate = useNavigate();
  const { add } = useCart();
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
  const [openId, setOpenId] = useState<string | null>(null);
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
            {(["all", "upcoming", "completed", "cancelled"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-1 py-2 text-[11px] font-semibold capitalize sm:text-sm ${tab === t ? "bg-[#ff4d94] text-white" : "bg-white text-[#9a5b78]"}`}>
                {t === "all" ? "All Bookings" : t}
              </button>
            ))}
          </div>
          {isLoading && <p className="mt-6 text-[#9a5b78]">Loading…</p>}
          <div className="mt-4 space-y-3">
            {shown.map((b) => {
              const pic = services.find((s) => s.id === b.items[0]?.service_id);
              const when = b.booking_date ? format(parseISO(b.booking_date), "EEE, d MMM yyyy") : "";
              const upcoming = b.status === "pending" || b.status === "confirmed";
              const label = upcoming ? "Upcoming" : b.status === "completed" ? "Completed" : "Cancelled";
              const tone = b.status === "completed" ? "bg-emerald-100 text-emerald-700" : b.status === "cancelled" ? "bg-pink-100 text-[#e23b86]" : "bg-[#ffe4f2] text-[#e23b86]";
              return (
                <article key={b.id} className="rounded-3xl bg-white p-3 shadow-sm">
                  <div className="flex gap-3">
                    <img src={pic ? serviceImage(pic) : "/images/slider1.jpeg"} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[#3d2030]">{b.items.map((i) => i.name).join(", ")}</p>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
                          {b.status === "completed" ? <Check className="h-3 w-3" /> : b.status === "cancelled" ? <X className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {label}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[#9a5b78]"><CalendarDays className="h-3.5 w-3.5 text-[#ff4d94]" />{when}</p>
                      <p className="flex items-center gap-1 text-xs text-[#9a5b78]"><Clock className="h-3.5 w-3.5 text-[#ff4d94]" />{fmtTime(String(b.booking_time).slice(0, 5))}</p>
                      <p className="flex items-center gap-1 text-xs text-[#9a5b78]"><MapPin className="h-3.5 w-3.5 text-[#ff4d94]" />{settings.salon_name}</p>
                    </div>
                    <button type="button" aria-label="Details" onClick={() => setOpenId(openId === b.id ? null : b.id)} className="self-center text-[#ff4d94]"><ChevronRight className="h-5 w-5" /></button>
                  </div>
                  {b.payment_status !== "verified" && (
                    <p className="mt-3 rounded-2xl bg-[#ffe4f2] p-3 text-center text-sm font-medium text-[#5c2344]">Please wait for payment approval. Once your payment is approved, your assigned salon location and WhatsApp number will be available here.</p>
                  )}
                  <div className="mt-3 grid grid-cols-3 items-center gap-2">
                    {b.payment_status === "verified" && profile?.assigned_whatsapp ? (
                      <a href={`https://wa.me/${profile.assigned_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-full bg-[#25D366] px-2 py-2 text-[11px] font-semibold text-white"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>
                    ) : <span />}
                    <Button size="sm" className="justify-self-center rounded-full bg-[#ff4d94]" onClick={() => setOpenId(openId === b.id ? null : b.id)}><Eye className="mr-1 h-4 w-4" />View Details</Button>
                    {b.payment_status === "verified" ? (
                      <Link to="/location" className="inline-flex items-center justify-center gap-1 rounded-full border border-pink-200 px-2 py-2 text-[11px] font-semibold text-[#ff4d94]"><MapPin className="h-3.5 w-3.5" />Location</Link>
                    ) : <span />}
                  </div>
                  <div className="mt-2 flex justify-center">
                    {upcoming ? (
                      <Button size="sm" variant="outline" className="rounded-full border-pink-200 text-[#e23b86]" onClick={() => { b.items.forEach((item) => { const svc = services.find((s) => s.id === item.service_id); if (svc) add(svc); }); navigate({ to: "/cart" }); }}><CalendarDays className="mr-1 h-4 w-4" />Reschedule</Button>
                    ) : (
                      <Button asChild size="sm" variant="outline" className="rounded-full border-pink-200 text-[#e23b86]"><Link to="/services"><CalendarDays className="mr-1 h-4 w-4" />Book Again</Link></Button>
                    )}
                  </div>
                  {openId === b.id && (
                    <div className="mt-3 space-y-2 rounded-2xl bg-[#fff0f6] p-3 text-sm">
                      <p>Total {sar(b.total)} · Advance {sar(b.advance_amount)}</p>
                      <p>Payment: {b.payment_status}</p>
                      {b.payment_status === "verified" && (
                        <p>Remaining balance {sar(Math.max(0, Number(b.total) - Number(b.advance_amount) - (b.extra_payment_status === "verified" ? Number(b.extra_amount) : 0)))}</p>
                      )}
                      {b.payment_status === "rejected" && <Button className="h-11 w-full rounded-full bg-[#ff4d94]" onClick={() => setPay({ booking: b, kind: "resubmit" })}>Pay again</Button>}
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
