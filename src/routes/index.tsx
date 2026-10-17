import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Clock, Flame, Flower2, Gift, Heart, LayoutGrid, Scissors, ShoppingCart, Smile, UserRound } from "lucide-react";
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
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1600" },
      { property: "og:image:height", content: "900" },
      { property: "og:image:alt", content: "The Beauty House Salon" },
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
  const popular = services;

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
    <div className="min-h-screen bg-[#fff0f6] pb-24 md:pb-10">
      <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="relative overflow-hidden rounded-[28px] bg-[#ffe4f2] shadow-sm">
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
              <button key={s.key} type="button" aria-label={`Slide ${i + 1}`} onClick={() => setSlide(i)} className={`h-2 rounded-full ${i === slide ? "w-5 bg-[#ff4d94]" : "w-2 bg-white/80"}`} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-6 gap-1">
          {CATS.map((c) => (
            <Link key={c.label} to={c.to} search={c.search} className="flex min-w-0 flex-col items-center gap-1 text-center text-[10px] font-semibold text-[#5c2344] sm:text-xs">
              <span className={`grid h-10 w-10 place-items-center rounded-2xl shadow-sm sm:h-12 sm:w-12 ${c.label === "All" ? "bg-[#ff4d94] text-white" : "border border-pink-100 bg-white text-[#ff4d94]"}`}>
                <c.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              {c.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold text-[#5c2344] sm:text-3xl">Our Services</h2>
          <Link to="/services" className="text-sm font-semibold text-[#ff4d94]">View All &gt;</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {popular.map((s) => (
            <article key={s.id} className="overflow-hidden">
              <div className="relative">
                <img src={serviceImage(s)} alt={s.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />
                <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#ff4d94]"><Heart className="h-3.5 w-3.5" /></span>
                {s.popular && <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">HOT <Flame className="h-3 w-3 fill-white text-white" /></span>}
              </div>
              <h3 className="mt-2 text-base font-semibold text-[#3d2030] md:text-lg">{s.name}</h3>
              <div className="mt-1 flex items-center justify-between text-sm font-semibold">
                <span className="text-[#ff4d94]">{sar(s.price)}</span>
                <span className="flex items-center gap-1 text-[#9a5b78]"><Clock className="h-4 w-4 text-[#ff4d94]" />{s.duration_min} min</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (settings.bookings_full) { setFullOpen(true); return; }
                  add(s);
                  toast.success(`${s.name} added to cart`);
                }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#ff4d94] py-2.5 text-sm font-semibold text-white"
              >
                <ShoppingCart className="h-4 w-4" /> Add to Cart
              </button>
            </article>
          ))}
        </div>

        <p className="mt-8 hidden items-center justify-center gap-6 text-sm text-[#9a5b78] md:flex">
          <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#ff4d94]" />{fmtTime(settings.open_time)} – {fmtTime(settings.close_time)}</span>
          <span>{settings.address}</span>
        </p>
        <div className="mt-6 hidden gap-3 md:grid md:grid-cols-4">
          {["Haircuts", "Beard", "Facial", "Massage"].map((c) => (
            <Link key={c} to="/services" search={{ category: c }} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <img src={categoryImage[c]} alt={c} className="aspect-[4/3] w-full object-cover" />
              <p className="p-3 text-center text-sm font-semibold text-[#5c2344]">{c}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
