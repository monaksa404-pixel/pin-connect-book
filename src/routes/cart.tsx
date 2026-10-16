import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, MapPin, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { advanceFor, DEFAULT_SETTINGS, sar, serviceImage, servicesQuery, settingsQuery } from "@/lib/data";
import { FullNotice } from "@/components/FullNotice";
import { Button } from "@/components/ui/button";

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
  const { lines, setQty, remove, clear, total, add, setSlot } = useCart();
  const navigate = useNavigate();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { data: services = [] } = useQuery(servicesQuery);
  const { advance, remaining } = advanceFor(total, settings.advance_percent);
  const [fullOpen, setFullOpen] = useState(false);
  const extra = services.filter((s) => !lines.some((l) => l.service.id === s.id)).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#fff0f6] px-4 pb-28 pt-4 md:pb-10">
      <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
      <div className="mx-auto max-w-3xl">
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
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[#9a5b78]">Total Amount ({lines.reduce((n, l) => n + l.qty, 0)} items)</p>
                <p className="font-display text-3xl font-semibold text-[#ff4d94]">{sar(total)}</p>
              </div>
              <div className="rounded-2xl bg-[#fff0f6] p-3">
                <p className="text-lg font-semibold text-[#ff4d94]">{sar(advance)}</p>
                <p className="text-xs font-semibold text-[#5c2344]">Advance Payment</p>
                <p className="text-[11px] text-[#9a5b78]">Pay now ({settings.advance_percent}%)</p>
              </div>
              <div className="rounded-2xl bg-[#fff0f6] p-3">
                <p className="text-lg font-semibold text-[#ff4d94]">{sar(remaining)}</p>
                <p className="text-xs font-semibold text-[#5c2344]">Cash at Salon</p>
                <p className="text-[11px] text-[#9a5b78]">Pay the rest at the salon after the service</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (settings.bookings_full) { setFullOpen(true); return; }
                const day = new Date();
                setSlot({ date: day.toISOString().slice(0, 10), time: settings.open_time.slice(0, 5) });
                navigate({ to: "/checkout" });
              }}
              className="mt-4 h-12 w-full rounded-full bg-[#ff4d94] font-semibold text-white"
            >
              Proceed to Checkout →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
