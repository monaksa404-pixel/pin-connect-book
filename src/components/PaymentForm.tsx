import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Copy, Wallet, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Settings } from "@/lib/types";
import { mediaUrl, sar } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAssignedBank, useProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaymentResult = { method: "bank" | "wallet"; screenshotPath: string | null };

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
  only?: "bank" | "wallet";
}) {
  const { data: profile } = useProfile();
  const { data: bank } = useAssignedBank(profile?.bank_account_id);
  const bankOn = settings.bank_enabled && (profile?.allow_bank ?? true) && !!bank;
  const walletOn = settings.stc_enabled && (profile?.allow_wallet ?? true);
  const balance = Number(profile?.wallet_balance ?? 0);
  const [pick, setPick] = useState<"bank" | "wallet" | null>(only ?? null);
  const method = only ?? pick ?? (bankOn ? "bank" : walletOn ? "wallet" : null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!bankOn && !walletOn) {
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
    setBusy(true);
    try {
      const screenshotPath = method === "bank" && file ? await uploadScreenshot(userId, file) : null;
      await onSubmit({ method, screenshotPath });
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const Option = ({ id, icon: Icon, title, sub }: { id: "bank" | "wallet"; icon: typeof Wallet; title: string; sub: string }) => (
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

      <Button onClick={submit} disabled={busy || !method || (method === "wallet" && balance < amount)} className="h-12 w-full rounded-full bg-[#ff4d94] text-base">
        {busy ? "Submitting…" : submitLabel}
      </Button>
    </div>
  );
}
