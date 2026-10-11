import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Signup — Maison Rosé" },
      { name: "description", content: "Signup page for Maison Rosé salon." },
      { property: "og:title", content: "Signup — Maison Rosé" },
      { property: "og:description", content: "Signup page for Maison Rosé salon." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  return <PageHeader eyebrow="Coming soon" title="Signup">This page is being built.</PageHeader>;
}
