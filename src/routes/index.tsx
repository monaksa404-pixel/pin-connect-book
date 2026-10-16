import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Clock, Flower2, Gift, Heart, LayoutGrid, Scissors, ShoppingCart, Smile, UserRound } from "lucide-react";
import { FullNotice } from "@/components/FullNotice";
import { categoryImage, fmtTime, mediaUrl, sar, serviceImage, servicesQuery, settingsQuery, slidersQuery, DEFAULT_SETTINGS } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

const SLIDES = ["/images/slider1.jpeg", "/images/slider2.jpeg", "/images/slider3.jpeg", "/images/slider4.jpeg"];

const CATS = [
  { label: "All", to: "/services" as const, search: {}, icon: LayoutGrid },
  { label: "Haircuts", to: "/services" as const, search: { category: "Haircuts" }, icon: Scissors },
  { label: "Beard Care", to: "/services" as const, search: { category: "Beard" }, icon: UserRound },
  { label: "Facial", to: "/services" as const, search: { category: "Facial" }, icon: Smile },
  { label: "Massage", to: "/services" as const, search: { category: "Massage" }, icon: Flower2 },
  { label: "Packages", to: "/services" as const, search: {}, icon: Gift },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Beauty House Salon" },
      { name: "description", content: "The Beauty House Salon. Haircuts, Beard Care, Facial and Massage." },
      { property: "og:title", content: "The Beauty House Salon" },
      { property: "og:description", content: "The Beauty House Salon. Haircuts, Beard Care, Facial and Massage." },
      { property: "og:image", content: "https://pin-connect-book.vercel.app/images/sender.jpeg" },
      { property: "og:url", content: "https://pin-connect-book.vercel.app/" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { data: services = [] } = useQuery(servicesQuery);
  const { data: dbSlides = [] } = useQuery(slidersQuery);
  const { add } = useCart();
  const [fullOpen, setFullOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const popular = (services.filter((s) => s.popular).length ? services.filter((s) => s.popular) : services).slice(0, 4);

  const slides = dbSlides.length
    ? dbSlides.map((s) => ({ src: mediaUrl(s.image_url), serviceId: s.service_id, key: s.id }))
    : SLIDES.map((src) => ({ src, serviceId: null as string | null, key: src }));

  useEffect(() => {
    const t = setInterval(() => setSlide((n) => (n + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  const book = () => {
    if (settings.bookings_full) setFullOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#ffd6e8] pb-24 md:pb-10">
      <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="relative overflow-hidden rounded-[28px] bg-rose-100 shadow-sm">
          <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {slides.map((s) => (
              <img key={s.key} src={s.src} alt={settings.salon_name} className="aspect-[16/10] w-full shrink-0 object-cover sm:aspect-[16/7]" />
            ))}
          </div>
          {settings.bookings_full ? (
            <button type="button" onClick={book} className="absolute inset-0" aria-label="Book now" />
          ) : (
            <Link to="/services" search={slides[slide]?.serviceId ? { service: slides[slide].serviceId } : {}} className="absolute inset-0" aria-label="Open slide" />
          )}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <button key={s.key} type="button" aria-label={`Slide ${i + 1}`} onClick={() => setSlide(i)} className={`h-2 rounded-full ${i === slide ? "w-5 bg-rose-600" : "w-2 bg-white/80"}`} />
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {CATS.map((c) => (
            <Link key={c.label} to={c.to} search={c.search} className="flex w-[76px] shrink-0 flex-col items-center gap-2 text-center text-[11px] font-semibold text-rose-950">
              <span className={`grid h-16 w-16 place-items-center rounded-2xl shadow-sm ${c.label === "All" ? "bg-rose-600 text-white" : "border border-rose-100 bg-white text-rose-600"}`}>
                <c.icon className="h-6 w-6" />
              </span>
              {c.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold text-rose-950 sm:text-3xl">Most Popular Services</h2>
          <Link to="/services" className="text-sm font-semibold text-rose-600">View All &gt;</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {popular.map((s) => (
            <article key={s.id} className="overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-sm">
              <div className="relative">
                <img src={serviceImage(s)} alt={s.name} className="aspect-[4/3] w-full object-cover" />
                {s.popular && <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">HOT 🔥</span>}
                <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-rose-500"><Heart className="h-4 w-4" /></span>
              </div>
              <div className="p-3">
                <h3 className="font-semibold leading-tight text-rose-950">{s.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-rose-900/60">{s.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-rose-900/70"><Clock className="h-3.5 w-3.5" />{s.duration_min} min</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (settings.bookings_full) { setFullOpen(true); return; }
                      add(s);
                      toast.success(`${s.name} added to cart`);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                  </button>
                </div>
                <p className="mt-2 text-xs font-semibold text-rose-700">{sar(s.price)}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 hidden items-center justify-center gap-6 text-sm text-rose-900/70 md:flex">
          <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-rose-600" />{fmtTime(settings.open_time)} – {fmtTime(settings.close_time)}</span>
          <span>{settings.address}</span>
        </p>
        <div className="mt-6 hidden gap-3 md:grid md:grid-cols-4">
          {["Haircuts", "Beard", "Facial", "Massage"].map((c) => (
            <Link key={c} to="/services" search={{ category: c }} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <img src={categoryImage[c]} alt={c} className="aspect-[4/3] w-full object-cover" />
              <p className="p-3 text-center text-sm font-semibold text-rose-950">{c}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
