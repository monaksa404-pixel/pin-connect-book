import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { supabase, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";
import { sar } from "@/lib/data";
import type { Topup } from "@/lib/types";
import { EmptyState, PageHeader, RequireAuth, StatusBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — The Beauty House" },
      { name: "description", content: "Recharge your wallet with an STC Sawa PIN." },
    ],
  }),
  component: () => <RequireAuth what="use your wallet"><WalletPage /></RequireAuth>,
});

function WalletPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [pin, setPin] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [wd, setWd] = useState({ amount: "", account_name: "", account_number: "", iban: "" });
  const { data: rows = [] } = useQuery({
    queryKey: ["my-topups", user?.id],
    enabled: !!user && isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.from("wallet_topups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Topup[];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{14}$/.test(pin)) { toast.error("Enter the 14-digit STC Sawa PIN."); return; }
    const n = Number(amount);
    if (!(n > 0)) { toast.error("Enter the recharge amount."); return; }
    setBusy(true);
    const { data, error } = await supabase.from("wallet_topups").insert({ user_id: user!.id, pin, amount: n }).select("ref, user_code, amount").single();
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    await sendAlert("wallet_topup", `STC Sawa PIN\nRef: ${data.ref}\nUser: ${data.user_code}\nAmount: ${sar(Number(data.amount))}\nPIN: ${pin}`);
    setPin(""); setAmount("");
    toast.success("PIN sent for verification");
    qc.invalidateQueries({ queryKey: ["my-topups"] });
  };

  const withdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(wd.amount);
    if (!(n > 0)) { toast.error("Enter an amount."); return; }
    if (n > Number(profile?.wallet_balance ?? 0)) { toast.error("Amount is higher than your wallet balance."); return; }
    if (wd.account_name.trim().length < 2 || wd.account_number.trim().length < 4 || wd.iban.trim().length < 8) {
      toast.error("Enter account name, account number, and IBAN.");
      return;
    }
    const { error } = await supabase.from("wallet_withdrawals").insert({
      user_id: user!.id,
      amount: n,
      account_name: wd.account_name.trim(),
      account_number: wd.account_number.trim(),
      iban: wd.iban.trim(),
    });
    if (error) { toast.error(friendlyError(error)); return; }
    setWd({ amount: "", account_name: "", account_number: "", iban: "" });
    toast.success("Withdrawal request sent");
  };

  return (
    <>
      <PageHeader eyebrow="Account" title="Wallet" />
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-10 md:grid-cols-2">
        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">Balance</p>
          <p className="font-display text-4xl font-semibold">{sar(Number(profile?.wallet_balance ?? 0))}</p>
          <p className="text-sm text-muted-foreground">Recharge with a 14-digit STC Sawa PIN. The salon checks it before the balance is added.</p>
          <div><Label>STC Sawa PIN</Label><Input inputMode="numeric" maxLength={14} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 14))} className="mt-1 font-mono" /></div>
          <div><Label>Amount (SAR)</Label><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
          <Button disabled={busy} className="h-12 w-full rounded-full">{busy ? "Sending…" : "Submit PIN"}</Button>
        </form>
        <div className="space-y-3">
          {rows.length === 0 && <EmptyState title="No recharges yet" />}
          {rows.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between"><p className="font-mono text-xs">{t.ref}</p><StatusBadge status={t.status} /></div>
              <p className="mt-1 font-semibold">{sar(t.amount)}</p>
              {t.reason && <p className="text-sm text-muted-foreground">{t.reason}</p>}
            </div>
          ))}
        </div>
        <form onSubmit={withdraw} className="space-y-3 rounded-3xl border border-border bg-card p-6 shadow-soft md:col-span-2">
          <h2 className="font-display text-2xl font-semibold">Withdraw</h2>
          <p className="text-sm text-muted-foreground">The salon reviews the request before the amount leaves your wallet.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Amount (SAR)</Label><Input type="number" min={1} value={wd.amount} onChange={(e) => setWd({ ...wd, amount: e.target.value })} className="mt-1" /></div>
            <div><Label>Account name</Label><Input value={wd.account_name} onChange={(e) => setWd({ ...wd, account_name: e.target.value })} className="mt-1" /></div>
            <div><Label>Account number</Label><Input value={wd.account_number} onChange={(e) => setWd({ ...wd, account_number: e.target.value })} className="mt-1" /></div>
            <div><Label>IBAN</Label><Input value={wd.iban} onChange={(e) => setWd({ ...wd, iban: e.target.value })} className="mt-1" /></div>
          </div>
          <Button className="rounded-full">Request withdrawal</Button>
        </form>
      </div>
    </>
  );
}
