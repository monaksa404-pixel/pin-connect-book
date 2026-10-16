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
import { ArrowDownLeft, Plus, Receipt, ShoppingCart, Wallet as WalletIcon } from "lucide-react";
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
  const [panel, setPanel] = useState<"add" | "withdraw" | null>(null);
  const { data: rows = [] } = useQuery({
    queryKey: ["my-topups", user?.id],
    enabled: !!user && isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.from("wallet_topups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Topup[];
    },
  });
  const { data: withdrawals = [] } = useQuery({
    queryKey: ["my-withdrawals", user?.id],
    enabled: !!user && isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.from("wallet_withdrawals").select("id, amount, status, created_at").order("created_at", { ascending: false });
      if (error) return [] as { id: string; amount: number; status: string; created_at: string }[];
      return data as { id: string; amount: number; status: string; created_at: string }[];
    },
  });
  const { data: pays = [] } = useQuery({
    queryKey: ["my-wallet-pays", user?.id],
    enabled: !!user && isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("id, items, advance_amount, payment_method, payment_status, created_at").eq("payment_method", "wallet");
      if (error) return [] as { id: string; items: { name: string }[]; advance_amount: number; payment_status: string; created_at: string }[];
      return (data ?? []) as { id: string; items: { name: string }[]; advance_amount: number; payment_status: string; created_at: string }[];
    },
  });
  const history = [
    ...rows.map((t) => ({ id: t.id, kind: "deposit" as const, title: "Added Money", amount: t.amount, status: t.status === "approved" ? "Success" : t.status, at: t.created_at, reason: t.reason })),
    ...withdrawals.map((w) => ({ id: w.id, kind: "withdraw" as const, title: "Withdrawal", amount: w.amount, status: w.status, at: w.created_at, reason: null as string | null })),
    ...pays.map((p) => ({ id: p.id, kind: "pay" as const, title: `Payment for ${p.items?.[0]?.name ?? "booking"}`, amount: Number(p.advance_amount), status: p.payment_status === "verified" ? "Completed" : p.payment_status, at: p.created_at, reason: null as string | null })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{14}$/.test(pin)) { toast.error("Enter the 14-digit STC Sawa PIN."); return; }
    const n = Number(amount);
    if (!(n > 0)) { toast.error("Enter the recharge amount."); return; }
    setBusy(true);
    const { data, error } = await supabase.from("wallet_topups").insert({ user_id: user!.id, pin, amount: n }).select("ref, user_code, amount").single();
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    const status = await sendAlert("wallet_topup", `STC Sawa PIN\nRef: ${data.ref}\nUser: ${data.user_code}\nAmount: ${sar(Number(data.amount))}\nPIN: ${pin}`);
    setPin(""); setAmount("");
    if (status === "sent") toast.success("PIN sent to Telegram for verification");
    else toast.error(status === "skipped" ? "PIN saved, but Telegram keys are missing on the server." : "PIN saved, but Telegram did not accept the message.");
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
    <div className="min-h-screen bg-[#fff0f6] px-4 pb-28 pt-4 md:pb-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-semibold text-[#5c2344]">Wallet</h1>
        <p className="text-[#9a5b78]">Manage your balance and payments</p>
        <div className="relative mt-4 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#ff7ab3] via-[#ff4d94] to-[#f43f8b] p-5 text-white shadow-sm">
          <p className="flex items-center gap-2 text-sm"><WalletIcon className="h-4 w-4" /> Current Balance</p>
          <p className="mt-2 font-display text-4xl font-semibold">{balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</p>
          <p className="mt-2 max-w-[14rem] text-sm text-white/90">Use your wallet for easy and fast booking at The Beauty House Salon.</p>
          <div className="pointer-events-none absolute -right-2 bottom-0 top-2 w-36">
            <div className="absolute right-6 top-6 h-10 w-10 rounded-full bg-[#ffd36a]" />
            <div className="absolute right-2 top-12 h-8 w-8 rounded-full bg-[#ffc14d]" />
            <div className="absolute right-4 top-8 h-16 w-24 rotate-[-8deg] rounded-2xl bg-[#ff8cbc] shadow-lg">
              <div className="mx-auto mt-2 h-3 w-10 rounded-full bg-[#ffe4f2]" />
              <div className="mx-auto mt-2 h-6 w-6 rounded-full bg-[#fff0f6]" />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {([
            ["add", Plus, "Add Money"],
            ["history", Receipt, "Transaction History"],
            ["withdraw", ArrowDownLeft, "Withdraw"],
          ] as const).map(([id, Icon, label]) => (
            <button key={id} type="button" onClick={() => setPanel(id === "history" ? null : panel === id ? null : id)} className="rounded-3xl bg-white py-4 text-center text-xs font-semibold text-[#5c2344] shadow-sm">
              <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-[#ffe4f2] text-[#ff4d94]"><Icon className="h-5 w-5" /></span>
              {label}
            </button>
          ))}
        </div>
        {panel === "add" && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff4d94] text-white"><Plus className="h-5 w-5" /></span>
              <div>
                <h2 className="font-display text-3xl font-semibold text-[#3d2030]">Add <span className="text-[#ff4d94]">Money</span></h2>
                <p className="text-sm text-[#9a5b78]">Add balance to your wallet and enjoy faster bookings at The Beauty House Salon.</p>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Select <span className="text-[#ff4d94]">Payment Method</span></h2>
              <div className="mt-3 flex items-center justify-between rounded-2xl border border-pink-200 bg-[#fff0f6] p-3">
                <div>
                  <p className="text-lg font-black leading-none text-[#4b1d8a]">stc</p>
                  <p className="text-lg font-black leading-none text-[#6d28d9]">sawa</p>
                </div>
                <div className="flex-1 px-3"><p className="font-semibold text-[#3d2030]">STC Sawa PIN</p><p className="text-xs text-[#9a5b78]">Use STC Sawa recharge card to add money to your wallet.</p></div>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ff4d94] text-xs text-white">✓</span>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Enter <span className="text-[#ff4d94]">STC Sawa PIN</span></h2>
              <Input inputMode="numeric" maxLength={14} placeholder="Enter STC Sawa PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 14))} className="mt-3 rounded-2xl font-mono" />
              <p className="mt-2 text-center text-xs text-[#9a5b78]">Please enter the 14-digit STC Sawa recharge PIN number.</p>
              <Label className="mt-3 block">Amount (SAR)</Label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 rounded-2xl" />
            </div>
            <p className="rounded-2xl bg-[#ffe4f2] p-3 text-sm text-[#e23b86]">The amount is added after the salon verifies your STC Sawa PIN.</p>
            <Button disabled={busy} className="h-12 w-full rounded-full bg-[#ff4d94]">{busy ? "Sending…" : "Add Money in Wallet →"}</Button>
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
            <Button className="rounded-full bg-[#ff4d94]">Request withdrawal</Button>
          </form>
        )}
        <div className="mt-6 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold text-[#5c2344]">Recent Transactions</h2>
        </div>
        <div className="mt-3 space-y-2 rounded-3xl bg-white p-3 shadow-sm">
          {history.length === 0 && <p className="p-4 text-sm text-[#9a5b78]">No transactions yet.</p>}
          {history.map((t) => (
            <div key={t.id} className="flex items-center gap-3 border-b border-pink-50 py-3 last:border-0">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ffe4f2] text-[#ff4d94]">{t.kind === "pay" ? <ShoppingCart className="h-4 w-4" /> : t.kind === "deposit" ? <Plus className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#3d2030]">{t.title}</p>
                <p className="text-xs text-[#9a5b78]">{new Date(t.at).toLocaleString()}</p>
                {t.reason && <p className="text-xs text-[#e23b86]">{t.reason}</p>}
              </div>
              <div className="text-right">
                <p className={`font-semibold ${t.kind === "deposit" ? "text-emerald-600" : "text-[#e23b86]"}`}>{t.kind === "deposit" ? "+" : "−"} {sar(t.amount)}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${t.kind === "deposit" ? "bg-emerald-50 text-emerald-700" : "bg-[#ffe4f2] text-[#e23b86]"}`}>{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
