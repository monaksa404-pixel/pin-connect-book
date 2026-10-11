import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="bg-hero">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{eyebrow}</p>}
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export function Steps({ current }: { current: number }) {
  const steps = ["Services", "Cart", "Date & time", "Details & pay"];
  return (
    <ol className="mx-auto mb-8 flex max-w-2xl items-center gap-2 text-xs sm:text-sm">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
              i <= current ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          <span className={cn("hidden sm:inline", i === current ? "font-semibold" : "text-muted-foreground")}>{s}</span>
          {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

const tone: Record<string, string> = {
  pending: "bg-warning/20 text-warning-foreground",
  under_verification: "bg-warning/20 text-warning-foreground",
  awaiting: "bg-secondary text-secondary-foreground",
  verified: "bg-success/15 text-success",
  confirmed: "bg-success/15 text-success",
  completed: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  none: "bg-muted text-muted-foreground",
  sent: "bg-success/15 text-success",
  skipped: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};
const label: Record<string, string> = {
  pending: "Pending",
  under_verification: "Under verification",
  awaiting: "Awaiting payment",
  verified: "Verified",
  confirmed: "Confirmed",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  none: "—",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tone[status] ?? "bg-muted")}>
      {label[status] ?? status}
    </span>
  );
}

export function RequireAuth({ children, what = "continue" }: { children: ReactNode; what?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-24 text-center text-muted-foreground">Loading…</div>;
  if (!user)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-4 text-3xl font-semibold">Sign in to {what}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Create a free account in seconds to book and track your appointments.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild className="rounded-full"><Link to="/login">Sign in</Link></Button>
          <Button asChild variant="outline" className="rounded-full"><Link to="/signup">Create account</Link></Button>
        </div>
      </div>
    );
  return <>{children}</>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-display text-2xl font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
