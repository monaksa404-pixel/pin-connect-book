import { Link } from "@tanstack/react-router";
import { CalendarDays, Home, LayoutGrid, MessageCircle, ShoppingCart, Wallet } from "lucide-react";
import { useCart } from "@/lib/cart";

const ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/services", label: "Services", icon: LayoutGrid },
  { to: "/my-bookings", label: "My Booking", icon: CalendarDays },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/cart", label: "Cart", icon: ShoppingCart },
  { to: "/support", label: "Live Chat", icon: MessageCircle },
] as const;

export function MobileNav() {
  const { count } = useCart();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-rose-100 bg-white/95 px-1 py-2 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-6">
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="flex flex-col items-center gap-1 text-[10px] font-medium text-rose-900/50"
            activeProps={{ className: "text-rose-600" }}
          >
            <span className="relative">
              <item.icon className="h-5 w-5" />
              {item.to === "/cart" && count > 0 && (
                <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">{count}</span>
              )}
            </span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
