import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";
import { createAccount } from "@/lib/signup.functions";
import { CitySelect } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { mediaUrl, settingsQuery } from "@/lib/data";
import { AuthCard } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — The Beauty House" },
      { name: "description", content: "Create an account with your name, mobile number, city and password." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", phone: "", city: "", password: "" });
  const [busy, setBusy] = useState(false);
  const { data: settings } = useQuery(settingsQuery);
  const signImage = mediaUrl(settings?.signin_image_url);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) { toast.error("Database is not connected yet."); return; }
    if (f.name.trim().length < 2) { toast.error("Enter your full name."); return; }
    if (!f.city) { toast.error("Select your city."); return; }
    if (f.password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setBusy(true);
    const created = await createAccount({ data: { name: f.name.trim(), phone: f.phone.trim(), city: f.city.trim(), password: f.password } });
    if (!created.ok) { setBusy(false); toast.error(friendlyError({ message: created.error })); return; }
    const { data: session, error } = await supabase.auth.signInWithPassword({ email: created.email, password: f.password });
    if (error || !session.user) { setBusy(false); toast.error(friendlyError(error)); return; }
    await supabase.from("profiles").update({ city: f.city.trim(), phone: f.phone.trim(), full_name: f.name.trim() }).eq("id", session.user.id);
    const { data: profile } = await supabase.from("profiles").select("user_code").eq("id", session.user.id).maybeSingle();
    await sendAlert("new_user", `New user registered\nName: ${f.name.trim()}\nPhone: ${f.phone.trim()}\nCity: ${f.city.trim()}\nUser ID: ${profile?.user_code ?? ""}`);
    setBusy(false);
    toast.success("Account created");
    navigate({ to: "/" });
  };

  return (
    <AuthCard title="Create account" sub="Sign up with your name, mobile number and city. Sign in later with the same mobile number." image={signImage}>
      <form onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="n" className="text-foreground">Name</Label><Input id="n" required maxLength={80} autoComplete="name" value={f.name} onChange={set("name")} className="mt-1 h-11" /></div>
        <div><Label htmlFor="ph" className="text-foreground">Mobile number</Label><Input id="ph" required maxLength={16} inputMode="tel" autoComplete="tel" placeholder="05xxxxxxxx" value={f.phone} onChange={set("phone")} className="mt-1 h-11" /></div>
        <div><Label htmlFor="c" className="text-foreground">City</Label><CitySelect id="c" value={f.city} onChange={(city) => setF({ ...f, city })} className="mt-1" /></div>
        <div><Label htmlFor="pw" className="text-foreground">Password</Label><Input id="pw" type="password" required minLength={6} autoComplete="new-password" value={f.password} onChange={set("password")} className="mt-1 h-11" /></div>
        <Button disabled={busy} className="h-12 w-full rounded-full">{busy ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-primary">Sign in</Link></p>
    </AuthCard>
  );
}
