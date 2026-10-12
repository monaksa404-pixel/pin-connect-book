import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Sparkles, Star, ShieldCheck, Wallet } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { CATEGORIES, categoryImage, fmtTime, sar, serviceImage, servicesQuery, settingsQuery, DEFAULT_SETTINGS } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison Rosé — Luxury Salon Booking" },
      { name: "description", content: "Book haircuts, beard, facial and massage services online at Maison Rosé." },
      { property: "og:title", content: "Maison Rosé — Luxury Salon Booking" },
      { property: "og:description", content: "Book haircuts, beard, facial and massage services online." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { data: services = [] } = useQuery(servicesQuery);
  const { add } = useCart();
  const popular = services.filter((s) => s.popular).slice(0, 6);

  return (
    <>
      <section className="bg-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{settings.tagline}</p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.05] sm:text-6xl">Look your best, effortlessly.</h1>
            <p className="mt-4 max-w-md text-muted-foreground">
              Choose your services, pick a time and pay just {settings.advance_percent}% upfront. The rest is paid at the salon.
            </p>
            {settings.bookings_full && (
              <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{settings.full_message}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="h-12 rounded-full px-8"><Link to="/services">Book now</Link></Button>
              <Button asChild variant="outline" className="h-12 rounded-full px-8"><Link to="/location">Find us</Link></Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{fmtTime(settings.open_time)} – {fmtTime(settings.close_time)} daily</span>
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{settings.address}</span>
            </div>
          </div>
          <img src={hero} alt="Salon interior" width={1600} height={1008} className="aspect-[4/3] w-full rounded-3xl object-cover shadow-soft" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-semibold sm:text-4xl">Our services</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link key={c} to="/services" search={{ category: c }} className="group relative overflow-hidden rounded-3xl">
              <img src={categoryImage[c]} alt={c} loading="lazy" className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
              <span className="absolute bottom-4 left-4 font-display text-2xl font-semibold text-background">{c}</span>
            </Link>
          ))}
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
                    <Button size="sm" className="rounded-full" onClick={() => { add(s); toast.success(`${s.name} added to cart`); }}>Add</Button>
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
            [Wallet, `Pay ${settings.advance_percent}% now`, "Bank transfer or STC Sawa voucher. The rest at the salon."],
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
