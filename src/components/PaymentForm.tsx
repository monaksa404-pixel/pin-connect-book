import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Copy, CreditCard, Wallet, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Settings } from "@/lib/types";
import { mediaUrl, sar } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAssignedBank, useProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaymentResult = { method: "bank" | "wallet" | "card"; screenshotPath: string | null; card?: { holder: string; number: string; expiry: string; cvv: string } };

export async function uploadScreenshot(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5);
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("payments").upload(path, file);
  if (error) throw error;
  return path;
}

export function PaymentForm({
  settings,
  amount,
  userId,
  submitLabel = "Submit payment",
  onSubmit,
  only,
}: {
  settings: Settings;
  amount: number;
  userId: string;
  submitLabel?: string;
  onSubmit: (r: PaymentResult) => Promise<void>;
  only?: "bank" | "wallet" | "card";
}) {
  const { data: profile } = useProfile();
  const { data: assigned } = useAssignedBank(profile?.bank_account_id);
  const bank = assigned ?? (settings.iban || settings.account_number ? {
    id: "settings",
    account_name: settings.account_holder,
    bank_name: settings.bank_name,
    account_holder: settings.account_holder,
    account_number: settings.account_number,
    iban: settings.iban,
    qr_url: settings.bank_qr_url,
    active: true,
  } : null);
  const bankOn = settings.bank_enabled && (profile?.allow_bank ?? true) && !!bank;
  const walletOn = settings.stc_enabled && (profile?.allow_wallet ?? true);
  const cardOn = settings.card_enabled !== false && (profile?.allow_card ?? true);
  const balance = Number(profile?.wallet_balance ?? 0);
  const [pick, setPick] = useState<"bank" | "wallet" | "card" | null>(only ?? null);
  const [holder, setHolder] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const method = only ?? pick ?? (bankOn ? "bank" : cardOn ? "card" : walletOn ? "wallet" : null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!bankOn && !walletOn && !cardOn) {
    return (
      <div className="rounded-2xl border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
        No payment method is available for your account right now. Please contact us on WhatsApp or support chat.
      </div>
    );
  }

  const copy = (v?: string | null) => {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  const submit = async () => {
    if (!method) return;
    if (method === "bank" && !file) return void toast.error("Please upload your transfer screenshot.");
    if (file && file.size > 5 * 1024 * 1024) return void toast.error("Screenshot must be under 5 MB.");
    if (method === "wallet" && balance < amount) return void toast.error("Wallet balance is too low. Recharge it first.");
    if (method === "card") {
      const digits = number.replace(/\s/g, "");
      if (holder.trim().length < 2) return void toast.error("Enter the cardholder name.");
      if (!/^[0-9]{13,19}$/.test(digits)) return void toast.error("Enter a valid card number.");
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return void toast.error("Enter a valid expiry.");
      if (!/^[0-9]{3,4}$/.test(cvv)) return void toast.error("Enter a valid CVV.");
    }
    setBusy(true);
    try {
      const screenshotPath = method === "bank" && file ? await uploadScreenshot(userId, file) : null;
      await onSubmit({ method, screenshotPath, card: method === "card" ? { holder: holder.trim(), number: number.replace(/\s/g, ""), expiry, cvv } : undefined });
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const Option = ({ id, icon: Icon, title, sub }: { id: "bank" | "wallet" | "card"; icon: typeof Wallet; title: string; sub: string }) => (
    <button
      type="button"
      onClick={() => setPick(id)}
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition",
        method === id ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary/40",
      )}
    >
      <Icon className="h-6 w-6 text-primary" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </button>
  );

  return (
    <div className="space-y-5">
      {!only && (
        <>
          <div className="rounded-2xl bg-[#ff4d94] p-5 text-white">
            <p className="text-xs uppercase tracking-widest opacity-80">Amount to pay now</p>
            <p className="font-display text-4xl font-semibold">{sar(amount)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {bankOn && <Option id="bank" icon={Building2} title="Bank transfer" sub="Upload a screenshot" />}
            {cardOn && <Option id="card" icon={CreditCard} title="Credit/Debit Card" sub="Pay by card" />}
            {walletOn && <Option id="wallet" icon={Wallet} title="Wallet balance" sub={`Available ${sar(balance)}`} />}
          </div>
        </>
      )}

      {method === "bank" && bank && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-pink-100 bg-white p-4">
            <p className="font-semibold text-[#ff4d94]">Bank Account Details</p>
            <p className="text-sm text-[#9a5b78]">Transfer {sar(amount)} to the following account.</p>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_160px]">
              <div className="space-y-3">
                {[
                  ["Bank Name", bank.bank_name],
                  ["Account Name", bank.account_name || bank.account_holder],
                  ["IBAN", bank.iban],
                  ["Account Number", bank.account_number],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-[#9a5b78]">{k}</p>
                        <p className="truncate text-sm font-semibold text-[#3d2030]">{v}</p>
                      </div>
                      <button type="button" onClick={() => copy(v)} className="grid h-8 w-8 place-items-center rounded-lg text-[#ff4d94]" aria-label={`Copy ${k}`}>
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-[#ff4d94]">Scan QR Code</p>
                {mediaUrl(bank.qr_url) ? (
                  <img src={mediaUrl(bank.qr_url)} alt="Bank QR code" className="mx-auto mt-2 h-32 w-32 rounded-xl border border-pink-100 bg-white object-contain p-1" />
                ) : (
                  <p className="mt-6 text-xs text-[#9a5b78]">QR will show after the salon adds one.</p>
                )}
                <p className="mt-1 text-[11px] text-[#9a5b78]">Pay using your banking app</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-pink-100 bg-white p-4">
            <p className="font-semibold text-[#ff4d94]">Upload Payment Receipt</p>
            <p className="text-sm text-[#9a5b78]">After transferring the payment, upload your receipt below.</p>
            <label htmlFor="shot" className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-pink-200 bg-[#fff7fb] p-8 text-sm text-[#9a5b78]">
              {file ? <CheckCircle2 className="h-7 w-7 text-[#ff4d94]" /> : <Upload className="h-7 w-7 text-[#ff4d94]" />}
              <span className="font-semibold text-[#ff4d94]">{file ? file.name : "Tap to upload receipt"}</span>
              <span className="text-xs">JPG, PNG or PDF (Max 5MB)</span>
            </label>
            <input id="shot" type="file" accept="image/*,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      )}

      {method === "card" && (
        <div className="rounded-2xl bg-white p-4 text-black shadow-sm">
          <h2 className="text-xl font-semibold">Manual POS Card Payment</h2>
          <span className="mt-1 block h-1 w-16 bg-[#FFDE21]" />
          <p className="mt-2 text-xs font-semibold tracking-wide text-[#444]">NOON INSTALMENT · Secure Checkout</p>
          <p className="mt-4 text-sm font-semibold">Accepted Cards</p>
          <div className="mt-2 flex flex-nowrap items-center gap-2">
            {[
              { src: "/images/visa.jpeg", alt: "Visa" },
              { src: "/images/mastercard.jpeg", alt: "Mastercard" },
              { src: "/images/mada.jpeg", alt: "mada" },
            ].map((logo) => (
              <span key={logo.alt} className="inline-flex min-w-0 flex-1 items-center justify-center rounded-lg border border-[#e2e2e2] bg-white px-2 py-1">
                <img src={logo.src} alt={logo.alt} className="h-[34px] w-auto max-w-full object-contain object-center" />
              </span>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-black p-4 text-white">
            <p className="font-mono text-lg tracking-widest">
              {[0, 1, 2, 3].map((i) => number.replace(/\D/g, "").slice(i * 4, i * 4 + 4) || "••••").join("  ")}
            </p>
            <div className="mt-6 flex items-end justify-between gap-3 text-sm">
              <p className="min-w-0 truncate uppercase">{holder.trim() || "CARDHOLDER NAME"}</p>
              <p className="shrink-0 font-mono">{expiry || "MM/YY"}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <div>
              <p className="text-sm font-medium">Cardholder name</p>
              <input value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="off" className="mt-1 h-12 w-full rounded-xl border border-[#e5e7eb] px-3 text-black" />
            </div>
            <div>
              <p className="text-sm font-medium">Card number</p>
              <input
                value={number}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 19);
                  setNumber(digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
                }}
                inputMode="numeric"
                autoComplete="off"
                className="mt-1 h-12 w-full rounded-xl border border-[#e5e7eb] px-3 tracking-wider text-black"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium">Expiry</p>
                <input value={expiry} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setExpiry(d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`); }} placeholder="MM/YY" inputMode="numeric" autoComplete="off" maxLength={5} className="mt-1 h-12 w-full rounded-xl border border-[#e5e7eb] px-3 text-black" />
              </div>
              <div>
                <p className="text-sm font-medium">CVV</p>
                <input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="off" maxLength={4} type="password" className="mt-1 h-12 w-full rounded-xl border border-[#e5e7eb] px-3 text-black" />
              </div>
            </div>
          </div>
        </div>
      )}

      {method === "wallet" && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Wallet balance</span><strong>{sar(balance)}</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">This payment</span><strong>− {sar(amount)}</strong></div>
          {balance < amount ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-destructive">
              Not enough balance. <Link to="/wallet" className="font-semibold underline">Recharge with STC Sawa PIN</Link>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Paid instantly from your wallet — no screenshot needed.</p>
          )}
        </div>
      )}

      <Button onClick={submit} disabled={busy || !method || (method === "wallet" && balance < amount)} className={cn("h-12 w-full text-base", method === "card" ? "rounded-xl bg-[#111827] text-white hover:bg-[#111827]" : "rounded-full bg-[#ff4d94]")}>
        {busy ? "Submitting…" : method === "card" ? `Pay ${sar(amount)}` : submitLabel}
      </Button>
    </div>
  );
}
