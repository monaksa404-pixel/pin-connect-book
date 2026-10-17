import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase, friendlyError } from "@/lib/supabase";
import { mediaUrl, settingsQuery } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — The Beauty House" },
      { name: "description", content: "Sign in with your email and password." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: settings } = useQuery(settingsQuery);
  const signImage = mediaUrl(settings?.signin_image_url);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const typed = login.trim();
    const email = typed.includes("@") ? typed : (await supabase.rpc("email_for_login", { p_login: typed })).data;
    if (!email) { setBusy(false); toast.error("Account not found."); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Welcome back");
    navigate({ to: "/" });
  };

  return (
    <AuthCard title="Sign in" sub="Use the same email, name, and mobile number from your account." image={signImage}>
      <form onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="u" className="text-foreground">Email / Gmail</Label><Input id="u" required autoComplete="email" value={login} onChange={(e) => setLogin(e.target.value)} className="mt-1 h-11" /></div>
        <div><Label htmlFor="pw" className="text-foreground">Password</Label><Input id="pw" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11" /></div>
        <div className="rounded-2xl bg-[#ffe4f2] p-3 text-sm text-[#5c2344]">
          <p className="font-semibold">Use these account details</p>
          <p className="mt-1">Email / Gmail — the field above</p>
          <p>Name — saved when you created the account</p>
          <p>Mobile number — saved when you created the account</p>
        </div>
        <Button disabled={busy} className="h-12 w-full rounded-full">{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">New here? <Link to="/signup" className="font-semibold text-primary">Create an account</Link></p>
    </AuthCard>
  );
}

export function AuthCard({ title, sub, children, image }: { title: string; sub: string; children: React.ReactNode; image?: string }) {
  return (
    <div className="bg-[#fff0f6] px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-pink-100 bg-white p-5 shadow-soft sm:p-8">
        {image && <img src={image} alt="The Beauty House Salon" className="mb-5 aspect-[4/3] w-full rounded-2xl bg-[#ffe4f2] object-cover" />}
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{sub}</p>
        {children}
      </div>
    </div>
  );
}
