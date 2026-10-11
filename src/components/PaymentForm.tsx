import { useState } from "react";
import { Building2, Copy, Smartphone, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Settings } from "@/lib/types";
import { sar } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PaymentResult = { method: "bank" | "stc"; pin: string | null; screenshotPath: string | null };

export async function uploadScreenshot(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
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
}: {
  settings: Settings;
  amount: number;
  userId: string;
  submitLabel?: string;
  onSubmit: (r: PaymentResult) => Promise<void>;
}) {
  const initial = settings.bank_enabled ? "bank" : settings.stc_enabled ? "stc" : null;
  const [method, setMethod] = useState<"bank" | "stc" | null>(initial);
  const [pin, setPin] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!settings.bank_enabled && !settings.stc_enabled) {
    return (
      <div className="rounded-2xl border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
        Online payment is temporarily unavailable. Please contact us on WhatsApp.
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
    if (method === "stc" && !/^\d{10,20}$/.test(pin.trim())) {
      toast.error("Enter the full recharge PIN (digits only).");
      return;
    }
    if (method === "bank" && !file) {
      toast.error("Please upload your transfer screenshot.");
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error("Screenshot must be under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const screenshotPath = method === "bank" && file ? await uploadScreenshot(userId, file) : null;
      await onSubmit({ method, pin: method === "stc" ? pin.trim() : null, screenshotPath });
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-rose p-5 text-primary-foreground">
        <p className="text-xs uppercase tracking-widest opacity-80">Amount to pay now</p>
        <p className="font-display text-4xl font-semibold">{sar(amount)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {settings.bank_enabled && (
          <button
            type="button"
            onClick={() => setMethod("bank")}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition",
              method === "bank" ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary/40",
            )}
          >
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">Bank transfer</p>
              <p className="text-xs text-muted-foreground">Upload a screenshot</p>
            </div>
          </button>
        )}
        {settings.stc_enabled && (
          <button
            type="button"
            onClick={() => setMethod("stc")}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition",
              method === "stc" ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary/40",
            )}
          >
            <Smartphone className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">STC Sawa voucher</p>
              <p className="text-xs text-muted-foreground">Enter recharge PIN</p>
            </div>
          </button>
        )}
      </div>

      {method === "bank" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          {[
            ["Bank", settings.bank_name],
            ["Account holder", settings.account_holder],
            ["Account number", settings.account_number],
            ["IBAN", settings.iban],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="truncate font-mono text-sm font-semibold">{v}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => copy(v)} aria-label={`Copy ${k}`}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {settings.bank_qr_url && (
            <img src={settings.bank_qr_url} alt="Bank QR code" className="mx-auto h-40 w-40 rounded-xl border border-border object-contain" loading="lazy" />
          )}
          <div>
            <Label htmlFor="shot">Payment screenshot</Label>
            <label
              htmlFor="shot"
              className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-sm text-muted-foreground hover:border-primary/50"
            >
              {file ? <CheckCircle2 className="h-6 w-6 text-success" /> : <Upload className="h-6 w-6" />}
              {file ? file.name : "Tap to upload (JPG/PNG, max 5 MB)"}
            </label>
            <input id="shot" type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      )}

      {method === "stc" && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Buy an STC Sawa recharge card worth <strong className="text-foreground">{sar(amount)}</strong> and enter its PIN below.
          </p>
          <Label htmlFor="pin">Recharge PIN</Label>
          <Input
            id="pin"
            inputMode="numeric"
            maxLength={20}
            placeholder="Enter 14-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="h-12 font-mono text-lg tracking-widest"
          />
        </div>
      )}

      <Button onClick={submit} disabled={busy || !method} className="h-12 w-full rounded-full text-base">
        {busy ? "Submitting…" : submitLabel}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Our team verifies every payment manually, usually within minutes.</p>
    </div>
  );
}
