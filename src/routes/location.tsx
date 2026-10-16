import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarDays, MapPin, MessageCircle } from "lucide-react";
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
  const whatsapp = (profile?.assigned_whatsapp || "").replace(/\D/g, "");
  const shown = whatsapp ? `+${whatsapp}` : "";
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
              <h2 className="flex items-center gap-2 font-semibold text-[#ff4d94]"><CalendarDays className="h-4 w-4" /> Your Booking Details</h2>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src={pic ? serviceImage(pic) : "/images/slider1.jpeg"} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div>
                    <p className="font-semibold text-[#3d2030]">{items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</p>
                    <p className="text-sm text-[#9a5b78]">{fmtTime(String(booking.booking_time).slice(0, 5))}{booking.booking_date ? `, ${format(parseISO(booking.booking_date), "d MMM yyyy")}` : ""}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">{booking.status}</span>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-[#3d2030]">Salon <span className="text-[#ff4d94]">Contact</span></h2>
              <p className="text-sm text-[#9a5b78]">For any questions or directions, you can contact us on WhatsApp.</p>
              {whatsapp && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-100 p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-white"><MessageCircle className="h-5 w-5" /></span>
                    <div><p className="text-xs text-[#9a5b78]">WhatsApp Number</p><p className="font-semibold">{shown}</p></div>
                  </div>
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="rounded-full bg-[#ff4d94] px-4 py-2 text-sm font-semibold text-white">Chat on WhatsApp →</a>
                </div>
              )}
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-[#ff4d94]">Salon Location</h2>
              <p className="text-sm text-[#9a5b78]">Here is our exact location. You can open it in Google Maps for easy directions. Open daily {fmtTime(s.open_time)} – {fmtTime(s.close_time)}.</p>
              <iframe title="Map" className="mt-3 h-64 w-full rounded-2xl border border-pink-100" loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} />
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#fff0f6] p-3 text-sm">
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#ff4d94]" />{address}</p>
                {map && <a href={map} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-[#ff4d94]">Open in Maps</a>}
              </div>
            </div>
          </>
        )}
        <Link to="/my-bookings" className="grid h-12 place-items-center rounded-full border border-pink-200 bg-white font-semibold text-[#ff4d94]">← Back to My Bookings</Link>
      </div>
    </div>
  );
}
