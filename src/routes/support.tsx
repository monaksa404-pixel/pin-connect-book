import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Maison Rosé" },
      { name: "description", content: "Support page for Maison Rosé salon." },
      { property: "og:title", content: "Support — Maison Rosé" },
      { property: "og:description", content: "Support page for Maison Rosé salon." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return <PageHeader eyebrow="Coming soon" title="Support">This page is being built.</PageHeader>;
}
