import { createFileRoute, Link } from "@tanstack/react-router";
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
  const { lines, setQty, remove, clear, total, slot, add } = useCart();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { data: services = [] } = useQuery(servicesQuery);
  const { advance, remaining } = advanceFor(total, settings.advance_percent);
  const [fullOpen, setFullOpen] = useState(false);
  const extra = services.filter((s) => !lines.some((l) => l.service.id === s.id)).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#ffd6e8] px-4 pb-28 pt-4 md:pb-10">
      <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-semibold text-rose-950">My Cart</h1>
            <p className="text-rose-900/60">Review your selected services</p>
          </div>
          {lines.length > 0 && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700">
              <Trash2 className="h-4 w-4" /> Clear Cart
            </button>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center text-rose-900/70">
            <p>Your cart is empty.</p>
            <Button asChild className="mt-4 rounded-full bg-rose-600"><Link to="/services">Browse services</Link></Button>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {lines.map(({ service: s, qty }) => (
              <li key={s.id} className="rounded-3xl bg-white p-3 shadow-sm">
                <div className="flex gap-3">
                  <img src={serviceImage(s)} alt={s.name} className="h-24 w-24 rounded-2xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <p className="font-semibold text-rose-950">{s.name}</p>
                      <button type="button" onClick={() => remove(s.id)} aria-label="Remove"><Trash2 className="h-4 w-4 text-rose-300" /></button>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-rose-900/60"><Clock className="h-3.5 w-3.5" />{s.duration_min} min</p>
                    <p className="text-xs text-rose-900/60">{s.category}</p>
                    {slot && <p className="text-xs text-rose-900/60">{slot.date}</p>}
                    <p className="flex items-center gap-1 text-xs text-rose-900/60"><MapPin className="h-3.5 w-3.5" />{settings.salon_name}</p>
                  </div>
                  <p className="self-center font-semibold text-rose-600">{sar(s.price * qty)}</p>
                </div>
                <div className="mt-3 flex items-center justify-center gap-4">
                  <button type="button" onClick={() => setQty(s.id, qty - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-rose-200 text-rose-600" aria-label="Decrease"><Minus className="h-4 w-4" /></button>
                  <span className="w-6 text-center font-semibold">{qty}</span>
                  <button type="button" onClick={() => setQty(s.id, qty + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-rose-600 text-white" aria-label="Increase"><Plus className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {extra.length > 0 && (
          <section className="mt-6">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-2xl font-semibold text-rose-950">You May Also Like</h2>
              <Link to="/services" className="text-sm font-semibold text-rose-600">View All &gt;</Link>
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto">
              {extra.map((s) => (
                <div key={s.id} className="w-36 shrink-0">
                  <img src={serviceImage(s)} alt={s.name} className="aspect-square w-full rounded-2xl object-cover" />
                  <p className="mt-2 text-sm font-semibold text-rose-950">{s.name}</p>
                  <p className="text-xs text-rose-700">{sar(s.price)}</p>
                  <button type="button" onClick={() => add(s)} className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white"><ShoppingCart className="h-3.5 w-3.5" /> Add</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {lines.length > 0 && (
          <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-rose-600">Price Summary</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span>Total</span><span className="font-semibold">{sar(total)}</span></div>
              <div className="flex justify-between"><span>Pay now ({settings.advance_percent}%)</span><span className="font-semibold">{sar(advance)}</span></div>
              <div className="flex justify-between"><span>Pay at salon (cash)</span><span className="font-semibold">{sar(remaining)}</span></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-rose-50 p-3">
              <div><p className="font-semibold text-rose-600">Remaining amount</p><p className="text-xs text-rose-900/60">You will pay at the salon</p></div>
              <p className="text-xl font-semibold text-rose-600">{sar(remaining)}</p>
            </div>
            {settings.bookings_full ? (
              <button type="button" onClick={() => setFullOpen(true)} className="mt-4 h-12 w-full rounded-full bg-rose-600 font-semibold text-white">Choose date & time →</button>
            ) : (
              <Link to="/book" className="mt-4 grid h-12 place-items-center rounded-full bg-rose-600 font-semibold text-white">Choose date & time →</Link>
            )}
            <Link to="/services" className="mt-3 grid h-12 place-items-center rounded-full border border-rose-200 font-semibold text-rose-600">+ Add more services</Link>
          </div>
        )}
      </div>
    </div>
  );
}
