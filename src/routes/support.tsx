import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/shared";
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
      <div className="mx-auto min-h-screen max-w-3xl bg-[#fff5f8] px-4 pb-28 pt-4 md:pb-10">
        <RequireAuth what="chat with us"><Chat /></RequireAuth>
      </div>
    </>
  );
}

function Chat() {
  const { user } = useAuth();
  return <ChatThread userId={user!.id} as="user" />;
}
