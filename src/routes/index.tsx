import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison Rosé — Luxury Salon Booking" },
      { name: "description", content: "Book haircuts, beard, facial and massage services online at Maison Rosé." },
      { property: "og:title", content: "Maison Rosé — Luxury Salon Booking" },
      { property: "og:description", content: "Book haircuts, beard, facial and massage services online." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <section className="bg-hero">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Luxury grooming & beauty</p>
          <h1 className="mt-3 text-5xl font-semibold sm:text-6xl">Look your best, effortlessly.</h1>
          <p className="mt-4 text-muted-foreground">Book your appointment online in under a minute.</p>
          <Button asChild className="mt-6 h-12 rounded-full px-8"><Link to="/services">Book now</Link></Button>
        </div>
        <img src={hero} alt="Salon interior" width={1600} height={1008} className="rounded-3xl shadow-soft" />
      </div>
    </section>
  );
}
