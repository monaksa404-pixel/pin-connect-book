import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Maison Rosé" },
      { name: "description", content: "Services page for Maison Rosé salon." },
      { property: "og:title", content: "Services — Maison Rosé" },
      { property: "og:description", content: "Services page for Maison Rosé salon." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return <PageHeader eyebrow="Coming soon" title="Services">This page is being built.</PageHeader>;
}
