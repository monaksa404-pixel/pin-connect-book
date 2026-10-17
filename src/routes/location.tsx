import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarDays, Check, Clock, MapPin, Navigation } from "lucide-react";
import { DEFAULT_SETTINGS, fmtTime, serviceImage, servicesQuery, settingsQuery } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/location")({
  head: () => ({
    meta: [
      { title: "Salon Location — The Beauty House" },
      { name: "description", content: "Your assigned salon location is shown after payment is approved." },
      { property: "og:title", content: "Salon Location — The Beauty House" },
      { property: "og:image", content: "https://pin-connect-book.vercel.app/images/sender.jpeg" },
    ],
  }),
  component: LocationPage,
});

const LOCKED = "Book your appointment and complete your payment to receive your assigned salon location and WhatsApp number.";

function LocationPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: s = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const { data: services = [] } = useQuery(servicesQuery);
  const { data: booking } = useQuery({
    queryKey: ["paid-booking-row", user?.id],
    enabled: !!user && isSupabaseConfigured,
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("code, status, booking_date, booking_time, items, payment_status").eq("payment_status", "verified").order("created_at", { ascending: false }).limit(1);
      return data?.[0] ?? null;
    },
  });
  const open = !!user && !!booking && profile?.contact_enabled && !!(profile.assigned_address || profile.assigned_whatsapp);
  const address = profile?.assigned_address || "";
  const map = profile?.assigned_map_url || "";
  const whatsapp = (profile?.assigned_whatsapp || s.whatsapp || "").replace(/\D/g, "");
  const shown = whatsapp.startsWith("966") && whatsapp.length > 5
    ? `+966 ${whatsapp.slice(3, 5)} ${whatsapp.slice(5, 8)} ${whatsapp.slice(8)}`
    : whatsapp ? `+${whatsapp}` : "";
  const mapsHref = map || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "");
  const items = (booking?.items ?? []) as { name: string; qty: number; service_id?: string }[];
  const pic = services.find((x) => x.id === items[0]?.service_id);

  return (
    <div className="min-h-screen bg-[#fff0f6] px-4 pb-28 pt-4 md:pb-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff4d94] text-white"><MapPin className="h-5 w-5" /></span>
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#3d2030]">Salon <span className="text-[#ff4d94]">Location</span></h1>
            <p className="text-sm text-[#9a5b78]">Visit our salon at the location below or contact us on WhatsApp for any help.</p>
          </div>
        </div>
        {!open && <p className="rounded-3xl bg-white p-4 text-sm text-[#9a5b78] shadow-sm">{LOCKED}</p>}
        {open && booking && (
          <>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-[#3d2030]">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff4d94] text-white"><CalendarDays className="h-4 w-4" /></span>
                Your <span className="text-[#ff4d94]">Booking Details</span>
              </h2>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={pic ? serviceImage(pic) : "/images/slider1.jpeg"} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#3d2030]">{items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-[#9a5b78]">
                      <Clock className="h-3.5 w-3.5 text-[#ff4d94]" />
                      {fmtTime(String(booking.booking_time).slice(0, 5))}{booking.booking_date ? `, ${format(parseISO(booking.booking_date), "d MMM yyyy")}` : ""}
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold capitalize text-emerald-700"><Check className="h-3.5 w-3.5" />{booking.status}</span>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-[#3d2030]">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff4d94] text-white">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden><path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l6-1.6A11 11 0 0 0 20.5 3.5zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.9.9-3.4-.2-.3A9 9 0 1 1 12 20.5zm5-6.7c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5c-.1-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.5 4c.6.3 1.1.4 1.5.5a3.6 3.6 0 0 0 1.7.1 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z" /></svg>
                </span>
                Salon <span className="text-[#ff4d94]">Contact</span>
              </h2>
              <p className="mt-2 text-sm text-[#9a5b78]">For any questions or directions, you can contact us on WhatsApp.</p>
              {whatsapp && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-100 p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#25D366] text-white">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden><path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l6-1.6A11 11 0 0 0 20.5 3.5zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.9.9-3.4-.2-.3A9 9 0 1 1 12 20.5zm5-6.7c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5c-.1-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.5 4c.6.3 1.1.4 1.5.5a3.6 3.6 0 0 0 1.7.1 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z" /></svg>
                    </span>
                    <div><p className="text-xs text-[#9a5b78]">WhatsApp Number</p><p className="font-semibold text-[#3d2030]">{shown}</p></div>
                  </div>
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#ff4d94] px-4 py-2 text-sm font-semibold text-white">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden><path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l6-1.6A11 11 0 0 0 20.5 3.5zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.9.9-3.4-.2-.3A9 9 0 1 1 12 20.5z" /></svg>
                    Chat on WhatsApp →
                  </a>
                </div>
              )}
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-[#3d2030]">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff4d94] text-white"><MapPin className="h-4 w-4" /></span>
                Salon <span className="text-[#ff4d94]">Location</span>
              </h2>
              <p className="mt-2 text-sm text-[#9a5b78]">Here is our exact location. You can open it in Google Maps for easy directions.</p>
              <div className="relative mt-3">
                <iframe title="Map" className="h-64 w-full rounded-2xl border border-pink-100" loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent(address || s.address || s.salon_name)}&z=15&output=embed`} />
                <div className="pointer-events-none absolute left-1/2 top-4 w-[78%] -translate-x-1/2 rounded-2xl bg-white p-3 text-center shadow-md">
                  <p className="font-semibold text-[#3d2030]">{s.salon_name}</p>
                  <p className="text-xs text-[#9a5b78]">{address || s.address}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#fff0f6] p-3 text-sm">
                <p className="flex items-center gap-2 text-[#5c2344]"><MapPin className="h-4 w-4 shrink-0 text-[#ff4d94]" />{address || s.address}</p>
                {mapsHref && <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#ff4d94]"><Navigation className="h-4 w-4" />Open in Maps</a>}
              </div>
            </div>
          </>
        )}
        <Link to="/my-bookings" className="flex h-12 items-center justify-center gap-2 rounded-full border border-pink-200 bg-white font-semibold text-[#ff4d94]">← Back to My Bookings</Link>
      </div>
    </div>
  );
}
