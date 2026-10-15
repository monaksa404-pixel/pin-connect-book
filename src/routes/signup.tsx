import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { sendAlert } from "@/lib/alerts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — The Beauty House" },
      { name: "description", content: "Enter your name to create a salon account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; password: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) { toast.error("Database is not connected yet."); return; }
    if (name.trim().length < 2) { toast.error("Enter your name."); return; }
    setBusy(true);
    const password = `Bh${Math.random().toString(36).slice(2, 8)}`;
    const email = `u${Date.now()}@salon.local`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (error || !data.user) { setBusy(false); toast.error(friendlyError(error)); return; }
    if (!data.session) {
      const again = await supabase.auth.signInWithPassword({ email, password });
      if (again.error) {
        setBusy(false);
        toast.error("Turn off email confirmation in Supabase, then try again.");
        return;
      }
    }
    const { data: profile } = await supabase.from("profiles").select("user_code").eq("id", data.user.id).maybeSingle();
    const code = profile?.user_code ?? "";
    if (code) {
      await supabase.auth.updateUser({ email: `${code.toLowerCase()}@salon.local` });
    }
    await sendAlert("new_user", `New user registered\nName: ${name.trim()}\nUser ID: ${code}`);
    setBusy(false);
    setDone({ code, password });
    toast.success("Account created");
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <img src="/images/logo.png" alt="The Beauty House" className="mx-auto h-24 w-auto" />
        <h1 className="mt-6 text-3xl font-semibold">Account created</h1>
        <p className="mt-2 text-sm text-muted-foreground">Save these. You sign in with your User ID and password.</p>
        <p className="mt-6 font-mono text-2xl font-semibold">{done.code}</p>
        <p className="mt-2 font-mono text-lg">Password: {done.password}</p>
        <Button className="mt-8 h-12 rounded-full px-8" onClick={() => navigate({ to: "/" })}>Continue</Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-[80vh] bg-cover bg-top" style={{ backgroundImage: "url(/images/sample1.png)" }}>
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-end px-4 pb-10">
        <form onSubmit={submit} className="space-y-3 rounded-3xl bg-background/90 p-5 shadow-soft">
          <img src="/images/logo.png" alt="The Beauty House" className="mx-auto h-16 w-auto" />
          <h1 className="text-center text-2xl font-semibold">Create your account</h1>
          <Input required maxLength={80} placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
          <Button disabled={busy} className="h-12 w-full rounded-full">{busy ? "Creating…" : "Create account"}</Button>
          <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-primary">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
