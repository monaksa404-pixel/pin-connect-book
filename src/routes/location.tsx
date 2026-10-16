import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { DEFAULT_SETTINGS, fmtTime, settingsQuery } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/location")({
  head: () => ({
    meta: [
      { title: "Location & Hours — The Beauty House" },
      { name: "description", content: "Your assigned salon location is shown after payment is approved." },
      { property: "og:title", content: "Location & Hours — The Beauty House" },
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
  const { data: paid = false } = useQuery({
    queryKey: ["paid-booking", user?.id],
    enabled: !!user && isSupabaseConfigured,
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("id").eq("payment_status", "verified").limit(1);
      return (data?.length ?? 0) > 0;
    },
  });
  const open = !!user && paid && profile?.contact_enabled && !!(profile.assigned_address || profile.assigned_whatsapp);
  const address = profile?.assigned_address || "";
  const map = profile?.assigned_map_url || "";
  const whatsapp = (profile?.assigned_whatsapp || "").replace(/\D/g, "");

  return (
    <>
      <PageHeader eyebrow="Visit us" title="Location & hours" />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1fr_360px]">
        {open ? (
          <iframe title="Map" className="h-[420px] w-full rounded-3xl border border-border" loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} />
        ) : (
          <div className="grid h-[420px] place-items-center rounded-3xl border border-border bg-muted px-6 text-center text-sm text-muted-foreground">{LOCKED}</div>
        )}
        <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
          {open ? (
            <>
              <Item icon={MapPin} k="Your salon location" v={address} />
              <Item icon={Clock} k="Open daily" v={`${fmtTime(s.open_time)} – ${fmtTime(s.close_time)}`} />
              {s.phone && <Item icon={Phone} k="Phone" v={s.phone} />}
              <div className="flex flex-col gap-2 pt-2">
                {map && <Button asChild className="rounded-full"><a href={map} target="_blank" rel="noreferrer">Get directions</a></Button>}
                {whatsapp && <Button asChild variant="outline" className="rounded-full"><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp {profile?.assigned_whatsapp}</a></Button>}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{LOCKED}</p>
          )}
        </div>
      </div>
    </>
  );
}

function Item({ icon: I, k, v }: { icon: typeof MapPin; k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary"><I className="h-4 w-4 text-primary" /></div>
      <div><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>
    </div>
  );
}
