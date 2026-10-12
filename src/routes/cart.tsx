import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { advanceFor, DEFAULT_SETTINGS, sar, serviceImage, settingsQuery } from "@/lib/data";
import { EmptyState, PageHeader, Steps } from "@/components/shared";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Maison Rosé" },
      { name: "description", content: "Review your selected salon services before booking." },
      { property: "og:title", content: "Your Cart — Maison Rosé" },
      { property: "og:description", content: "Review your selected salon services before booking." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { lines, setQty, remove, total } = useCart();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { advance, remaining } = advanceFor(total, settings.advance_percent);

  return (
    <>
      <PageHeader eyebrow="Step 2" title="Your cart" />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Steps current={1} />
        {lines.length === 0 ? (
          <EmptyState title="Your cart is empty">
            <Button asChild className="mt-4 rounded-full"><Link to="/services">Browse services</Link></Button>
          </EmptyState>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <ul className="space-y-3">
              {lines.map(({ service: s, qty }) => (
                <li key={s.id} className="flex items-center gap-4 rounded-3xl border border-border bg-card p-3">
                  <img src={serviceImage(s)} alt={s.name} className="h-20 w-20 rounded-2xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{sar(s.price)} · {s.duration_min} min</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-7 w-7 rounded-full" onClick={() => setQty(s.id, qty - 1)} aria-label="Decrease"><Minus className="h-3 w-3" /></Button>
                      <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7 rounded-full" onClick={() => setQty(s.id, qty + 1)} aria-label="Increase"><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{sar(s.price * qty)}</p>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)} aria-label="Remove"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="h-fit space-y-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
              <Row k="Total" v={sar(total)} bold />
              <Row k={`Pay now (${settings.advance_percent}%)`} v={sar(advance)} />
              <Row k="Pay at salon (cash)" v={sar(remaining)} />
              {settings.bookings_full ? (
                <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{settings.full_message}</p>
              ) : (
                <Button asChild className="h-12 w-full rounded-full"><Link to="/book">Choose date & time</Link></Button>
              )}
              <Button asChild variant="ghost" className="w-full rounded-full"><Link to="/services">Add more services</Link></Button>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={bold ? "text-lg font-semibold" : "font-medium"}>{v}</span>
    </div>
  );
}
