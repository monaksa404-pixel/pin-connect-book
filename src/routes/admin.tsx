import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Maison Rosé" },
      { name: "description", content: "Admin page for Maison Rosé salon." },
      { property: "og:title", content: "Admin — Maison Rosé" },
      { property: "og:description", content: "Admin page for Maison Rosé salon." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return <PageHeader eyebrow="Coming soon" title="Admin">This page is being built.</PageHeader>;
}
