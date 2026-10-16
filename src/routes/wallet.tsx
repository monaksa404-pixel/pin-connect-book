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
import { RequireAuth } from "@/components/shared";
import { ArrowDownLeft, Plus, Receipt, Wallet as WalletIcon } from "lucide-react";
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
  const [panel, setPanel] = useState<"add" | "history" | "withdraw" | null>("add");
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

  const balance = Number(profile?.wallet_balance ?? 0);

  return (
    <div className="min-h-screen bg-[#fff5f8] px-4 pb-28 pt-4 md:pb-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-semibold text-rose-950">Wallet</h1>
        <p className="text-rose-900/60">Manage your balance and payments</p>
        <div className="mt-4 rounded-3xl bg-gradient-to-br from-rose-500 to-rose-600 p-5 text-white shadow-sm">
          <p className="flex items-center gap-2 text-sm"><WalletIcon className="h-4 w-4" /> Current Balance</p>
          <p className="mt-2 font-display text-4xl font-semibold">{balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</p>
          <p className="mt-2 max-w-xs text-sm text-white/90">Use your wallet for easy and fast booking at The Beauty House Salon.</p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {([
            ["add", Plus, "Add Money"],
            ["history", Receipt, "Transaction History"],
            ["withdraw", ArrowDownLeft, "Withdraw"],
          ] as const).map(([id, Icon, label]) => (
            <button key={id} type="button" onClick={() => setPanel(panel === id ? null : id)} className="rounded-3xl bg-white py-4 text-center text-xs font-semibold text-rose-950 shadow-sm">
              <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-rose-50 text-rose-600"><Icon className="h-5 w-5" /></span>
              {label}
            </button>
          ))}
        </div>
        {panel === "add" && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Select <span className="text-rose-600">Payment Method</span></h2>
              <div className="mt-3 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-3">
                <div><p className="font-semibold text-rose-950">STC Sawa PIN</p><p className="text-xs text-rose-900/60">Use an STC Sawa recharge card to add money to your wallet.</p></div>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-xs text-white">✓</span>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Enter <span className="text-rose-600">STC Sawa PIN</span></h2>
              <Input inputMode="numeric" maxLength={14} placeholder="Enter STC Sawa PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 14))} className="mt-3 rounded-2xl font-mono" />
              <p className="mt-2 text-center text-xs text-rose-900/50">Please enter the 14-digit STC Sawa recharge PIN number.</p>
              <Label className="mt-3 block">Amount (SAR)</Label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 rounded-2xl" />
            </div>
            <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">The amount is added after the salon verifies your STC Sawa PIN.</p>
            <Button disabled={busy} className="h-12 w-full rounded-full bg-rose-600">{busy ? "Sending…" : "Add Money in Wallet →"}</Button>
          </form>
        )}
        {panel === "withdraw" && (
          <form onSubmit={withdraw} className="mt-4 space-y-3 rounded-3xl bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Amount (SAR)</Label><Input type="number" min={1} value={wd.amount} onChange={(e) => setWd({ ...wd, amount: e.target.value })} className="mt-1" /></div>
              <div><Label>Account name</Label><Input value={wd.account_name} onChange={(e) => setWd({ ...wd, account_name: e.target.value })} className="mt-1" /></div>
              <div><Label>Account number</Label><Input value={wd.account_number} onChange={(e) => setWd({ ...wd, account_number: e.target.value })} className="mt-1" /></div>
              <div><Label>IBAN</Label><Input value={wd.iban} onChange={(e) => setWd({ ...wd, iban: e.target.value })} className="mt-1" /></div>
            </div>
            <Button className="rounded-full bg-rose-600">Request withdrawal</Button>
          </form>
        )}
        <div className="mt-6 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold text-rose-950">Recent Transactions</h2>
          <button type="button" onClick={() => setPanel("history")} className="text-sm font-semibold text-rose-600">View All &gt;</button>
        </div>
        <div className="mt-3 space-y-2 rounded-3xl bg-white p-3 shadow-sm">
          {rows.length === 0 && <p className="p-4 text-sm text-rose-900/60">No transactions yet.</p>}
          {rows.map((t) => (
            <div key={t.id} className="flex items-center gap-3 border-b border-rose-50 py-3 last:border-0">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-50 text-rose-600"><Plus className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-rose-950">Added Money</p>
                <p className="text-xs text-rose-900/50">{new Date(t.created_at).toLocaleString()}</p>
                {t.reason && <p className="text-xs text-rose-700">{t.reason}</p>}
              </div>
              <div className="text-right">
                <p className="font-semibold text-emerald-600">+ {sar(t.amount)}</p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">{t.status === "approved" ? "Success" : t.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
