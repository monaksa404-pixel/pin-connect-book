import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { DEFAULT_SETTINGS, settingsQuery } from "@/lib/data";
import { PageHeader, RequireAuth } from "@/components/shared";
import { ChatThread } from "@/components/ChatThread";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Maison Rosé" },
      { name: "description", content: "Chat with the Maison Rosé team about your booking." },
      { property: "og:title", content: "Support — Maison Rosé" },
      { property: "og:description", content: "Chat with the Maison Rosé team." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { data: s = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  return (
    <>
      <PageHeader eyebrow="Help" title="Support">Message our team — we usually reply within minutes.</PageHeader>
      <div className="mx-auto max-w-3xl px-4 py-10">
        {s.whatsapp && (
          <Button asChild variant="outline" className="mb-4 rounded-full">
            <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Prefer WhatsApp?</a>
          </Button>
        )}
        <RequireAuth what="chat with us"><Chat /></RequireAuth>
      </div>
    </>
  );
}

function Chat() {
  const { user } = useAuth();
  return <ChatThread userId={user!.id} as="user" />;
}
