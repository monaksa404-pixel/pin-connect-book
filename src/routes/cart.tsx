import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Cart — Maison Rosé" },
      { name: "description", content: "Cart page for Maison Rosé salon." },
      { property: "og:title", content: "Cart — Maison Rosé" },
      { property: "og:description", content: "Cart page for Maison Rosé salon." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  return <PageHeader eyebrow="Coming soon" title="Cart">This page is being built.</PageHeader>;
}
