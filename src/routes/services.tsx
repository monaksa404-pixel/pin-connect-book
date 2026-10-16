import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, DEFAULT_SETTINGS, sar, serviceImage, servicesQuery, settingsQuery } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { PageHeader, Steps } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FullNotice } from "@/components/FullNotice";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/services")({
  validateSearch: (s: Record<string, unknown>): { category?: string | undefined } => ({
    category: typeof s["category"] === "string" ? (s["category"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Services & Prices — The Beauty House" },
      { name: "description", content: "Haircuts, beard, facial and massage services with prices in SAR." },
      { property: "og:title", content: "Services & Prices — The Beauty House" },
      { property: "og:description", content: "Browse salon services and add them to your booking." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { category } = Route.useSearch();
  const { data: services = [], isLoading } = useQuery(servicesQuery);
  const { lines, add, setQty, count, total } = useCart();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const [fullOpen, setFullOpen] = useState(false);
  const addService = (s: (typeof services)[number]) => {
    if (settings.bookings_full) { setFullOpen(true); return; }
    add(s);
    toast.success(`${s.name} added`);
  };
  const active = category ?? "All";
  const list = active === "All" ? services : services.filter((s) => s.category === active);

  return (
    <>
      <PageHeader eyebrow="Menu" title="Services & prices">Pick one or more services, then continue to your cart.</PageHeader>
      <div className="mx-auto max-w-6xl px-4 py-10 pb-32">
        <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
        <Steps current={0} />
        <div className="mb-8 flex gap-2 overflow-x-auto pb-1">
          {["All", ...CATEGORIES].map((c) => (
            <Link
              key={c}
              to="/services"
              search={c === "All" ? {} : { category: c }}
              className={cn(
                "shrink-0 rounded-full border px-5 py-2 text-sm font-medium transition",
                active === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
              )}
            >
              {c}
            </Link>
          ))}
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Loading services…</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => {
              const qty = lines.find((l) => l.service.id === s.id)?.qty ?? 0;
              return (
                <div key={s.id} className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
                  <img src={serviceImage(s)} alt={s.name} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">{s.category}</p>
                    <h3 className="mt-1 font-display text-xl font-semibold">{s.name}</h3>
                    <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{sar(s.price)}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{s.duration_min} min</p>
                      </div>
                      {qty === 0 ? (
                        <Button className="rounded-full" onClick={() => addService(s)}>Add to cart</Button>
                      ) : (
                        <div className="flex items-center gap-2 rounded-full border border-border p-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setQty(s.id, qty - 1)} aria-label="Decrease"><Minus className="h-4 w-4" /></Button>
                          <span className="w-5 text-center font-semibold">{qty}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setQty(s.id, qty + 1)} aria-label="Increase"><Plus className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span className="text-sm"><strong>{count}</strong> item{count > 1 ? "s" : ""} · <strong>{sar(total)}</strong></span>
            </div>
            <Button asChild className="rounded-full px-6"><Link to="/cart">View cart</Link></Button>
          </div>
        </div>
      )}
    </>
  );
}
