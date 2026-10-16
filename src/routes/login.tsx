import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase, friendlyError } from "@/lib/supabase";
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
    <AuthCard title="Sign in" sub="Use the same email, name, and mobile number from your account.">
      <form onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="u" className="text-foreground">Email / Gmail</Label><Input id="u" required autoComplete="email" value={login} onChange={(e) => setLogin(e.target.value)} className="mt-1 h-11" /></div>
        <div><Label htmlFor="pw" className="text-foreground">Password</Label><Input id="pw" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11" /></div>
        <p className="text-sm text-muted-foreground">Your <strong className="text-foreground">name</strong> and <strong className="text-foreground">mobile number</strong> are saved on the account. Sign in here with your email / Gmail and password.</p>
        <Button disabled={busy} className="h-12 w-full rounded-full">{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">New here? <Link to="/signup" className="font-semibold text-primary">Create an account</Link></p>
    </AuthCard>
  );
}

export function AuthCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft">
        <img src="/images/logo.png" alt="The Beauty House" className="mb-4 h-16 w-auto" />
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{sub}</p>
        {children}
      </div>
    </div>
  );
}
