import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { DEFAULT_SETTINGS, fmtTime, settingsQuery } from "@/lib/data";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/location")({
  head: () => ({
    meta: [
      { title: "Location & Hours — Maison Rosé" },
      { name: "description", content: "Find Maison Rosé salon: address, opening hours, phone and WhatsApp." },
      { property: "og:title", content: "Location & Hours — Maison Rosé" },
      { property: "og:description", content: "Address, opening hours and contact details." },
    ],
  }),
  component: LocationPage,
});

function LocationPage() {
  const { data: s = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const q = encodeURIComponent(s.address ?? "");
  return (
    <>
      <PageHeader eyebrow="Visit us" title="Location & hours" />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1fr_360px]">
        <iframe title="Map" className="h-[420px] w-full rounded-3xl border border-border" loading="lazy" src={`https://maps.google.com/maps?q=${q}&output=embed`} />
        <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <Item icon={MapPin} k="Address" v={s.address ?? ""} />
          <Item icon={Clock} k="Open daily" v={`${fmtTime(s.open_time)} – ${fmtTime(s.close_time)}`} />
          <Item icon={Phone} k="Phone" v={s.phone ?? ""} />
          <div className="flex flex-col gap-2 pt-2">
            {s.map_url && <Button asChild className="rounded-full"><a href={s.map_url} target="_blank" rel="noreferrer">Get directions</a></Button>}
            {s.whatsapp && <Button asChild variant="outline" className="rounded-full"><a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp us</a></Button>}
          </div>
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
