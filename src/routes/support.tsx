import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PageHeader, RequireAuth } from "@/components/shared";
import { ChatThread } from "@/components/ChatThread";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — The Beauty House" },
      { name: "description", content: "Chat with The Beauty House team about your booking." },
      { property: "og:title", content: "Support — The Beauty House" },
      { property: "og:description", content: "Chat with The Beauty House team." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <>
      <PageHeader eyebrow="Help" title="Support">Message our team — we usually reply within minutes.</PageHeader>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <RequireAuth what="chat with us"><Chat /></RequireAuth>
      </div>
    </>
  );
}

function Chat() {
  const { user } = useAuth();
  return <ChatThread userId={user!.id} as="user" />;
}
