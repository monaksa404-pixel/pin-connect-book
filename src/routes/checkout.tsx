import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { advanceFor, DEFAULT_SETTINGS, fmtTime, sar, serviceImage, settingsQuery } from "@/lib/data";
import { supabase, friendlyError } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";
import { EmptyState, RequireAuth } from "@/components/shared";
import { PaymentForm, type PaymentResult } from "@/components/PaymentForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FullNotice } from "@/components/FullNotice";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Details & Payment — The Beauty House" },
      { name: "description", content: "Enter your details and pay the advance to confirm your booking." },
      { property: "og:title", content: "Details & Payment — The Beauty House" },
      { property: "og:description", content: "Confirm your salon booking." },
    ],
  }),
  component: () => <RequireAuth what="book"><Checkout /></RequireAuth>,
});

function Checkout() {
  const { user } = useAuth();
  const { lines, slot, total, clear } = useCart();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [ready, setReady] = useState(false);
  const [fullOpen, setFullOpen] = useState(true);
  const [view, setView] = useState<"details" | "pay" | "card" | "otp">("details");
  const [method, setMethod] = useState<"bank" | "wallet" | "card">("bank");

  useEffect(() => {
    const raw = localStorage.getItem("checkout-draft");
    if (raw) {
      try {
        const d = JSON.parse(raw) as { name?: string; phone?: string; city?: string; notes?: string };
        setName(d.name ?? "");
        setPhone(d.phone ?? "");
        setCity(d.city ?? "");
        setNotes(d.notes ?? "");
        setReady(true);
        return;
      } catch { /* ignore */ }
    }
    if (!user) { setReady(true); return; }
    supabase.from("profiles").select("full_name, phone, city").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setName(data.full_name ?? ""); setPhone(data.phone ?? ""); setCity(data.city ?? ""); }
      setReady(true);
    });
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("checkout-draft", JSON.stringify({ name, phone, city, notes }));
  }, [name, phone, city, notes, ready]);

  if (!lines.length || !slot)
    return <div className="mx-auto max-w-xl px-4 py-16"><EmptyState title="Nothing to book yet"><Button asChild className="mt-4 rounded-full"><Link to="/services">Browse services</Link></Button></EmptyState></div>;
  if (settings.bookings_full)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
        {!fullOpen && <EmptyState title="Bookings unavailable">{settings.full_message}</EmptyState>}
      </div>
    );

  const { advance, remaining } = advanceFor(total, settings.advance_percent);

  const onSubmit = async (p: PaymentResult) => {
    if (name.trim().length < 2) throw new Error("Please enter your name.");
    if (!/^[+0-9 ]{8,16}$/.test(phone.trim())) throw new Error("Please enter a valid phone number.");
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        user_id: user!.id,
        customer_name: name.trim().slice(0, 80),
        phone: phone.trim(),
        city: city.trim().slice(0, 60) || null,
        notes: notes.trim().slice(0, 500) || null,
        booking_date: slot.date,
        booking_time: slot.time,
        items: lines.map((l) => ({ service_id: l.service.id, name: l.service.name, price: l.service.price, qty: l.qty })),
        payment_method: p.method,
        screenshot_path: p.screenshotPath,
      })
      .select("code, advance_amount, user_code")
      .single();
    if (error) throw new Error(friendlyError(error));
    await supabase.from("profiles").update({ full_name: name.trim(), phone: phone.trim(), city: city.trim() || null }).eq("id", user!.id);
    await sendAlert(
      "new_booking",
      `New booking ${data.code}\nUser ${data.user_code ?? ""}\n${name} (${phone})\n${slot.date} ${fmtTime(slot.time)}\nAdvance ${sar(Number(data.advance_amount))} via ${p.method}`,
    );
    clear();
    localStorage.removeItem("checkout-draft");
    toast.success(`Booking ${data.code} submitted. Remaining to pay at the salon: ${sar(remaining)}`);
    navigate({ to: "/my-bookings" });
  };

  const shell = (title: string, step: string, body: ReactNode) => (
    <div className="min-h-screen bg-[#ffd6e8] px-4 pb-28 pt-4 md:pb-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold tracking-widest text-rose-400">{step}</p>
        <h1 className="font-display text-4xl font-semibold text-rose-950">{title}</h1>
        {body}
      </div>
    </div>
  );

  if (view === "card" || view === "otp") {
    return shell(view === "card" ? "Payment" : "Enter OTP", "STEP 4", (
      <div className="mt-4 space-y-4">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          {view === "card" ? (
            <>
              <h2 className="text-xl font-semibold">Pay with <span className="text-rose-600">Credit/Debit Card</span></h2>
              <p className="text-sm text-rose-900/60">This salon does not charge cards here. Use bank transfer or wallet for the advance.</p>
              <div className="mt-4 grid gap-3">
                <Input placeholder="Name on card" autoComplete="off" className="rounded-2xl" />
                <Input placeholder="Card number" inputMode="numeric" autoComplete="off" maxLength={19} className="rounded-2xl" />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="MM / YY" autoComplete="off" maxLength={7} className="rounded-2xl" />
                  <Input placeholder="CVV" inputMode="numeric" autoComplete="off" maxLength={4} type="password" className="rounded-2xl" />
                </div>
              </div>
              <button type="button" onClick={() => setView("otp")} className="mt-4 h-12 w-full rounded-full bg-rose-600 font-semibold text-white">Continue</button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold">Enter <span className="text-rose-600">OTP</span></h2>
              <p className="text-sm text-rose-900/60">Card payment is not connected, so no code is sent and nothing is saved.</p>
              <Input placeholder="Enter OTP" inputMode="numeric" autoComplete="off" maxLength={6} className="mt-4 rounded-2xl" />
              <button type="button" onClick={() => { toast.message("Use bank transfer or wallet to pay the advance."); setView("details"); setMethod("bank"); }} className="mt-4 h-12 w-full rounded-full bg-rose-600 font-semibold text-white">Verify & Pay</button>
            </>
          )}
          <button type="button" onClick={() => setView("details")} className="mt-3 w-full text-sm font-semibold text-rose-600">Back to payment methods</button>
        </div>
      </div>
    ));
  }

  if (view === "pay") {
    return shell("Payment", "STEP 4", (
      <div className="mt-2">
        <p className="text-rose-900/60">Complete your payment using the selected method.</p>
        <button type="button" onClick={() => setView("details")} className="mt-3 text-sm font-semibold text-rose-600">Change method</button>
        <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
          <PaymentForm settings={settings} amount={advance} userId={user!.id} only={method} submitLabel={method === "bank" ? "Submit Payment" : `Pay ${sar(advance)}`} onSubmit={onSubmit} />
        </div>
        <div className="mt-4 rounded-3xl bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold text-rose-600">Payment Summary</p>
          <div className="mt-2 flex justify-between"><span>Total Amount</span><span>{sar(total)}</span></div>
          <div className="mt-2 flex justify-between"><span>Pay now ({settings.advance_percent}%)</span><span>{sar(advance)}</span></div>
          <div className="mt-2 flex justify-between"><span>Remaining (Pay at salon)</span><span>{sar(remaining)}</span></div>
        </div>
      </div>
    ));
  }

  return shell("Your details", "STEP 3", (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-2">
        <div><Label htmlFor="n">Full name</Label><Input id="n" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-2xl" /></div>
        <div><Label htmlFor="p">Phone</Label><Input id="p" value={phone} maxLength={16} inputMode="tel" placeholder="05xxxxxxxx" onChange={(e) => setPhone(e.target.value)} className="mt-1 rounded-2xl" /></div>
        <div><Label htmlFor="c">City (optional)</Label><Input id="c" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} className="mt-1 rounded-2xl" /></div>
        <div><Label htmlFor="no">Notes (optional)</Label><Textarea id="no" value={notes} maxLength={500} placeholder="Any special request..." onChange={(e) => setNotes(e.target.value)} className="mt-1 rounded-2xl" /></div>
      </div>
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-rose-600">Summary</h2>
          <Link to="/book" className="rounded-full border border-rose-200 px-3 py-1 text-sm text-rose-600">Edit Date & Time</Link>
        </div>
        <p className="mt-2 text-sm text-rose-900/70">{slot.date} at {fmtTime(slot.time)}</p>
        {lines.map((l) => (
          <div key={l.service.id} className="mt-3 flex items-center gap-3">
            <img src={serviceImage(l.service)} alt="" className="h-12 w-12 rounded-xl object-cover" />
            <div className="flex-1"><p>{l.service.name} × {l.qty}</p><p className="text-xs text-rose-900/50">{l.service.duration_min} min</p></div>
            <p className="font-semibold">{sar(l.service.price * l.qty)}</p>
          </div>
        ))}
        <div className="mt-3 space-y-1 border-t border-rose-50 pt-3 text-sm">
          <div className="flex justify-between"><span>Total</span><strong>{sar(total)}</strong></div>
          <div className="flex justify-between"><span>Pay now ({settings.advance_percent}%)</span><strong>{sar(advance)}</strong></div>
          <div className="flex justify-between"><span>Pay at salon (cash)</span><strong>{sar(remaining)}</strong></div>
        </div>
      </div>
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <p className="font-semibold text-rose-600">Payment Method <span className="text-sm font-normal text-rose-900/50">(Advance {settings.advance_percent}%)</span></p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["bank", "wallet", "card"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} className={`rounded-2xl border p-4 text-sm font-semibold ${method === m ? "border-rose-500 text-rose-600" : "border-rose-100 text-rose-900/70"}`}>
              {m === "bank" ? "Bank Transfer" : m === "wallet" ? "Wallet Balance" : "Credit/Debit Card"}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setView(method === "card" ? "card" : "pay")} className="mt-4 h-12 w-full rounded-full bg-rose-600 font-semibold text-white">Pay {sar(advance)} ({settings.advance_percent}%) →</button>
      </div>
    </div>
  ));
}
