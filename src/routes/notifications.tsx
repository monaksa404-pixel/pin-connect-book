import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Maison Rosé" },
      { name: "description", content: "Notifications page for Maison Rosé salon." },
      { property: "og:title", content: "Notifications — Maison Rosé" },
      { property: "og:description", content: "Notifications page for Maison Rosé salon." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return <PageHeader eyebrow="Coming soon" title="Notifications">This page is being built.</PageHeader>;
}
