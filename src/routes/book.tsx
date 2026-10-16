import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { format, startOfToday } from "date-fns";
import { useCart } from "@/lib/cart";
import { DEFAULT_SETTINGS, fmtTime, settingsQuery, timeSlots } from "@/lib/data";
import { EmptyState, PageHeader, Steps } from "@/components/shared";
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
    <>
      <PageHeader eyebrow="Step 3" title="Date & time" />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Steps current={2} />
        <FullNotice open={fullOpen} message={settings.full_message || "Bookings are currently unavailable because we have too many customers."} onClose={() => setFullOpen(false)} />
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="rounded-3xl border border-border bg-card p-3 shadow-soft">
            <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setTime(null); }} disabled={{ before: startOfToday() }} />
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <p className="font-semibold">{date ? format(date, "EEEE, d MMMM") : "Select a date"}</p>
            {date && (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No times left today. Please pick another date.</p>}
                {slots.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    className={cn(
                      "rounded-xl border py-2 text-sm font-medium transition",
                      time === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50",
                    )}
                  >
                    {fmtTime(t)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button disabled={!date || !time} onClick={next} className="h-12 rounded-full px-8">Continue</Button>
        </div>
      </div>
    </>
  );
}
