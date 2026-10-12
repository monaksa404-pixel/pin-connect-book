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
      { title: "Sign In — Maison Rosé" },
      { name: "description", content: "Sign in to book and track your salon appointments." },
      { property: "og:title", content: "Sign In — Maison Rosé" },
      { property: "og:description", content: "Sign in to your Maison Rosé account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Welcome back!");
    navigate({ to: "/" });
  };

  const reset = async () => {
    if (!email) return toast.error("Enter your email first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/login" });
    if (error) return toast.error(friendlyError(error));
    toast.success("Password reset link sent to your email.");
  };

  return (
    <AuthCard title="Welcome back" sub="Sign in to manage your bookings.">
      <form onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="e">Email</Label><Input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11" /></div>
        <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11" /></div>
        <Button disabled={busy} className="h-12 w-full rounded-full">{busy ? "Signing in…" : "Sign in"}</Button>
        <button type="button" onClick={reset} className="w-full text-center text-xs text-muted-foreground hover:text-primary">Forgot password?</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">New here? <Link to="/signup" className="font-semibold text-primary">Create an account</Link></p>
    </AuthCard>
  );
}

export function AuthCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="bg-hero px-4 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft">
        <h1 className="text-4xl font-semibold">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{sub}</p>
        {children}
      </div>
    </div>
  );
}
