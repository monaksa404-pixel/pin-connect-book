import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, startOfToday } from "date-fns";
import { CalendarDays, Clock, MapPin, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { advanceFor, DEFAULT_SETTINGS, fmtTime, sar, serviceImage, servicesQuery, settingsQuery, timeSlots } from "@/lib/data";
import { FullNotice } from "@/components/FullNotice";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "My Cart — The Beauty House" },
      { name: "description", content: "Review your selected services." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { lines, setQty, remove, clear, total, add, setSlot, slot } = useCart();
  const navigate = useNavigate();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { data: services = [] } = useQuery(servicesQuery);
  const { advance, remaining } = advanceFor(total, settings.advance_percent);
  const [fullOpen, setFullOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(slot ? new Date(slot.date + "T00:00") : new Date());
  const [time, setTime] = useState<string | null>(slot?.time ?? null);
  const slots = useMemo(() => {
    const all = timeSlots(settings.open_time.slice(0, 5), settings.close_time.slice(0, 5), settings.slot_minutes);
    if (!date || format(date, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd")) return all;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return all.filter((t) => {
      const [h = 0, m = 0] = t.split(":").map(Number);
      return h * 60 + m > nowMin;
    });
  }, [date, settings]);
  const extra = services.filter((s) => !lines.some((l) => l.service.id === s.id)).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#fff0f6] px-4 pb-28 pt-4 md:pb-10">
      <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
      <div className="mx-auto max-w-3xl">
        <ol className="mb-4 flex items-center justify-between text-[11px] font-semibold text-[#9a5b78]">
          {["Services", "Your Cart", "Date & Time", "Details"].map((label, i) => (
            <li key={label} className="flex flex-1 flex-col items-center gap-1">
              <span className={`grid h-8 w-8 place-items-center rounded-full ${i <= 1 ? "bg-[#ff4d94] text-white" : "bg-white text-[#9a5b78]"}`}>{i < 1 ? "✓" : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-semibold text-[#5c2344]">My Cart</h1>
            <p className="text-[#9a5b78]">Review your selected services</p>
          </div>
          {lines.length > 0 && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-white px-3 py-2 text-sm font-semibold text-[#e23b86]">
              <Trash2 className="h-4 w-4" /> Clear Cart
            </button>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center text-rose-900/70">
            <p>Your cart is empty.</p>
            <Button asChild className="mt-4 rounded-full bg-[#ff4d94]"><Link to="/services">Browse services</Link></Button>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {lines.map(({ service: s, qty }) => (
              <li key={s.id} className="rounded-3xl bg-white p-3 shadow-sm">
                <div className="flex gap-3">
                  <img src={serviceImage(s)} alt={s.name} className="h-24 w-24 rounded-2xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <p className="font-semibold text-[#3d2030]">{s.name}</p>
                      <button type="button" onClick={() => remove(s.id)} aria-label="Remove"><Trash2 className="h-4 w-4 text-pink-300" /></button>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#9a5b78]"><Clock className="h-3.5 w-3.5 text-[#ff4d94]" />{s.duration_min} min</p>
                    <p className="text-xs text-[#9a5b78]">{s.category}</p>
                    <p className="flex items-center gap-1 text-xs text-[#9a5b78]"><MapPin className="h-3.5 w-3.5 text-[#ff4d94]" />{settings.salon_name}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <button type="button" onClick={() => setQty(s.id, qty - 1)} className="grid h-7 w-7 place-items-center rounded-full border border-pink-200 text-[#ff4d94]" aria-label="Decrease"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-4 text-center text-sm font-semibold">{qty}</span>
                      <button type="button" onClick={() => setQty(s.id, qty + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-[#ff4d94] text-white" aria-label="Increase"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <p className="self-start font-semibold text-[#ff4d94]">{sar(s.price * qty)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {extra.length > 0 && (
          <section className="mt-6">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-2xl font-semibold text-[#5c2344]">You May Also Like</h2>
              <Link to="/services" className="text-sm font-semibold text-[#ff4d94]">View All &gt;</Link>
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto">
              {extra.map((s) => (
                <div key={s.id} className="w-36 shrink-0 rounded-2xl bg-white p-2 shadow-sm">
                  <img src={serviceImage(s)} alt={s.name} className="aspect-square w-full rounded-xl object-cover" />
                  <p className="mt-2 text-sm font-semibold text-[#3d2030]">{s.name}</p>
                  <p className="text-xs font-semibold text-[#ff4d94]">{sar(s.price)}</p>
                  <button type="button" onClick={() => add(s)} className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#ff4d94] px-3 py-1 text-xs font-semibold text-white"><ShoppingCart className="h-3.5 w-3.5" /> Add</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {lines.length > 0 && (
          <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-[#ff4d94]">Price Summary</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span>Total</span><span className="font-semibold">{sar(total)}</span></div>
              <div className="flex justify-between"><span>Pay now ({settings.advance_percent}%)</span><span className="font-semibold">{sar(advance)}</span></div>
              <div className="flex justify-between"><span>Pay at salon (cash)</span><span className="font-semibold">{sar(remaining)}</span></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#ffe4f2] p-3">
              <div><p className="font-semibold text-[#ff4d94]">Remaining amount</p><p className="text-xs text-[#9a5b78]">You will pay at the salon</p></div>
              <p className="text-xl font-semibold text-[#ff4d94]">{sar(remaining)}</p>
            </div>
            <button type="button" onClick={() => settings.bookings_full ? setFullOpen(true) : setDateOpen(true)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff4d94] font-semibold text-white">
              <CalendarDays className="h-4 w-4" /> Choose date & time →
            </button>
            <Link to="/services" className="mt-3 grid h-12 place-items-center rounded-full border border-pink-200 font-semibold text-[#ff4d94]">+ Add more services</Link>
          </div>
        )}
      </div>
      {dateOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-pink-950/40 p-3 md:items-center">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-3xl font-semibold text-[#3d2030]">Choose <span className="text-[#ff4d94]">Date & Time</span></h2>
                <p className="text-sm text-[#9a5b78]">Select your preferred date and available time slot.</p>
              </div>
              <button type="button" onClick={() => setDateOpen(false)} className="text-2xl text-[#9a5b78]" aria-label="Close">×</button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-pink-100 p-3">
                <p className="mb-2 font-semibold text-[#3d2030]">Select Date</p>
                <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setTime(null); }} disabled={{ before: startOfToday() }} />
                <p className="mt-2 rounded-xl bg-[#ffe4f2] px-3 py-2 text-sm text-[#e23b86]">Today: {format(new Date(), "EEE, d MMM yyyy")}</p>
              </div>
              <div className="rounded-3xl border border-pink-100 p-3">
                <p className="font-semibold text-[#3d2030]">Select Time</p>
                <p className="text-xs text-[#9a5b78]">{date ? `Available time slots for ${format(date, "EEE, d MMM yyyy")}` : "Pick a date first"}</p>
                <div className="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
                  {slots.map((t) => (
                    <button key={t} type="button" onClick={() => setTime(t)} className={cn("rounded-full py-2 text-sm font-semibold", time === t ? "bg-[#ff4d94] text-white" : "bg-[#ffe4f2] text-[#e23b86]")}>{fmtTime(t)}</button>
                  ))}
                  {date && slots.length === 0 && <p className="col-span-2 text-sm text-[#9a5b78]">No times left today.</p>}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={!date || !time}
              onClick={() => {
                if (!date || !time) return;
                setSlot({ date: format(date, "yyyy-MM-dd"), time });
                setDateOpen(false);
                navigate({ to: "/checkout" });
              }}
              className="mt-4 h-12 w-full rounded-full bg-[#ff4d94] font-semibold text-white disabled:opacity-50"
            >
              Confirm Date & Time →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
