import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ISO6391 from "iso-639-1";
import { CalendarDays, CheckCheck, Copy, CreditCard, HelpCircle, Languages, MapPin, Paperclip, Send, Smile, Tag } from "lucide-react";
import { DEFAULT_SETTINGS, settingsQuery } from "@/lib/data";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isImage(url: string) {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
}

async function copyExact(body: string) {
  try {
    await navigator.clipboard.writeText(body);
    toast.success("Copied");
  } catch {
    toast.error("Could not copy");
  }
}

function pasteExact(e: React.ClipboardEvent<HTMLTextAreaElement>, text: string, setText: (v: string) => void) {
  e.preventDefault();
  const raw = e.clipboardData.getData("text/plain");
  const start = e.currentTarget.selectionStart ?? text.length;
  const end = e.currentTarget.selectionEnd ?? text.length;
  setText((text.slice(0, start) + raw + text.slice(end)).slice(0, 2000));
}

function MessageView({ body, attachment }: { body: string; attachment?: string | null | undefined }) {
  const image = !!attachment && isImage(attachment);
  const showText = body !== "." && !attachment;
  return (
    <>
      {showText && body.length > 0 && (
        <div className="flex items-start gap-2">
          <p dir="auto" className="select-text flex-1 whitespace-pre-wrap break-words">{body}</p>
          <button type="button" aria-label="Copy message" onClick={() => copyExact(body)} className="shrink-0 opacity-70"><Copy className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {image && <img src={attachment!} alt="" className="max-h-48 rounded-lg" />}
      {attachment && !image && <a href={attachment} target="_blank" rel="noreferrer" className="underline">Open file</a>}
    </>
  );
}

const RTL = new Set(["ar", "ur", "ps"]);
const LANGUAGES = ["ur", "hi", "bn", "ne", "ar", "ps"];
const PLACEHOLDER: Record<string, string> = {
  ur: "اپنا پیغام لکھیں...",
  hi: "अपना संदेश लिखें...",
  bn: "আপনার বার্তা লিখুন...",
  ne: "आफ्नो सन्देश लेख्नुहोस्...",
  ar: "اكتب رسالتك...",
  ps: "خپل پیغام ولیکئ...",
};

function languageLabel(code: string) {
  const native = ISO6391.getNativeName(code);
  const english = ISO6391.getName(code);
  return native && native !== english ? `${native} — ${english}` : english || code;
}

type Msg = { id: string; sender: "user" | "admin"; body: string; created_at: string; attachment_url?: string | null };

export function ChatThread({ userId, as }: { userId: string; as: "user" | "admin" }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [lang, setLang] = useState("ur");
  const [langOpen, setLangOpen] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("chat-language");
    if (saved && LANGUAGES.includes(saved)) setLang(saved);
  }, []);
  const choose = (code: string) => {
    setLang(code);
    localStorage.setItem("chat-language", code);
    if (as === "user" && userId) supabase.from("profiles").update({ chat_language: code }).eq("id", userId);
  };
  const { data: customerLang } = useQuery({
    queryKey: ["chat-language", userId],
    enabled: as === "admin" && !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("chat_language").eq("id", userId).maybeSingle();
      return (data?.chat_language as string | null) || "";
    },
  });
  const activeLang = as === "admin" && customerLang && LANGUAGES.includes(customerLang) ? customerLang : lang;
  const dir = RTL.has(activeLang) ? "rtl" : "ltr";
  const box = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ["chat", userId],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_messages").select("id, sender, body, created_at, attachment_url").eq("user_id", userId).order("created_at");
      if (error) { toast.error(error.message); return [] as Msg[]; }
      return (data ?? []) as Msg[];
    },
  });
  const rows = Array.isArray(data) ? data : [];

  const fileRef = useRef<HTMLInputElement>(null);
  const sendFile = async (file: File) => {
    const path = `chat/${userId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "")}`;
    const up = await supabase.storage.from("media").upload(path, file);
    if (up.error) { toast.error(up.error.message); return; }
    const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("support_messages").insert({ user_id: userId, sender: as, body: ".", attachment_url: url });
    if (error) { toast.error(error.message); return; }
    if (as === "user") await sendAlert("support", `New support file\n${file.name}`);
    await qc.invalidateQueries({ queryKey: ["chat", userId] });
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.slice(0, 2000);
    if (!body.trim() || !userId) return;
    setText("");
    try {
      const { error } = await supabase.from("support_messages").insert({ user_id: userId, sender: as, body });
      if (error) { toast.error(error.message); setText(body); return; }
      if (as === "user") {
        const { data: who } = await supabase.from("profiles").select("full_name, user_code").eq("id", userId).maybeSingle();
        await sendAlert("support", `New support message\nName: ${who?.full_name || "Customer"}\nUser: ${who?.user_code || ""}\nLanguage: ${languageLabel(lang)}\n${body}`);
      }
      await qc.invalidateQueries({ queryKey: ["chat", userId] });
      box.current?.scrollTo({ top: box.current.scrollHeight });
    } catch (err) {
      toast.error((err as Error).message || "Message was not sent");
      setText(body);
    }
  };

  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery);
  const prompts = [
    ["Book Appointment", CalendarDays],
    ["Service Details", Tag],
    ["Salon Location", MapPin],
    ["Payment Methods", CreditCard],
    ["General Inquiry", HelpCircle],
  ] as const;
  if (as === "admin") {
    return (
      <div className="flex h-[60vh] flex-col rounded-3xl border border-border bg-card">
        {customerLang && LANGUAGES.includes(customerLang) && <p className="border-b border-border px-4 py-2 text-sm text-[#9a5b78]">Customer language: {languageLabel(customerLang)}</p>}
        <div ref={box} className="flex-1 space-y-2 overflow-y-auto p-4" dir={dir}>
          {rows.map((m) => (
            <div key={m.id} className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", m.sender === "admin" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <MessageView body={m.body} attachment={m.attachment_url} />
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.currentTarget.value = ""; }} />
          <Button type="button" size="icon" variant="ghost" aria-label="Attachment" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /></Button>
          <textarea value={text} rows={2} maxLength={2000} dir={dir} lang={activeLang} onChange={(e) => setText(e.target.value)} onPaste={(e) => pasteExact(e, text, setText)} placeholder="Reply…" className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-background px-3 py-2 text-sm" />
          <Button type="submit" size="icon" className="shrink-0 rounded-full" aria-label="Send"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    );
  }
  const time = (iso: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col pb-44">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold text-[#5c2344]">Live Chat</h1>
          <p className="text-sm text-[#9a5b78]">Chat with our support team</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
          <p className="flex items-center justify-end gap-1 text-xs font-semibold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> We are Online</p>
          <p className="text-[10px] text-[#9a5b78]">Usually replies in a few minutes</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
        <span className="relative h-12 w-12 shrink-0">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[#ffe4f2] text-[#ff4d94]">
            {settings.support_avatar_url ? <img src={settings.support_avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-lg font-semibold">BH</span>}
          </span>
          <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${settings.support_online ? "bg-emerald-500" : "bg-gray-300"}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#3d2030]">Beauty House Support</p>
          <p className={`flex items-center gap-1 text-xs ${settings.support_online ? "text-emerald-600" : "text-[#9a5b78]"}`}><span className={`h-1.5 w-1.5 rounded-full ${settings.support_online ? "bg-emerald-500" : "bg-gray-300"}`} /> {settings.support_online ? "Online" : "Offline"}</p>
        </div>
        <div className="relative">
          <button type="button" aria-label="Change language" onClick={() => setLangOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-full bg-[#ffe4f2] text-[#ff4d94]">
            <Languages className="h-5 w-5" />
          </button>
          {langOpen && (
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-lg">
              {LANGUAGES.map((code) => (
                <button key={code} type="button" onClick={() => { choose(code); setLangOpen(false); }} className={`block w-full px-3 py-2 text-left text-sm ${lang === code ? "bg-[#ffe4f2] font-semibold text-[#e23b86]" : "text-[#3d2030]"}`}>
                  {languageLabel(code)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div ref={box} className="mt-3 flex-1 space-y-3 overflow-y-auto">
        {rows.length === 0 && (
          <div className="flex items-end gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ffe4f2] text-[10px] font-semibold text-[#ff4d94]">{settings.support_avatar_url ? <img src={settings.support_avatar_url} alt="" className="h-full w-full object-cover" /> : "BH"}</span>
            <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-[#3d2030] shadow-sm">
              <p>Hello! 👋</p>
              <p>Welcome to The Beauty House Salon. How can we help you today?</p>
            </div>
          </div>
        )}
        {rows.map((m) => (
          <div key={m.id} className={cn("flex items-end gap-2", m.sender === "user" ? "justify-end" : "justify-start")}>
            {m.sender !== "user" && <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ffe4f2] text-[10px] font-semibold text-[#ff4d94]">{settings.support_avatar_url ? <img src={settings.support_avatar_url} alt="" className="h-full w-full object-cover" /> : "BH"}</span>}
            <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", m.sender === "user" ? "rounded-br-md bg-[#ff4d94] text-white" : "rounded-bl-md bg-white text-[#3d2030] shadow-sm")}>
              <MessageView body={m.body} attachment={m.attachment_url} />
              <p className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", m.sender === "user" ? "text-white/80" : "text-[#9a5b78]")}>
                {time(m.created_at)}
                {m.sender === "user" && <CheckCheck className="h-3 w-3" />}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-16 z-30 bg-[#fff0f6] px-3 py-2 md:bottom-0">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 grid grid-cols-5 gap-2">
            {prompts.map(([label, Icon]) => (
              <button key={label} type="button" onClick={() => setText(label)} className="rounded-2xl bg-white px-1 py-2 text-center text-[10px] font-semibold leading-tight text-[#ff4d94] shadow-sm">
                <Icon className="mx-auto mb-1 h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={send} className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm">
            <button type="button" aria-label="Emoji" onClick={() => setText((t) => `${t}😊`)} className="text-[#ff4d94]"><Smile className="h-5 w-5" /></button>
            <textarea value={text} rows={1} maxLength={2000} dir={dir} lang={lang} onChange={(e) => setText(e.target.value)} onPaste={(e) => pasteExact(e, text, setText)} placeholder={PLACEHOLDER[lang] || "Type a message..."} className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none" />
            <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.currentTarget.value = ""; }} />
            <button type="button" aria-label="Attachment" onClick={() => fileRef.current?.click()} className="text-[#9a5b78]"><Paperclip className="h-5 w-5" /></button>
            <Button type="submit" size="icon" className="shrink-0 rounded-full bg-[#ff4d94]" aria-label="Send"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}
