import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Home, LayoutGrid, MessageCircle, ShoppingCart, Wallet } from "lucide-react";
import { useCart } from "@/lib/cart";

const ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/services", label: "Services", icon: LayoutGrid },
  { to: "/my-bookings", label: "My Bookings", icon: CalendarDays },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/cart", label: "Cart", icon: ShoppingCart },
  { to: "/support", label: "Live Chat", icon: MessageCircle },
] as const;

export function MobileNav() {
  const { count } = useCart();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-pink-100 bg-[#fff5fa] px-1 py-2 md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-6">
        {ITEMS.map((item) => {
          const on = item.to === "/" ? path === "/" : path.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to} className={`flex flex-col items-center gap-1 text-[10px] font-medium ${on ? "text-[#e23b86]" : "text-pink-900/45"}`}>
              <span className={`relative grid h-9 w-11 place-items-center rounded-2xl ${on ? "bg-[#ff4d94] text-white" : "text-[#e23b86]"}`}>
                <item.icon className="h-5 w-5" />
                {item.to === "/cart" && count > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff4d94] px-1 text-[9px] font-bold text-white">{count}</span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
