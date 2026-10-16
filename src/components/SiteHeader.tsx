import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Menu, ShoppingBag, User, X, LogOut, Shield } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { settingsQuery } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/my-bookings", label: "My Bookings" },
  { to: "/wallet", label: "Wallet" },
  { to: "/location", label: "Location" },
  { to: "/support", label: "Support" },
] as const;

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const { count } = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });

  return (
    <header className="sticky top-0 z-40 border-b border-rose-100 bg-[#fff5f8]/95 backdrop-blur-md">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_1fr_auto] items-center px-3 md:flex md:justify-between md:px-4">
        <button className="rounded-full p-2 text-rose-700 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link to="/" className="col-start-2 flex justify-center md:col-auto md:justify-start">
          <img src={settings?.logo_url || "/images/logo.png"} alt={settings?.salon_name ?? "The Beauty House"} className="h-12 w-auto" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {user && (
            <Link to="/notifications" className="relative rounded-full p-2 hover:bg-secondary" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>
          )}
          <Link to="/cart" className="relative rounded-full p-2 hover:bg-secondary" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          {isAdmin && (
            <Link to="/admin" className="hidden rounded-full p-2 hover:bg-secondary sm:block" aria-label="Admin">
              <Shield className="h-5 w-5" />
            </Link>
          )}
          {user ? (
            <Button
              variant="ghost"
              size="icon"
              className="hidden rounded-full sm:inline-flex"
              aria-label="Sign out"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          ) : (
            <Button asChild size="sm" className="ml-1 hidden rounded-full sm:inline-flex">
              <Link to="/login">
                <User className="h-4 w-4" /> Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-secondary">
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-secondary">
                Admin panel
              </Link>
            )}
            {user ? (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setOpen(false);
                  navigate({ to: "/" });
                }}
                className="rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-secondary"
              >
                Sign out
              </button>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-primary hover:bg-secondary">
                Sign in / Create account
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
