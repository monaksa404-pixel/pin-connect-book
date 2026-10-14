import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase, friendlyError } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthCard } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — Maison Rosé" },
      { name: "description", content: "Create a free account to book salon appointments online." },
      { property: "og:title", content: "Create Account — Maison Rosé" },
      { property: "og:description", content: "Join Maison Rosé and book in seconds." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { data: { full_name: f.name.trim(), phone: f.phone.trim() }, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    if (data.session) {
      toast.success("Account created!");
      navigate({ to: "/services" });
    } else {
      toast.success("Check your email to confirm your account.");
      navigate({ to: "/login" });
    }
  };

  return (
    <AuthCard title="Create account" sub="Book and track appointments in one place.">
      <form onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="n">Full name</Label><Input id="n" required maxLength={80} value={f.name} onChange={set("name")} className="mt-1 h-11" /></div>
        <div><Label htmlFor="ph">Phone</Label><Input id="ph" required maxLength={16} inputMode="tel" value={f.phone} onChange={set("phone")} className="mt-1 h-11" /></div>
        <div><Label htmlFor="e">Email</Label><Input id="e" type="email" required value={f.email} onChange={set("email")} className="mt-1 h-11" /></div>
        <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required value={f.password} onChange={set("password")} className="mt-1 h-11" /></div>
        <Button disabled={busy} className="h-12 w-full rounded-full">{busy ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-primary">Sign in</Link></p>
    </AuthCard>
  );
}
