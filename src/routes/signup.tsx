import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthCard } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — The Beauty House" },
      { name: "description", content: "Create an account with your name, phone, email and password." },
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
    if (!isSupabaseConfigured) { toast.error("Database is not connected yet."); return; }
    if (f.name.trim().length < 2) { toast.error("Enter your full name."); return; }
    if (f.password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { data: { full_name: f.name.trim(), phone: f.phone.trim() } },
    });
    if (error || !data.user) { setBusy(false); toast.error(friendlyError(error)); return; }
    if (!data.session) {
      const again = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
      if (again.error) {
        setBusy(false);
        toast.success("Account created. Confirm your email, then sign in.");
        navigate({ to: "/login" });
        return;
      }
    }
    const { data: profile } = await supabase.from("profiles").select("user_code").eq("id", data.user.id).maybeSingle();
    await sendAlert("new_user", `New user registered\nName: ${f.name.trim()}\nPhone: ${f.phone.trim()}\nUser ID: ${profile?.user_code ?? ""}`);
    setBusy(false);
    toast.success("Account created");
    navigate({ to: "/" });
  };

  return (
    <AuthCard title="Create account" sub="Sign up with your details, then sign in any time with the same email.">
      <form onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="n">Full name</Label><Input id="n" required maxLength={80} value={f.name} onChange={set("name")} className="mt-1 h-11" /></div>
        <div><Label htmlFor="ph">Phone</Label><Input id="ph" required maxLength={16} inputMode="tel" placeholder="05xxxxxxxx" value={f.phone} onChange={set("phone")} className="mt-1 h-11" /></div>
        <div><Label htmlFor="e">Email</Label><Input id="e" type="email" required value={f.email} onChange={set("email")} className="mt-1 h-11" /></div>
        <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={f.password} onChange={set("password")} className="mt-1 h-11" /></div>
        <Button disabled={busy} className="h-12 w-full rounded-full">{busy ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-primary">Sign in</Link></p>
    </AuthCard>
  );
}
