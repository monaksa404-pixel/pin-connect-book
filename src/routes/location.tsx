import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { MapPin, MessageCircle } from "lucide-react";
import { DEFAULT_SETTINGS, fmtTime, settingsQuery } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/location")({
  head: () => ({
    meta: [
      { title: "Salon Location — The Beauty House" },
      { name: "description", content: "Your assigned salon location is shown after payment is approved." },
      { property: "og:title", content: "Salon Location — The Beauty House" },
      { property: "og:image", content: "/images/logo.png" },
    ],
  }),
  component: LocationPage,
});

const LOCKED = "Book your appointment and complete your payment to receive your assigned salon location and WhatsApp number.";

function LocationPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: s = DEFAULT_SETTINGS } = useQuery(settingsQuery);
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

  return (
    <div className="min-h-screen bg-[#fff5f8] px-4 pb-28 pt-4 md:pb-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-600 text-white"><MapPin className="h-5 w-5" /></span>
          <div>
            <h1 className="font-display text-3xl font-semibold text-rose-950">Salon <span className="text-rose-600">Location</span></h1>
            <p className="text-sm text-rose-900/60">Visit the salon at the location below or contact us on WhatsApp.</p>
          </div>
        </div>
        {!open && <p className="rounded-3xl bg-white p-4 text-sm text-rose-900/70 shadow-sm">{LOCKED}</p>}
        {open && booking && (
          <>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-rose-600">Your Booking Details</h2>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{(booking.items as { name: string; qty: number }[])?.map((i) => `${i.name} × ${i.qty}`).join(", ")}</p>
                  <p className="text-sm text-rose-900/60">{fmtTime(String(booking.booking_time).slice(0, 5))}{booking.booking_date ? `, ${format(parseISO(booking.booking_date), "d MMM yyyy")}` : ""}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">{booking.status}</span>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold"><span className="text-rose-600">Salon Contact</span></h2>
              <p className="text-sm text-rose-900/60">For questions or directions, contact us on WhatsApp.</p>
              {whatsapp && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-3">
                  <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emerald-600" /><div><p className="text-xs text-rose-900/50">WhatsApp Number</p><p className="font-semibold">{shown}</p></div></div>
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Chat on WhatsApp →</a>
                </div>
              )}
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-rose-600">Salon Location</h2>
              <p className="text-sm text-rose-900/60">Open the pin in Google Maps for directions. Open daily {fmtTime(s.open_time)} – {fmtTime(s.close_time)}.</p>
              <iframe title="Map" className="mt-3 h-64 w-full rounded-2xl border border-rose-100" loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} />
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <p>{address}</p>
                {map && <a href={map} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-rose-600">Open in Maps</a>}
              </div>
            </div>
          </>
        )}
        <Link to="/my-bookings" className="grid h-12 place-items-center rounded-full border border-rose-200 bg-white font-semibold text-rose-600">← Back to My Bookings</Link>
      </div>
    </div>
  );
}
