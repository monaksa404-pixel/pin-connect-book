import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings — Maison Rosé" },
      { name: "description", content: "My Bookings page for Maison Rosé salon." },
      { property: "og:title", content: "My Bookings — Maison Rosé" },
      { property: "og:description", content: "My Bookings page for Maison Rosé salon." },
    ],
  }),
  component: MyBookingsPage,
});

function MyBookingsPage() {
  return <PageHeader eyebrow="Coming soon" title="My Bookings">This page is being built.</PageHeader>;
}
