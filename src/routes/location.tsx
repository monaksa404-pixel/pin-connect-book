import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/location")({
  head: () => ({
    meta: [
      { title: "Location — Maison Rosé" },
      { name: "description", content: "Location page for Maison Rosé salon." },
      { property: "og:title", content: "Location — Maison Rosé" },
      { property: "og:description", content: "Location page for Maison Rosé salon." },
    ],
  }),
  component: LocationPage,
});

function LocationPage() {
  return <PageHeader eyebrow="Coming soon" title="Location">This page is being built.</PageHeader>;
}
