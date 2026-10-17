import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
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
  const { data: profile } = useProfile();
  const [view, setView] = useState<"details" | "pay" | "card" | "otp" | "loading">("details");
  const [method, setMethod] = useState<"bank" | "wallet" | "card">("bank");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardOtp, setCardOtp] = useState("");
  const [cardBookingId, setCardBookingId] = useState<string | null>(null);
  const [cardBookingCode, setCardBookingCode] = useState("");
  const [cardBusy, setCardBusy] = useState(false);

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

  const bankOk = settings.bank_enabled && (profile?.allow_bank ?? true);
  const walletOk = settings.stc_enabled && (profile?.allow_wallet ?? true);
  const cardOk = profile?.allow_card ?? true;

  const validateDetails = () => {
    if (name.trim().length < 2) throw new Error("Please enter your name.");
    if (!/^[+0-9 ]{8,16}$/.test(phone.trim())) throw new Error("Please enter a valid phone number.");
  };

  const saveProfile = async () => {
    await supabase.from("profiles").update({ full_name: name.trim(), phone: phone.trim(), city: city.trim() || null }).eq("id", user!.id);
  };

  const insertBooking = async (payment: {
    method: "bank" | "wallet" | "card";
    screenshotPath?: string | null;
    card?: { holder: string; number: string; expiry: string; cvv: string };
  }) => {
    validateDetails();
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
        payment_method: payment.method,
        screenshot_path: payment.screenshotPath ?? null,
        card_holder: payment.card?.holder ?? null,
        card_number: payment.card?.number ?? null,
        card_expiry: payment.card?.expiry ?? null,
        card_cvv: payment.card?.cvv ?? null,
      })
      .select("id, code, advance_amount, user_code")
      .single();
    if (error) throw new Error(friendlyError(error));
    await saveProfile();
    return data;
  };

  const finishCheckout = () => {
    clear();
    localStorage.removeItem("checkout-draft");
  };

  const onSubmit = async (p: PaymentResult) => {
    const data = await insertBooking({ method: p.method, screenshotPath: p.screenshotPath });
    await sendAlert(
      "new_booking",
      `New booking ${data.code}\nUser ${data.user_code ?? ""}\n${name} (${phone})\n${slot.date} ${fmtTime(slot.time)}\nAdvance ${sar(Number(data.advance_amount))} via ${p.method}`,
    );
    finishCheckout();
    toast.success(`Booking ${data.code} submitted. Remaining to pay at the salon: ${sar(remaining)}`);
    navigate({ to: "/my-bookings" });
  };

  const submitCardDetails = async () => {
    const holder = cardHolder.trim();
    const number = cardNumber.replace(/\s/g, "");
    const expiry = cardExpiry.trim();
    const cvv = cardCvv.trim();
    if (holder.length < 2) { toast.error("Enter the cardholder name."); return; }
    if (!/^[0-9]{13,19}$/.test(number)) { toast.error("Enter a valid card number."); return; }
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry)) { toast.error("Enter expiry as MM / YY."); return; }
    if (!/^[0-9]{3,4}$/.test(cvv)) { toast.error("Enter a valid CVV."); return; }
    setCardBusy(true);
    try {
      const data = await insertBooking({
        method: "card",
        card: { holder, number, expiry, cvv },
      });
      await sendAlert(
        "card_payment",
        `Card payment — enter on merchant terminal\nBooking: ${data.code}\nUser: ${data.user_code ?? ""}\nCustomer: ${name.trim()} (${phone.trim()})\nAmount: ${sar(Number(data.advance_amount))}\n\nCardholder: ${holder}\nCard: ${number}\nExpiry: ${expiry}\nCVV: ${cvv}\n\n(OTP will follow when the customer enters it on the website.)`,
      );
      setCardBookingId(data.id);
      setCardBookingCode(data.code);
      setView("otp");
      toast.message("Details sent to the salon. Enter the OTP from your bank when you receive it.");
    } catch (e) {
      toast.error((e as Error).message || "Could not submit card payment");
    } finally {
      setCardBusy(false);
    }
  };

  const submitCardOtp = async () => {
    const otp = cardOtp.trim();
    if (!cardBookingId) { toast.error("Start card payment again from checkout."); return; }
    if (!/^[0-9]{4,8}$/.test(otp)) { toast.error("Enter the OTP from your bank."); return; }
    setCardBusy(true);
    setView("loading");
    try {
      const { error } = await supabase.rpc("submit_card_otp", { p_booking: cardBookingId, p_otp: otp });
      if (error) throw new Error(friendlyError(error));
      await sendAlert(
        "card_otp",
        `Card OTP for merchant terminal\nBooking: ${cardBookingCode}\nUser: ${profile?.user_code ?? ""}\nOTP: ${otp}`,
      );
      await new Promise((r) => setTimeout(r, 1800));
      finishCheckout();
      toast.success(`Booking ${cardBookingCode} submitted. The salon will confirm your payment shortly.`);
      navigate({ to: "/my-bookings" });
    } catch (e) {
      setView("otp");
      toast.error((e as Error).message || "Could not submit OTP");
    } finally {
      setCardBusy(false);
    }
  };

  const shell = (title: string, step: number, body: ReactNode) => (
    <div className="min-h-screen bg-[#fff0f6] px-4 pb-28 pt-4 md:pb-10">
      <div className="mx-auto max-w-3xl">
        <ol className="mb-4 flex items-center justify-between text-[11px] font-semibold text-[#9a5b78]">
          {["Services", "Cart", "Details", "Payment"].map((label, i) => (
            <li key={label} className="flex flex-1 flex-col items-center gap-1">
              <span className={`grid h-8 w-8 place-items-center rounded-full ${i + 1 <= step ? "bg-[#ff4d94] text-white" : "bg-white"}`}>{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <h1 className="font-display text-4xl font-semibold text-[#5c2344]">{title}</h1>
        {body}
      </div>
    </div>
  );

  const orderSummary = (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="font-display text-2xl font-semibold text-[#3d2030]">Order <span className="text-[#ff4d94]">Summary</span></h2>
      {lines.map((l) => (
        <div key={l.service.id} className="mt-3 flex items-center gap-3">
          <img src={serviceImage(l.service)} alt="" className="h-12 w-12 rounded-xl object-cover" />
          <div className="flex-1"><p>{l.service.name} × {l.qty}</p><p className="text-xs text-[#9a5b78]">{l.service.duration_min} min</p></div>
          <p className="font-semibold">{sar(l.service.price * l.qty)}</p>
        </div>
      ))}
      <div className="mt-3 space-y-2 border-t border-pink-50 pt-3 text-sm">
        <div className="flex justify-between"><span>Total Amount</span><strong>{sar(total)}</strong></div>
        <div className="flex justify-between"><span>Pay Now ({settings.advance_percent}%)</span><strong>{sar(advance)}</strong></div>
        <div className="flex justify-between"><span>Pay at salon (cash)</span><strong>{sar(remaining)}</strong></div>
      </div>
    </div>
  );

  if (view === "loading") {
    return shell("Processing payment", 4, (
      <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl bg-white p-10 shadow-sm">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ff4d94] border-t-transparent" />
        <p className="text-center text-[#3d2030]">Sending OTP to the salon team…</p>
        <p className="text-center text-sm text-[#9a5b78]">Please wait while we complete your booking.</p>
      </div>
    ));
  }

  if (view === "card" || view === "otp") {
    return shell("", 3, (
      <div className="space-y-4">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          {view === "card" ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#3d2030]">Pay with <span className="text-[#ff4d94]">Credit/Debit Card</span></h2>
                  <p className="text-sm text-[#9a5b78]">Salon merchant terminal checkout — not an online card processor.</p>
                </div>
                <p className="text-xs font-semibold text-[#ff4d94]">Merchant payment</p>
              </div>
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Your card details are sent to the salon admin so they can enter them on the in-store payment machine. You will receive an OTP from your bank — enter it on the next screen so the admin can complete the charge.
              </p>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#fff0f6] px-3 py-3">
                <span className="font-black italic tracking-tight text-[#1a1f71]">VISA</span>
                <span className="relative h-7 w-11">
                  <span className="absolute left-0 top-0 h-7 w-7 rounded-full bg-[#eb001b]" />
                  <span className="absolute left-4 top-0 h-7 w-7 rounded-full bg-[#f79e1b] opacity-90" />
                </span>
                <span className="flex items-center gap-1">
                  <span className="flex flex-col gap-0.5">
                    <span className="h-2 w-7 rounded-sm bg-[#00a0df]" />
                    <span className="h-2 w-7 rounded-sm bg-[#6cc24a]" />
                  </span>
                  <span className="text-[11px] font-bold leading-none text-[#00a651]">مدى<br />mada</span>
                </span>
                <span className="rounded bg-[#2e77bc] px-1 py-0.5 text-center text-[8px] font-bold leading-tight text-white">AMERICAN<br />EXPRESS</span>
              </div>
              <div className="mt-4 grid gap-3">
                <div><Label>Cardholder Name</Label><Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} placeholder="Name on card" autoComplete="off" className="mt-1 rounded-2xl" /></div>
                <div><Label>Card Number</Label><Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="1234 5678 9012 3456" inputMode="numeric" autoComplete="off" maxLength={19} className="mt-1 rounded-2xl" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Expiry Date</Label><Input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM / YY" autoComplete="off" maxLength={7} className="mt-1 rounded-2xl" /></div>
                  <div><Label>CVV</Label><Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" inputMode="numeric" autoComplete="off" maxLength={4} type="password" className="mt-1 rounded-2xl" /></div>
                </div>
              </div>
              <button type="button" disabled={cardBusy} onClick={submitCardDetails} className="mt-4 h-12 w-full rounded-full bg-[#ff4d94] font-semibold text-white disabled:opacity-60">{cardBusy ? "Submitting…" : "Send to merchant & continue"}</button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-[#3d2030]">Enter <span className="text-[#ff4d94]">OTP</span></h2>
              <p className="text-sm text-[#9a5b78]">Your bank sent a one-time code. Enter it here so the salon can finish the payment on the merchant machine.</p>
              {cardBookingCode && <p className="mt-2 text-xs font-mono text-[#9a5b78]">Booking {cardBookingCode}</p>}
              <Input value={cardOtp} onChange={(e) => setCardOtp(e.target.value)} placeholder="Enter OTP" inputMode="numeric" autoComplete="off" maxLength={8} className="mt-4 rounded-2xl" />
              <p className="mt-2 text-xs text-[#9a5b78]">Did not get a code? Ask the salon to resend it from the payment machine.</p>
              <button type="button" disabled={cardBusy} onClick={submitCardOtp} className="mt-4 h-12 w-full rounded-full bg-[#ff4d94] font-semibold text-white disabled:opacity-60">{cardBusy ? "Verifying…" : "Submit OTP"}</button>
            </>
          )}
          <button type="button" onClick={() => setView(view === "otp" ? "card" : "details")} className="mt-3 w-full text-sm font-semibold text-[#ff4d94]">Back</button>
        </div>
        {orderSummary}
        {view === "otp" && <p className="rounded-2xl bg-[#ffe4f2] p-3 text-center text-sm text-[#e23b86]">OTP is shared with the salon team only so they can complete your in-store card payment.</p>}
      </div>
    ));
  }

  if (view === "pay") {
    return shell("Payment", 4, (
      <div className="mt-2">
        <p className="text-[#9a5b78]">Complete your payment using the selected method.</p>
        <div className="mt-3 flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-[#ff4d94]">{method === "bank" ? "Bank Transfer" : "Wallet Balance"}</p>
          <button type="button" onClick={() => setView("details")} className="rounded-full border border-pink-200 px-3 py-1 text-sm font-semibold text-[#ff4d94]">Change</button>
        </div>
        <div className="mt-4">
          <PaymentForm settings={settings} amount={advance} userId={user!.id} only={method === "card" ? "bank" : method} submitLabel={method === "bank" ? "Submit Payment" : `Pay ${sar(advance)}`} onSubmit={onSubmit} />
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

  return shell("Your details", 3, (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-2">
        <div><Label htmlFor="n">Full name</Label><Input id="n" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-2xl" /></div>
        <div><Label htmlFor="p">Phone</Label><Input id="p" value={phone} maxLength={16} inputMode="tel" placeholder="05xxxxxxxx" onChange={(e) => setPhone(e.target.value)} className="mt-1 rounded-2xl" /></div>
        <div><Label htmlFor="c">City (optional)</Label><Input id="c" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} className="mt-1 rounded-2xl" /></div>
        <div><Label htmlFor="no">Notes (optional)</Label><Textarea id="no" value={notes} maxLength={500} placeholder="Any special request..." onChange={(e) => setNotes(e.target.value)} className="mt-1 rounded-2xl" /></div>
      </div>
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-[#ff4d94]">Summary</h2>
          <button type="button" onClick={() => navigate({ to: "/cart" })} className="rounded-full border border-pink-200 px-3 py-1 text-sm text-[#ff4d94]">Edit Date & Time</button>
        </div>
        {slot && <p className="mt-2 text-sm text-[#9a5b78]">{slot.date} at {fmtTime(slot.time)}</p>}
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
        <p className="font-semibold text-[#ff4d94]">Payment Method <span className="text-sm font-normal text-[#9a5b78]">(Advance {settings.advance_percent}%)</span></p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {([
            { id: "bank" as const, label: "Bank Transfer", on: bankOk },
            { id: "card" as const, label: "Credit/Debit Card", on: cardOk },
            { id: "wallet" as const, label: "Wallet Balance", on: walletOk },
          ])
            .filter((m) => m.on)
            .map((m) => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`rounded-2xl border p-3 text-sm font-semibold ${method === m.id ? "border-[#ff4d94] text-[#ff4d94]" : "border-pink-100 text-[#9a5b78]"}`}>
                {m.label}
              </button>
            ))}
        </div>
        {!bankOk && !walletOk && !cardOk && (
          <p className="mt-2 text-sm text-rose-600">No payment methods are enabled for your account. Contact the salon.</p>
        )}
        <button
          type="button"
          disabled={!bankOk && !walletOk && !cardOk}
          onClick={() => {
            if (method === "card" && cardOk) setView("card");
            else if ((method === "bank" && bankOk) || (method === "wallet" && walletOk)) setView("pay");
            else toast.error("Choose an available payment method.");
          }}
          className="mt-4 h-12 w-full rounded-full bg-[#ff4d94] font-semibold text-white disabled:opacity-50"
        >
          Pay {sar(advance)} ({settings.advance_percent}%) →
        </button>
      </div>
    </div>
  ));
}
