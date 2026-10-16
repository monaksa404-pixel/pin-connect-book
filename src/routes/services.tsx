import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Flower2, Gift, Heart, LayoutGrid, Scissors, Search, ShoppingCart, Smile, UserRound } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, DEFAULT_SETTINGS, sar, serviceImage, servicesQuery, settingsQuery } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { FullNotice } from "@/components/FullNotice";
import type { Service } from "@/lib/types";

const TITLES: Record<string, string> = {
  Haircuts: "Haircuts & Styling",
  Beard: "Beard & Shaving",
  Facial: "Facial & Skincare",
  Massage: "Relaxing Massage",
};

const ICONS = [
  { label: "All", category: "", icon: LayoutGrid },
  { label: "Haircuts", category: "Haircuts", icon: Scissors },
  { label: "Beard Care", category: "Beard", icon: UserRound },
  { label: "Facial", category: "Facial", icon: Smile },
  { label: "Massage", category: "Massage", icon: Flower2 },
  { label: "Packages", category: "Packages", icon: Gift },
];

export const Route = createFileRoute("/services")({
  validateSearch: (s: Record<string, unknown>): { category?: string | undefined; service?: string | undefined } => ({
    category: typeof s["category"] === "string" ? (s["category"] as string) : undefined,
    service: typeof s["service"] === "string" ? (s["service"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Our Services — The Beauty House" },
      { name: "description", content: "Premium grooming for modern men." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { category, service } = Route.useSearch();
  const { data: services = [], isLoading } = useQuery(servicesQuery);
  const { add } = useCart();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const [fullOpen, setFullOpen] = useState(false);
  const [q, setQ] = useState("");
  const active = category ?? "";

  const filtered = useMemo(() => {
    let list = services;
    if (service) list = list.filter((s) => s.id === service);
    else if (active && active !== "Packages") list = list.filter((s) => s.category === active);
    else if (active === "Packages") list = list.filter((s) => s.popular);
    const query = q.trim().toLowerCase();
    if (query) list = list.filter((s) => s.name.toLowerCase().includes(query) || (s.description ?? "").toLowerCase().includes(query));
    return list;
  }, [services, service, active, q]);

  const groups = active ? [active === "Packages" ? "Packages" : active] : [...CATEGORIES];
  const addService = (s: Service) => {
    if (settings.bookings_full) { setFullOpen(true); return; }
    add(s);
    toast.success(`${s.name} added`);
  };

  return (
    <div className="min-h-screen bg-[#fff5f8] px-4 pb-28 pt-4 md:pb-10">
      <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-4xl font-semibold text-rose-950">Our Services</h1>
        <p className="text-rose-900/60">Premium Grooming for Modern Men</p>
        <label className="mt-4 flex items-center gap-2 rounded-full border border-rose-100 bg-white px-4 py-3 text-rose-900/50">
          <Search className="h-4 w-4" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services..." className="w-full bg-transparent text-sm text-rose-950 outline-none" />
        </label>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {ICONS.map((c) => (
            <Link key={c.label} to="/services" search={c.category ? { category: c.category } : {}} className="flex w-[72px] shrink-0 flex-col items-center gap-2 text-center text-[11px] font-semibold text-rose-950">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl shadow-sm ${active === c.category || (!active && c.label === "All") ? "bg-rose-600 text-white" : "bg-white text-rose-600"}`}>
                <c.icon className="h-6 w-6" />
              </span>
              {c.label}
            </Link>
          ))}
        </div>
        {isLoading && <p className="mt-6 text-rose-900/60">Loading services…</p>}
        {groups.map((g) => {
          const items = g === "Packages" ? filtered : filtered.filter((s) => s.category === g);
          if (!items.length) return null;
          return (
            <section key={g} className="mt-6">
              <div className="flex items-end justify-between">
                <h2 className="font-display text-2xl font-semibold text-rose-950">{TITLES[g] || g}</h2>
                <Link to="/services" search={g === "Packages" ? { category: "Packages" } : { category: g }} className="text-sm font-semibold text-rose-600">View All &gt;</Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {items.map((s) => (
                  <article key={s.id} className="overflow-hidden">
                    <div className="relative">
                      <img src={serviceImage(s)} alt={s.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />
                      <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-rose-500"><Heart className="h-3.5 w-3.5" /></span>
                      {s.popular && <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">HOT 🔥</span>}
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-rose-950">{s.name}</h3>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1 text-[11px] text-rose-900/70"><Clock className="h-3.5 w-3.5" />{s.duration_min} min</span>
                      <button type="button" onClick={() => addService(s)} className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white">
                        <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                      </button>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-rose-700">{sar(s.price)}</p>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
