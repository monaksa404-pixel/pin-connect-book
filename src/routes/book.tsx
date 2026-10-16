import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { format, startOfToday } from "date-fns";
import { useCart } from "@/lib/cart";
import { DEFAULT_SETTINGS, fmtTime, settingsQuery, timeSlots } from "@/lib/data";
import { EmptyState } from "@/components/shared";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { FullNotice } from "@/components/FullNotice";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Choose Date & Time — The Beauty House" },
      { name: "description", content: "Pick a date and time for your salon appointment." },
      { property: "og:title", content: "Choose Date & Time — The Beauty House" },
      { property: "og:description", content: "Pick a date and time for your salon appointment." },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const { lines, slot, setSlot } = useCart();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const navigate = useNavigate();
  const [date, setDate] = useState<Date | undefined>(slot ? new Date(slot.date + "T00:00") : undefined);
  const [time, setTime] = useState<string | null>(slot?.time ?? null);
  const [fullOpen, setFullOpen] = useState(false);
  useEffect(() => { if (settings.bookings_full) setFullOpen(true); }, [settings.bookings_full]);

  const slots = useMemo(() => {
    const all = timeSlots(settings.open_time.slice(0, 5), settings.close_time.slice(0, 5), settings.slot_minutes);
    if (!date || format(date, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd")) return all;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return all.filter((t) => {
      const [h = 0, m = 0] = t.split(":").map(Number);
      return h * 60 + m > nowMin;
    });
  }, [date, settings]);

  if (lines.length === 0)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Add a service first"><Button asChild className="mt-4 rounded-full"><Link to="/services">Browse services</Link></Button></EmptyState>
      </div>
    );

  const next = () => {
    if (settings.bookings_full) { setFullOpen(true); return; }
    if (!date || !time) return;
    setSlot({ date: format(date, "yyyy-MM-dd"), time });
    navigate({ to: "/checkout" });
  };

  return (
    <div className="min-h-screen bg-[#ffd6e8] px-4 pb-28 pt-4 md:pb-10">
      <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
      <div className="mx-auto max-w-4xl rounded-[28px] bg-white p-4 shadow-sm md:p-6">
        <h1 className="font-display text-3xl font-semibold text-rose-950">Choose <span className="text-rose-600">Date & Time</span></h1>
        <p className="text-sm text-rose-900/60">Select your preferred date and available time slot.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-rose-100 p-3">
            <p className="mb-2 font-semibold text-rose-950">Select Date</p>
            <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setTime(null); }} disabled={{ before: startOfToday() }} />
            <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Today: {format(new Date(), "EEE, d MMM yyyy")}</p>
          </div>
          <div className="rounded-3xl border border-rose-100 p-3">
            <p className="font-semibold text-rose-950">Select Time</p>
            <p className="text-xs text-rose-900/60">{date ? `Available time slots for ${format(date, "EEE, d MMM yyyy")}` : "Pick a date first"}</p>
            <div className="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
              {slots.map((t) => (
                <button key={t} type="button" onClick={() => setTime(t)} className={cn("rounded-full py-2 text-sm font-semibold", time === t ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700")}>{fmtTime(t)}</button>
              ))}
              {date && slots.length === 0 && <p className="col-span-2 text-sm text-rose-900/60">No times left today.</p>}
            </div>
          </div>
        </div>
        <Button disabled={!date || !time} onClick={next} className="mt-4 h-12 w-full rounded-full bg-rose-600 text-base">Confirm Date & Time →</Button>
      </div>
    </div>
  );
}
