import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, MapPin, Sparkles, Star, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FullNotice } from "@/components/FullNotice";
import { CATEGORIES, categoryImage, fmtTime, sar, serviceImage, servicesQuery, settingsQuery, DEFAULT_SETTINGS } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Beauty House Salon" },
      { name: "description", content: "Book haircuts, beard, facial and massage at The Beauty House." },
      { property: "og:title", content: "The Beauty House — Luxury Salon Booking" },
      { property: "og:description", content: "Book haircuts, beard, facial and massage services online." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { data: services = [] } = useQuery(servicesQuery);
  const { add } = useCart();
  const [fullOpen, setFullOpen] = useState(false);
  const popular = services.filter((s) => s.popular).slice(0, 6);

  return (
    <>
      <section className="bg-gradient-to-b from-rose-100 via-pink-50 to-background">
        <div className="mx-auto max-w-5xl px-4 py-10 text-center">
          <img src="/images/logo.png" alt="The Beauty House" className="mx-auto h-28 w-auto" />
          <p className="mt-6 font-display text-5xl text-rose-700 sm:text-6xl">Look good. Feel amazing.</p>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Premium grooming. Pay {settings.advance_percent}% now and the rest at the salon.
          </p>
          <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-3 text-xs font-semibold uppercase tracking-wide text-rose-900">
            <span className="rounded-full bg-white/80 px-3 py-2">Premium services</span>
            <span className="rounded-full bg-white/80 px-3 py-2">Expert stylists</span>
            <span className="rounded-full bg-white/80 px-3 py-2">Clean and hygienic</span>
          </div>
          <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {CATEGORIES.map((c) => (
              <Link key={c} to="/services" search={{ category: c }} className="overflow-hidden rounded-3xl border border-rose-200 bg-neutral-950 text-white shadow-soft">
                <img src={categoryImage[c]} alt="" className="aspect-[4/3] w-full object-cover" />
                <p className="px-2 py-3 text-xs font-semibold uppercase tracking-wider">{c}</p>
              </Link>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-rose-600" />{fmtTime(settings.open_time)} – {fmtTime(settings.close_time)} daily</span>
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-rose-600" />{settings.address}</span>
          </div>
          {settings.bookings_full ? (
            <Button className="mt-8 h-12 rounded-full bg-rose-600 px-10 hover:bg-rose-700" onClick={() => setFullOpen(true)}>Book now</Button>
          ) : (
            <Button asChild className="mt-8 h-12 rounded-full bg-rose-600 px-10 hover:bg-rose-700"><Link to="/services">Book now</Link></Button>
          )}
        </div>
      </section>

      {popular.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-14">
          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-semibold sm:text-4xl">Most popular</h2>
            <Link to="/services" className="text-sm font-semibold text-primary">View all</Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
                <img src={serviceImage(s)} alt={s.name} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold">{s.name}</h3>
                    <span className="flex items-center gap-1 text-xs text-primary"><Star className="h-3 w-3 fill-current" />Popular</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-semibold">{sar(s.price)} <span className="text-xs font-normal text-muted-foreground">· {s.duration_min} min</span></span>
                    <Button size="sm" className="rounded-full" onClick={() => { if (settings.bookings_full) { setFullOpen(true); return; } add(s); toast.success(`${s.name} added to cart`); }}>Add</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3">
          {[
            [Sparkles, "Expert stylists", "Experienced team using premium products."],
            [Wallet, `Pay ${settings.advance_percent}% now`, "Bank transfer or wallet balance. Recharge the wallet with an STC Sawa PIN."],
            [ShieldCheck, "Verified bookings", "Every payment is checked by our team."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Sparkles;
            return (
              <div key={t as string} className="flex gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card"><I className="h-5 w-5 text-primary" /></div>
                <div><p className="font-semibold">{t as string}</p><p className="text-sm text-muted-foreground">{d as string}</p></div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
