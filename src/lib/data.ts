import { queryOptions } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { Service, Settings } from "./types";
import hair from "@/assets/svc-hair.jpg";
import beard from "@/assets/svc-beard.jpg";
import facial from "@/assets/svc-facial.jpg";
import hero from "@/assets/hero.jpg";

export const CATEGORIES = ["Haircuts", "Beard", "Facial", "Massage"] as const;

export const categoryImage: Record<string, string> = {
  Haircuts: hair,
  Beard: beard,
  Facial: facial,
  Massage: hero,
};

export const serviceImage = (s: Pick<Service, "image_url" | "category">) =>
  s.image_url || categoryImage[s.category] || hero;

export const DEFAULT_SETTINGS: Settings = {
  salon_name: "Maison Rosé",
  tagline: "Luxury grooming & beauty studio",
  bank_name: "Al Rajhi Bank",
  account_holder: "Maison Rose Salon",
  account_number: "000000000000",
  iban: "SA0000000000000000000000",
  bank_qr_url: null,
  bank_enabled: true,
  stc_enabled: true,
  bookings_full: false,
  full_message:
    "Bookings are currently unavailable because we have too many customers. Please check back soon.",
  advance_percent: 50,
  open_time: "10:00",
  close_time: "23:00",
  slot_minutes: 30,
  whatsapp: "966500000000",
  phone: "+966 50 000 0000",
  address: "King Fahd Road, Riyadh, Saudi Arabia",
  map_url: "https://maps.google.com/?q=Riyadh",
};

const demo = (
  id: string,
  name: string,
  category: string,
  price: number,
  duration_min: number,
  popular: boolean,
  description: string,
): Service => ({ id, name, category, price, duration_min, popular, description, image_url: null, active: true, sort: 0 });

export const DEMO_SERVICES: Service[] = [
  demo("d1", "Signature Haircut", "Haircuts", 80, 45, true, "Consultation, precision cut, wash and style."),
  demo("d2", "Skin Fade", "Haircuts", 70, 40, true, "Seamless fade finished with a sharp line-up."),
  demo("d3", "Kids Haircut", "Haircuts", 50, 30, false, "Gentle cut for under 12s."),
  demo("d4", "Beard Sculpt", "Beard", 50, 25, true, "Shape, trim and hot-towel finish."),
  demo("d5", "Royal Shave", "Beard", 60, 30, false, "Straight-razor shave with hot towels and balm."),
  demo("d6", "Hydra Facial", "Facial", 180, 60, true, "Deep cleanse, exfoliation and hydration."),
  demo("d7", "Gold Mask Facial", "Facial", 220, 60, false, "Brightening 24k gold treatment."),
  demo("d8", "Relax Massage", "Massage", 200, 60, true, "Full-body relaxing massage."),
  demo("d9", "Head & Shoulder Massage", "Massage", 90, 30, false, "Tension relief for neck and shoulders."),
];

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async (): Promise<Settings> => {
    if (!isSupabaseConfigured) return DEFAULT_SETTINGS;
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return DEFAULT_SETTINGS;
    return data as Settings;
  },
});

export const servicesQuery = queryOptions({
  queryKey: ["services"],
  queryFn: async (): Promise<Service[]> => {
    if (!isSupabaseConfigured) return DEMO_SERVICES;
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("active", true)
      .order("sort");
    if (error) return DEMO_SERVICES;
    return (data as Service[]).map((s) => ({ ...s, price: Number(s.price) }));
  },
});

export const sar = (n: number) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })} SAR`;

export function timeSlots(open: string, close: string, step: number): string[] {
  const toMin = (t: string) => {
    const [h = 0, m = 0] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const out: string[] = [];
  for (let t = toMin(open); t + step <= toMin(close); t += step) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}

export const fmtTime = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
};

export function advanceFor(total: number, pct: number) {
  const advance = Math.round(total * pct) / 100;
  return { advance, remaining: Math.round((total - advance) * 100) / 100 };
}
