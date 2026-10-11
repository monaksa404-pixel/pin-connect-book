import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Maison Rosé" },
      { name: "description", content: "Login page for Maison Rosé salon." },
      { property: "og:title", content: "Login — Maison Rosé" },
      { property: "og:description", content: "Login page for Maison Rosé salon." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return <PageHeader eyebrow="Coming soon" title="Login">This page is being built.</PageHeader>;
}
