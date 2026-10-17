import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery, fmtTime } from "@/lib/data";

export function SiteFooter() {
  const { data: s } = useQuery(settingsQuery);
  return (
    <footer className="mt-16 hidden border-t border-pink-100 bg-[#fff0f6] md:block">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-semibold">{s?.salon_name}</p>
          <p className="mt-2 text-sm text-muted-foreground">{s?.tagline}</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Visit us</p>
          <p className="mt-2 text-muted-foreground">{s?.address}</p>
          {s && (
            <p className="mt-1 text-muted-foreground">
              Daily {fmtTime(s.open_time)} – {fmtTime(s.close_time)}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <Link to="/services" className="text-muted-foreground hover:text-foreground">Services</Link>
          <Link to="/my-bookings" className="text-muted-foreground hover:text-foreground">My Bookings</Link>
          <Link to="/support" className="text-muted-foreground hover:text-foreground">Support</Link>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {s?.salon_name}. All rights reserved.</p>
    </footer>
  );
}
