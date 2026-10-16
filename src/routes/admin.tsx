import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, DEFAULT_SETTINGS, fmtTime, mediaUrl, sar, serviceImage, settingsQuery } from "@/lib/data";
import type { BankAccount, Booking, Profile, Service, Settings, Topup } from "@/lib/types";
import { RequireAuth, StatusBadge, EmptyState } from "@/components/shared";
import { ChatThread } from "@/components/ChatThread";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — The Beauty House" },
      { name: "description", content: "Manage bookings, payments, services and settings." },
      { property: "og:title", content: "Admin Panel — The Beauty House" },
      { property: "og:description", content: "Salon admin panel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <RequireAuth what="open the admin panel"><AdminGate /></RequireAuth>,
});

function AdminGate() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <div className="mx-auto max-w-md px-4 py-20"><EmptyState title="Admins only">Your account doesn't have admin access.</EmptyState></div>;
  return <Admin />;
}

function Admin() {
  return (
    <div className="min-h-screen bg-[#ffd6e8]">
      <header className="border-b border-rose-200 bg-[#ffe4f0]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-2xl font-semibold text-rose-700">The Beauty House · Admin</h1>
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Back to site</Link></Button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs defaultValue="bookings">
          <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-1 rounded-2xl bg-rose-100/80 p-1">
            {["bookings", "customers", "banks", "wallet", "withdrawals", "services", "sliders", "settings", "support", "telegram"].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="bookings"><BookingsTab /></TabsContent>
          <TabsContent value="customers"><CustomersTab /></TabsContent>
          <TabsContent value="banks"><BanksTab /></TabsContent>
          <TabsContent value="wallet"><WalletTab /></TabsContent>
          <TabsContent value="withdrawals"><WithdrawalsTab /></TabsContent>
          <TabsContent value="services"><ServicesTab /></TabsContent>
          <TabsContent value="sliders"><SlidersTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
          <TabsContent value="support"><SupportTab /></TabsContent>
          <TabsContent value="telegram"><TelegramTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---------------- Bookings ---------------- */
function BookingsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<Booking | null>(null);
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { data = [] } = useQuery({
    queryKey: ["admin-bookings"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data as Booking[];
    },
  });
  const list = data.filter((b) =>
    filter === "all" ? true : filter === "pay" ? b.payment_status === "pending" || b.extra_payment_status === "under_verification" : b.status === filter,
  );
  const stats = {
    today: data.filter((b) => b.booking_date === new Date().toISOString().slice(0, 10)).length,
    pending: data.filter((b) => b.payment_status === "pending").length,
    revenue: data.filter((b) => b.payment_status === "verified").reduce((a, b) => a + Number(b.advance_amount), 0),
  };

  const toggleFull = async () => {
    const { error } = await supabase.from("settings").update({ bookings_full: !settings.bookings_full }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success(settings.bookings_full ? "Bookings re-opened" : "Bookings closed — customers now see the 'too many customers' message");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat k="Appointments today" v={String(stats.today)} />
        <Stat k="Payments to verify" v={String(stats.pending)} />
        <Stat k="Verified advances" v={sar(stats.revenue)} />
        <button onClick={toggleFull} className={cn("rounded-2xl border p-4 text-left transition", settings.bookings_full ? "border-destructive bg-destructive/10" : "border-border bg-card")}>
          <p className="text-xs text-muted-foreground">Customer limit</p>
          <p className={cn("font-semibold", settings.bookings_full && "text-destructive")}>{settings.bookings_full ? "Bookings CLOSED — tap to reopen" : "Open — tap to close"}</p>
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {[["all", "All"], ["pay", "Needs verification"], ["pending", "Pending"], ["confirmed", "Confirmed"], ["completed", "Completed"], ["cancelled", "Cancelled"]].map(([v, l]) => (
          <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} className="rounded-full" onClick={() => setFilter(v!)}>{l}</Button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Code</th><th className="p-3">Customer</th><th className="p-3">When</th><th className="p-3">Total</th><th className="p-3">Payment</th><th className="p-3">Status</th><th className="p-3">Balance</th><th /></tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{b.code}</td>
                <td className="p-3"><p className="font-medium">{b.customer_name}</p><p className="text-xs text-muted-foreground">{b.phone}</p></td>
                <td className="p-3">{b.booking_date}<br /><span className="text-xs text-muted-foreground">{fmtTime(b.booking_time)}</span></td>
                <td className="p-3">{sar(b.total)}</td>
                <td className="p-3"><StatusBadge status={b.payment_status} /><p className="mt-1 text-xs uppercase text-muted-foreground">{b.payment_method}</p></td>
                <td className="p-3"><StatusBadge status={b.status} /></td>
                <td className="p-3"><StatusBadge status={b.extra_payment_status} /></td>
                <td className="p-3"><Button size="icon" variant="ghost" onClick={() => setOpen(b)} aria-label="Open"><Eye className="h-4 w-4" /></Button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No bookings</td></tr>}
          </tbody>
        </table>
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {open && <BookingDetail b={data.find((x) => x.id === open.id) ?? open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-xl font-semibold">{v}</p></div>;
}

function Shot({ path }: { path: string | null }) {
  const { data } = useQuery({
    queryKey: ["shot", path],
    enabled: !!path,
    queryFn: async () => (await supabase.storage.from("payments").createSignedUrl(path!, 600)).data?.signedUrl ?? null,
  });
  if (!path) return null;
  return data ? <a href={data} target="_blank" rel="noreferrer"><img src={data} alt="Payment screenshot" className="max-h-72 rounded-xl border border-border" /></a> : <p className="text-xs">Loading screenshot…</p>;
}

function BookingDetail({ b }: { b: Booking }) {
  const qc = useQueryClient();
  const [extra, setExtra] = useState(String(b.extra_amount || b.remaining_amount));
  const [reason, setReason] = useState(b.admin_note ?? "");
  const [form, setForm] = useState({
    customer_name: b.customer_name,
    phone: b.phone,
    city: b.city ?? "",
    booking_date: b.booking_date,
    booking_time: String(b.booking_time).slice(0, 5),
    total: String(b.total),
    advance_amount: String(b.advance_amount),
    remaining_amount: String(b.remaining_amount),
    notes: b.notes ?? "",
  });
  const update = async (patch: Partial<Booking>, msg: string) => {
    const { error } = await supabase.from("bookings").update(patch).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
  };
  const del = async () => {
    if (!confirm("Delete this booking permanently?")) return;
    const { error } = await supabase.from("bookings").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
  };

  return (
    <>
      <DialogHeader><DialogTitle className="font-display text-2xl">Booking {b.code}</DialogTitle></DialogHeader>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label>Name</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
        <div><Label>Date</Label><Input type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} /></div>
        <div><Label>Time</Label><Input type="time" value={form.booking_time} onChange={(e) => setForm({ ...form, booking_time: e.target.value })} /></div>
        <div><Label>Total</Label><Input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></div>
        <div><Label>Advance</Label><Input type="number" value={form.advance_amount} onChange={(e) => setForm({ ...form, advance_amount: e.target.value })} /></div>
        <div><Label>Remaining</Label><Input type="number" value={form.remaining_amount} onChange={(e) => setForm({ ...form, remaining_amount: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <Button className="sm:col-span-2" onClick={() => update({
          customer_name: form.customer_name,
          phone: form.phone,
          city: form.city || null,
          booking_date: form.booking_date,
          booking_time: form.booking_time,
          total: Number(form.total),
          advance_amount: Number(form.advance_amount),
          remaining_amount: Number(form.remaining_amount),
          notes: form.notes || null,
        }, "Booking updated")}>Save changes</Button>
      </div>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <p><strong>{b.customer_name}</strong> · {b.phone}{b.city ? ` · ${b.city}` : ""}</p>
          <p>{b.booking_date} at {fmtTime(b.booking_time)}</p>
          {b.items.map((i) => <p key={i.service_id} className="text-muted-foreground">{i.name} × {i.qty} — {sar(i.price * i.qty)}</p>)}
          <p>Total <strong>{sar(b.total)}</strong> · Advance {sar(b.advance_amount)} · Remaining {sar(b.remaining_amount)}</p>
          {b.notes && <p className="rounded-lg bg-muted p-2">{b.notes}</p>}
        </div>
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between"><p className="font-semibold">Advance payment ({b.payment_method.toUpperCase()})</p><StatusBadge status={b.payment_status} /></div>
          {b.recharge_pin && <p className="font-mono text-base">PIN: {b.recharge_pin}</p>}
          <Shot path={b.screenshot_path} />
          <div><Label>Reason shown to the customer</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => update({ payment_status: "verified", status: "confirmed", admin_note: reason }, "Payment approved")}>Approve</Button>
            <Button size="sm" variant="destructive" onClick={() => update({ payment_status: "rejected", admin_note: reason }, "Payment rejected")}>Reject</Button>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <p className="font-semibold">Appointment status</p>
        <div className="flex flex-wrap gap-2">
          {(["pending", "confirmed", "completed", "cancelled"] as const).map((s) => (
            <Button key={s} size="sm" variant={b.status === s ? "default" : "outline"} className="capitalize" onClick={() => update({ status: s }, `Marked ${s}`)}>{s}</Button>
          ))}
        </div>
      </div>
      <div className="space-y-2 rounded-2xl border border-border p-3">
        <div className="flex items-center justify-between"><p className="font-semibold">Remaining balance online</p><StatusBadge status={b.extra_payment_status} /></div>
        <p className="text-xs text-muted-foreground">Turn on to show the customer a popup asking them to pay the remaining balance online instead of cash.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label htmlFor="ex">Amount (SAR)</Label><Input id="ex" type="number" min={1} value={extra} onChange={(e) => setExtra(e.target.value)} className="w-32" /></div>
          {!b.extra_enabled || b.extra_payment_status === "none" ? (
            <Button size="sm" onClick={() => Number(extra) > 0 ? update({ extra_enabled: true, extra_amount: Number(extra), extra_payment_status: "awaiting" }, "Customer will see the payment popup") : toast.error("Enter an amount")}>Request online payment</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => update({ extra_enabled: false, extra_payment_status: "none" }, "Request turned off")}>Turn off request</Button>
          )}
        </div>
        {b.extra_recharge_pin && <p className="font-mono">PIN: {b.extra_recharge_pin}</p>}
        <Shot path={b.extra_screenshot_path} />
        {b.extra_payment_status === "under_verification" && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => update({ extra_payment_status: "verified", extra_admin_note: reason }, "Balance approved")}>Approve</Button>
            <Button size="sm" variant="destructive" onClick={() => update({ extra_payment_status: "rejected", extra_admin_note: reason }, "Balance rejected")}>Reject</Button>
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" className="justify-self-start text-destructive" onClick={del}><Trash2 className="mr-1 h-4 w-4" />Delete booking</Button>
    </>
  );
}

function CustomersTab() {
  const qc = useQueryClient();
  const { data: people = [] } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["admin-banks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("created_at");
      if (error) throw error;
      return data as BankAccount[];
    },
  });
  const save = async (p: Profile, patch: { allow_bank: boolean; allow_wallet: boolean; bank_account_id: string | null }) => {
    const { error } = await supabase.rpc("admin_update_customer", { p_user: p.id, p_allow_bank: patch.allow_bank, p_allow_wallet: patch.allow_wallet, p_bank: patch.bank_account_id });
    if (error) { toast.error(error.message); return; }
    toast.success("Customer updated");
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };
  return (
    <div className="space-y-3">
      {people.map((p) => (
        <CustomerRow key={p.id} person={p} banks={banks} onSave={(patch) => save(p, patch)} />
      ))}
    </div>
  );
}

function CustomerRow({ person, banks, onSave }: { person: Profile; banks: BankAccount[]; onSave: (p: { allow_bank: boolean; allow_wallet: boolean; bank_account_id: string | null }) => void }) {
  const [allowBank, setAllowBank] = useState(person.allow_bank);
  const [allowWallet, setAllowWallet] = useState(person.allow_wallet);
  const [bankId, setBankId] = useState(person.bank_account_id ?? "");
  const [delta, setDelta] = useState("");
  const qc = useQueryClient();
  const adjust = async () => {
    const n = Number(delta);
    if (!n) return;
    const { error } = await supabase.rpc("admin_adjust_wallet", { p_user: person.id, p_delta: n });
    if (error) { toast.error(error.message); return; }
    setDelta("");
    toast.success("Wallet updated");
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-2">
      <div>
        <p className="font-semibold">{person.full_name || "No name"} <span className="font-mono text-xs text-muted-foreground">{person.user_code}</span></p>
        <p className="text-sm">Mobile: {person.phone || "—"}</p>
        <p className="text-sm">City: {person.city || "—"}</p>
        <p className="text-sm font-semibold text-rose-700">Wallet balance: {sar(Number(person.wallet_balance || 0))}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">Bank <Switch checked={allowBank} onCheckedChange={setAllowBank} /></label>
        <label className="flex items-center gap-2">Wallet <Switch checked={allowWallet} onCheckedChange={setAllowWallet} /></label>
        <select value={bankId} onChange={(e) => setBankId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">No bank</option>
          {banks.map((b) => <option key={b.id} value={b.id}>{b.account_name}</option>)}
        </select>
        <Button size="sm" onClick={() => onSave({ allow_bank: allowBank, allow_wallet: allowWallet, bank_account_id: bankId || null })}>Save</Button>
        <Input className="w-24" placeholder="+/- SAR" value={delta} onChange={(e) => setDelta(e.target.value)} />
        <Button size="sm" variant="outline" onClick={adjust}>Adjust wallet</Button>
      </div>
      <ContactFields person={person} />
    </div>
  );
}

function ContactFields({ person }: { person: Profile }) {
  const qc = useQueryClient();
  const [on, setOn] = useState(!!person.contact_enabled);
  const [wa, setWa] = useState(person.assigned_whatsapp ?? "");
  const [addr, setAddr] = useState(person.assigned_address ?? "");
  const [map, setMap] = useState(person.assigned_map_url ?? "");
  const [query, setQuery] = useState(person.assigned_address ?? "");
  const save = async () => {
    const { error } = await supabase.rpc("admin_set_contact", { p_user: person.id, p_enabled: on, p_whatsapp: wa, p_address: addr, p_map: map });
    if (error) { toast.error(error.message); return; }
    toast.success(on ? "Location and WhatsApp shown to this customer" : "Location and WhatsApp hidden");
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };
  return (
    <div className="space-y-2 md:col-span-2">
      <label className="flex items-center gap-2 text-sm">Show location and WhatsApp <Switch checked={on} onCheckedChange={setOn} /></label>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="WhatsApp number" value={wa} onChange={(e) => setWa(e.target.value)} />
        <Input placeholder="Location address" value={addr} onChange={(e) => setAddr(e.target.value)} />
        <Input placeholder="Google Maps link" value={map} onChange={(e) => setMap(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-sm" placeholder="Search a city or salon on the map" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="button" size="sm" variant="outline" onClick={() => { setAddr(query); setMap(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`); }}>Use this location</Button>
      </div>
      {query && <iframe title="Map search" className="h-52 w-full rounded-2xl border border-rose-100" src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`} />}
      <Button size="sm" variant="outline" onClick={save}>Save location</Button>
    </div>
  );
}

function BanksTab() {
  const qc = useQueryClient();
  const blank = { account_name: "", bank_name: "", account_holder: "", account_number: "", iban: "", qr_url: null as string | null, active: true };
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["admin-banks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("created_at");
      if (error) throw error;
      return data as BankAccount[];
    },
  });
  const save = async () => {
    if (!edit?.account_name || !edit.iban || !edit.account_holder) { toast.error("Name, holder and IBAN are required"); return; }
    let qr_url = edit.qr_url;
    if (file) {
      const path = `banks/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "")}`;
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) { toast.error(error.message); return; }
      qr_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    }
    const row = { account_name: edit.account_name, bank_name: edit.bank_name, account_holder: edit.account_holder, account_number: edit.account_number, iban: edit.iban, qr_url, active: edit.active };
    const { error } = edit.id ? await supabase.from("bank_accounts").update(row).eq("id", edit.id) : await supabase.from("bank_accounts").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success("Bank saved");
    setEdit(null); setFile(null);
    qc.invalidateQueries({ queryKey: ["admin-banks"] });
  };
  return (
    <div className="space-y-3">
      <Button className="rounded-full" onClick={() => setEdit({ ...blank })}><Plus className="mr-1 h-4 w-4" />Add bank account</Button>
      {data.map((b) => (
        <div key={b.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div>
            <p className="font-semibold">{b.account_name} {!b.active && <span className="text-xs text-destructive">Disabled</span>}</p>
            <p className="text-xs text-muted-foreground">{b.account_holder} · {b.iban}</p>
            {mediaUrl(b.qr_url) && <img src={mediaUrl(b.qr_url)} alt="QR" className="mt-2 h-20 w-20 rounded-lg bg-white object-contain" />}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEdit(b)}>Edit</Button>
        </div>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          {edit && (
            <div className="space-y-3">
              <DialogHeader><DialogTitle>{edit.id ? "Edit bank" : "New bank"}</DialogTitle></DialogHeader>
              {(["account_name", "bank_name", "account_holder", "account_number", "iban"] as const).map((k) => (
                <div key={k}><Label className="capitalize">{k.replace("_", " ")}</Label><Input value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></div>
              ))}
              <div><Label>QR code</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              <label className="flex items-center gap-2 text-sm">Active <Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /></label>
              <Button className="w-full" onClick={save}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WalletTab() {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["admin-topups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallet_topups").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Topup[];
    },
  });
  const review = async (t: Topup, approve: boolean) => {
    const { error } = await supabase.rpc("review_topup", { p_id: t.id, p_approve: approve, p_amount: Number(amount || t.amount), p_reason: reason });
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Wallet credited" : "PIN rejected");
    setReason("");
    qc.invalidateQueries({ queryKey: ["admin-topups"] });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">The PIN is sent to the Telegram group and can be copied here.</p>
      {data.map((t) => (
        <div key={t.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
          <div className="flex justify-between"><p className="font-mono">{t.ref} · {t.user_code}</p><StatusBadge status={t.status} /></div>
          <div className="mt-1 flex items-center gap-2">
            <p className="font-mono text-base">PIN {t.pin}</p>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(t.pin); toast.success("PIN copied"); }}>Copy PIN</Button>
          </div>
          <p>{t.amount} SAR</p>
          {t.status === "pending" && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Input className="w-28" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input className="w-56" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button size="sm" onClick={() => review(t, true)}>Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => review(t, false)}>Reject</Button>
            </div>
          )}
          {t.reason && <p className="mt-1 text-muted-foreground">{t.reason}</p>}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Services ---------------- */
const blank: Omit<Service, "id"> = { name: "", category: "Haircuts", description: "", price: 0, duration_min: 30, image_url: null, popular: false, active: true, sort: 0 };

function ServicesTab() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<(Omit<Service, "id"> & { id?: string }) | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("sort");
      if (error) throw error;
      return data as Service[];
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-services"] }); qc.invalidateQueries({ queryKey: ["services"] }); };

  const save = async () => {
    if (!edit || !edit.name.trim()) { toast.error("Name is required"); return; }
    let image_url = edit.image_url;
    if (file) {
      const path = `services/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "")}`;
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) { toast.error(error.message); return; }
      image_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    }
    const { id, ...row } = { ...edit, image_url, price: Number(edit.price), duration_min: Number(edit.duration_min), sort: Number(edit.sort) };
    const { error } = id ? await supabase.from("services").update(row).eq("id", id) : await supabase.from("services").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEdit(null); setFile(null); setPreview(null); refresh();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  return (
    <div className="space-y-4">
      <Button className="rounded-full" onClick={() => setEdit({ ...blank })}><Plus className="mr-1 h-4 w-4" />Add service</Button>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
            <img src={serviceImage(s)} alt={s.name} className="mb-3 h-32 w-full rounded-xl object-cover" />
            <div className="flex justify-between gap-2">
              <div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.category} · {sar(s.price)} · {s.duration_min} min</p></div>
              {!s.active && <span className="text-xs text-destructive">Hidden</span>}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit({ ...s, price: Number(s.price) })}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(s.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          {edit && (
            <div className="space-y-3">
              <DialogHeader><DialogTitle>{edit.id ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
              <div><Label>Name</Label><Input value={edit.name} maxLength={80} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><Label>Category</Label>
                <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><Label>Description</Label><Textarea value={edit.description ?? ""} maxLength={300} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Price (SAR)</Label><Input type="number" min={0} value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></div>
                <div><Label>Minutes</Label><Input type="number" min={5} value={edit.duration_min} onChange={(e) => setEdit({ ...edit, duration_min: Number(e.target.value) })} /></div>
                <div><Label>Order</Label><Input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></div>
              </div>
              <div>
                <Label>Photo</Label>
                <img src={preview || serviceImage(edit)} alt="" className="mb-2 h-32 w-full rounded-xl object-cover" />
                <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPreview(f ? URL.createObjectURL(f) : null); }} />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={edit.popular} onCheckedChange={(v) => setEdit({ ...edit, popular: v })} />Popular — shows HOT 🔥</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />Visible</label>
              </div>
              <Button className="w-full" onClick={save}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [s, setS] = useState<Settings | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const cur = s ?? data ?? DEFAULT_SETTINGS;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...cur, [k]: v });
  const save = async () => {
    let logo_url = cur.logo_url;
    if (logoFile) {
      const path = `logo/${Date.now()}-${logoFile.name.replace(/[^a-z0-9.]/gi, "")}`;
      const up = await supabase.storage.from("media").upload(path, logoFile);
      if (up.error) { toast.error(up.error.message); return; }
      logo_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("settings").update({ ...cur, logo_url, advance_percent: Number(cur.advance_percent), slot_minutes: Number(cur.slot_minutes), updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved");
    setS(null);
    qc.invalidateQueries({ queryKey: ["settings"] });
  };
  const text = (k: keyof Settings, l: string, type = "text") => (
    <div><Label>{l}</Label><Input type={type} value={String(cur[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} /></div>
  );
  const toggle = (k: "bank_enabled" | "stc_enabled" | "bookings_full", l: string) => (
    <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"><span>{l}</span><Switch checked={cur[k]} onCheckedChange={(v) => set(k, v)} /></label>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">Booking & payment switches</h3>
        {toggle("bookings_full", "Bookings full (too many customers)")}
        {text("full_message", "Message shown when full")}
        {toggle("bank_enabled", "Bank transfer enabled")}
        {toggle("stc_enabled", "Wallet recharge (STC Sawa) enabled")}
        {text("advance_percent", "Advance %", "number")}
        <div className="grid grid-cols-3 gap-2">{text("open_time", "Opens", "time")}{text("close_time", "Closes", "time")}{text("slot_minutes", "Slot (min)", "number")}</div>
      </section>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">Bank details</h3>
        {text("bank_name", "Bank name")}{text("account_holder", "Account holder")}{text("account_number", "Account number")}{text("iban", "IBAN")}{text("bank_qr_url", "QR image URL (optional)")}
      </section>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 lg:col-span-2">
        <h3 className="font-semibold">Salon info</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("salon_name", "Salon name")}{text("tagline", "Tagline")}{text("phone", "Phone")}{text("whatsapp", "WhatsApp number (e.g. 9665…)")}{text("address", "Address")}{text("map_url", "Google Maps link")}
          <div className="sm:col-span-2">
            <Label>Website logo</Label>
            <img src={logoFile ? URL.createObjectURL(logoFile) : (cur.logo_url || "/images/logo.png")} alt="" className="mt-2 h-16 w-auto" />
            <Input className="mt-2" type="file" accept="image/*" onChange={(e) => { setLogoFile(e.target.files?.[0] ?? null); setS({ ...cur }); }} />
          </div>
        </div>
      </section>
      <Button className="lg:col-span-2" onClick={save} disabled={!s}>Save settings</Button>
    </div>
  );
}

function SlidersTab() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [title, setTitle] = useState("");
  const { data: services = [] } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").order("sort");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-sliders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("homepage_sliders").select("*").order("sort");
      if (error) throw error;
      return data as { id: string; image_url: string; service_id: string | null; title: string | null; active: boolean }[];
    },
  });
  const add = async () => {
    if (!file) { toast.error("Choose a slider image"); return; }
    const path = `sliders/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "")}`;
    const up = await supabase.storage.from("media").upload(path, file);
    if (up.error) { toast.error(up.error.message); return; }
    const image_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("homepage_sliders").insert({ image_url, service_id: serviceId || null, title: title || null, sort: rows.length });
    if (error) { toast.error(error.message); return; }
    setFile(null); setTitle(""); setServiceId("");
    toast.success("Slider added");
    qc.invalidateQueries({ queryKey: ["admin-sliders"] });
    qc.invalidateQueries({ queryKey: ["sliders"] });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("homepage_sliders").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-sliders"] });
    qc.invalidateQueries({ queryKey: ["sliders"] });
  };
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-rose-100 bg-white p-4">
        <h3 className="font-semibold">Add slider</h3>
        <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">No service link</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button className="rounded-full" onClick={add}>Add slider</Button>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-white p-3">
          <img src={mediaUrl(r.image_url)} alt="" className="h-16 w-28 rounded-xl object-cover" />
          <div className="flex-1 text-sm"><p className="font-semibold">{r.title || "Slider"}</p><p className="text-muted-foreground">{services.find((s) => s.id === r.service_id)?.name || "No service link"}</p></div>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}>Remove</Button>
        </div>
      ))}
    </div>
  );
}

function WithdrawalsTab() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallet_withdrawals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; user_code: string | null; amount: number; account_name: string; account_number: string; iban: string; status: string; created_at: string }[];
    },
  });
  const review = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("review_withdrawal", { p_id: id, p_approve: approve, p_reason: approve ? "Approved" : "Rejected" });
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Withdrawal approved" : "Withdrawal rejected");
    qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };
  return (
    <div className="space-y-3">
      {data.length === 0 && <p className="text-sm text-muted-foreground">No withdrawal requests.</p>}
      {data.map((w) => (
        <div key={w.id} className="rounded-2xl border border-rose-100 bg-white p-4 text-sm">
          <div className="flex justify-between"><p className="font-semibold">{w.user_code} · {sar(Number(w.amount))}</p><StatusBadge status={w.status} /></div>
          <p>Account name: {w.account_name}</p>
          <p>Account number: {w.account_number}</p>
          <p>IBAN: {w.iban}</p>
          {w.status === "pending" && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => review(w.id, true)}>Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => review(w.id, false)}>Reject</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Support ---------------- */
function SupportTab() {
  const [sel, setSel] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["admin-convos"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_messages").select("user_id, body, sender, created_at").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      const seen = new Map<string, { user_id: string; body: string; sender: string; created_at: string }>();
      for (const m of data) if (!seen.has(m.user_id)) seen.set(m.user_id, m);
      const ids = [...seen.keys()];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids) : { data: [] };
      return [...seen.values()].map((m) => ({ ...m, name: profs?.find((p) => p.id === m.user_id)?.full_name ?? "Customer", phone: profs?.find((p) => p.id === m.user_id)?.phone ?? "" }));
    },
  });
  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No conversations yet.</p>}
        {data.map((c) => (
          <button key={c.user_id} onClick={() => setSel(c.user_id)} className={cn("w-full rounded-2xl border p-3 text-left", sel === c.user_id ? "border-primary bg-secondary" : "border-border bg-card")}>
            <p className="font-semibold">{c.name} <span className="text-xs font-normal text-muted-foreground">{c.phone}</span></p>
            <p className="truncate text-xs text-muted-foreground">{c.sender === "user" ? "● " : "You: "}{c.body}</p>
          </button>
        ))}
      </div>
      {sel ? <ChatThread userId={sel} as="admin" /> : <EmptyState title="Select a conversation" />}
    </div>
  );
}

/* ---------------- Telegram ---------------- */
function TelegramTab() {
  const { data = [] } = useQuery({
    queryKey: ["tg-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("telegram_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as { id: string; event: string; message: string; status: string; created_at: string }[];
    },
  });
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">"Skipped" means the Telegram bot keys are not added yet.</p>
      {data.map((l) => (
        <div key={l.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
          <div><p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()} · {l.event}</p><p className="whitespace-pre-wrap">{l.message}</p></div>
          <StatusBadge status={l.status} />
        </div>
      ))}
    </div>
  );
}
