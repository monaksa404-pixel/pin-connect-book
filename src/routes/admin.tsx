import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, DEFAULT_SETTINGS, fmtTime, sar, settingsQuery } from "@/lib/data";
import type { Booking, Service, Settings } from "@/lib/types";
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
      { title: "Admin Panel — Maison Rosé" },
      { name: "description", content: "Manage bookings, payments, services and settings." },
      { property: "og:title", content: "Admin Panel — Maison Rosé" },
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
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-semibold">Admin panel</h1>
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Back to site</Link></Button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs defaultValue="bookings">
          <TabsList className="mb-6 flex h-auto flex-wrap justify-start">
            {["bookings", "services", "settings", "support", "telegram"].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="bookings"><BookingsTab /></TabsContent>
          <TabsContent value="services"><ServicesTab /></TabsContent>
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
    if (error) return toast.error(error.message);
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
  const update = async (patch: Partial<Booking>, msg: string) => {
    const { error } = await supabase.from("bookings").update(patch).eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
  };
  const del = async () => {
    if (!confirm("Delete this booking permanently?")) return;
    const { error } = await supabase.from("bookings").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
  };

  return (
    <>
      <DialogHeader><DialogTitle className="font-display text-2xl">Booking {b.code}</DialogTitle></DialogHeader>
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
          <div className="flex gap-2">
            <Button size="sm" onClick={() => update({ payment_status: "verified", status: "confirmed" }, "Payment approved")}>Approve</Button>
            <Button size="sm" variant="destructive" onClick={() => update({ payment_status: "rejected" }, "Payment rejected")}>Reject</Button>
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
            <Button size="sm" onClick={() => update({ extra_payment_status: "verified" }, "Balance approved")}>Approve</Button>
            <Button size="sm" variant="destructive" onClick={() => update({ extra_payment_status: "rejected" }, "Balance rejected")}>Reject</Button>
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" className="justify-self-start text-destructive" onClick={del}><Trash2 className="mr-1 h-4 w-4" />Delete booking</Button>
    </>
  );
}

/* ---------------- Services ---------------- */
const blank: Omit<Service, "id"> = { name: "", category: "Haircuts", description: "", price: 0, duration_min: 30, image_url: null, popular: false, active: true, sort: 0 };

function ServicesTab() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<(Omit<Service, "id"> & { id?: string }) | null>(null);
  const [file, setFile] = useState<File | null>(null);
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
    if (!edit || !edit.name.trim()) return toast.error("Name is required");
    let image_url = edit.image_url;
    if (file) {
      const path = `services/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "")}`;
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) return toast.error(error.message);
      image_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    }
    const { id, ...row } = { ...edit, image_url, price: Number(edit.price), duration_min: Number(edit.duration_min), sort: Number(edit.sort) };
    const { error } = id ? await supabase.from("services").update(row).eq("id", id) : await supabase.from("services").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEdit(null); setFile(null); refresh();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="space-y-4">
      <Button className="rounded-full" onClick={() => setEdit({ ...blank })}><Plus className="mr-1 h-4 w-4" />Add service</Button>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
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
              <div><Label>Photo</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={edit.popular} onCheckedChange={(v) => setEdit({ ...edit, popular: v })} />Popular</label>
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
  const cur = s ?? data ?? DEFAULT_SETTINGS;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...cur, [k]: v });
  const save = async () => {
    const { error } = await supabase.from("settings").update({ ...cur, advance_percent: Number(cur.advance_percent), slot_minutes: Number(cur.slot_minutes), updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message);
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
        {toggle("stc_enabled", "STC Sawa voucher enabled")}
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
        </div>
      </section>
      <Button className="lg:col-span-2" onClick={save} disabled={!s}>Save settings</Button>
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
