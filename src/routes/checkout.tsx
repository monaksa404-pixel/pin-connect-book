import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { advanceFor, DEFAULT_SETTINGS, fmtTime, sar, settingsQuery } from "@/lib/data";
import { supabase, friendlyError } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";
import { EmptyState, PageHeader, RequireAuth, Steps } from "@/components/shared";
import { PaymentForm, type PaymentResult } from "@/components/PaymentForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Details & Payment — Maison Rosé" },
      { name: "description", content: "Enter your details and pay the advance to confirm your booking." },
      { property: "og:title", content: "Details & Payment — Maison Rosé" },
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

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone, city").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setName(data.full_name ?? ""); setPhone(data.phone ?? ""); setCity(data.city ?? ""); }
    });
  }, [user]);

  if (!lines.length || !slot)
    return <div className="mx-auto max-w-xl px-4 py-16"><EmptyState title="Nothing to book yet"><Button asChild className="mt-4 rounded-full"><Link to="/services">Browse services</Link></Button></EmptyState></div>;
  if (settings.bookings_full)
    return <div className="mx-auto max-w-xl px-4 py-16"><EmptyState title="Bookings unavailable">{settings.full_message}</EmptyState></div>;

  const { advance, remaining } = advanceFor(total, settings.advance_percent);

  const onSubmit = async (p: PaymentResult) => {
    if (name.trim().length < 2) throw new Error("Please enter your name.");
    if (!/^[+0-9 ]{8,16}$/.test(phone.trim())) throw new Error("Please enter a valid phone number.");
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
        payment_method: p.method,
        screenshot_path: p.screenshotPath,
      })
      .select("code, advance_amount, user_code")
      .single();
    if (error) throw new Error(friendlyError(error));
    await supabase.from("profiles").update({ full_name: name.trim(), phone: phone.trim(), city: city.trim() || null }).eq("id", user!.id);
    await sendAlert(
      "new_booking",
      `New booking ${data.code}\nUser ${data.user_code ?? ""}\n${name} (${phone})\n${slot.date} ${fmtTime(slot.time)}\nAdvance ${sar(Number(data.advance_amount))} via ${p.method}`,
    );
    clear();
    toast.success(`Booking ${data.code} submitted!`);
    navigate({ to: "/my-bookings" });
  };

  return (
    <>
      <PageHeader eyebrow="Step 4" title="Details & payment" />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Steps current={3} />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-2xl font-semibold">Your details</h2>
              <div><Label htmlFor="n">Full name</Label><Input id="n" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="p">Phone</Label><Input id="p" value={phone} maxLength={16} inputMode="tel" placeholder="05xxxxxxxx" onChange={(e) => setPhone(e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="c">City (optional)</Label><Input id="c" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="no">Notes (optional)</Label><Textarea id="no" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className="mt-1" /></div>
            </div>
            <div className="space-y-2 rounded-3xl border border-border bg-card p-6 text-sm shadow-soft">
              <h2 className="mb-2 font-display text-2xl font-semibold">Summary</h2>
              <p className="text-muted-foreground">{slot.date} at {fmtTime(slot.time)}</p>
              {lines.map((l) => (
                <div key={l.service.id} className="flex justify-between"><span>{l.service.name} × {l.qty}</span><span>{sar(l.service.price * l.qty)}</span></div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span>{sar(total)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Pay at salon (cash)</span><span>{sar(remaining)}</span></div>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <PaymentForm settings={settings} amount={advance} userId={user!.id} submitLabel="Confirm booking" onSubmit={onSubmit} />
          </div>
        </div>
      </div>
    </>
  );
}
