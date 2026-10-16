import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [{ title: "Checkout — The Beauty House Salon" }],
  }),
  component: BookPage,
});

function BookPage() {
  const { setSlot, slot } = useCart();
  const navigate = useNavigate();
  useEffect(() => {
    if (!slot) {
      const day = new Date();
      setSlot({ date: day.toISOString().slice(0, 10), time: "10:00" });
    }
    navigate({ to: "/checkout" });
  }, [navigate, setSlot, slot]);
  return null;
}
