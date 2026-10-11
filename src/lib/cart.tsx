import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Service } from "./types";

export type CartLine = { service: Service; qty: number };
export type Slot = { date: string; time: string } | null;

type CartCtx = {
  lines: CartLine[];
  add: (s: Service) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  total: number;
  count: number;
  slot: Slot;
  setSlot: (s: Slot) => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "salon-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [slot, setSlot] = useState<Slot>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setLines(p.lines ?? []);
        setSlot(p.slot ?? null);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify({ lines, slot }));
  }, [lines, slot, ready]);

  const add = (s: Service) =>
    setLines((ls) => {
      const f = ls.find((l) => l.service.id === s.id);
      if (f) return ls.map((l) => (l.service.id === s.id ? { ...l, qty: Math.min(10, l.qty + 1) } : l));
      return [...ls, { service: s, qty: 1 }];
    });
  const setQty = (id: string, qty: number) =>
    setLines((ls) =>
      qty <= 0 ? ls.filter((l) => l.service.id !== id) : ls.map((l) => (l.service.id === id ? { ...l, qty: Math.min(10, qty) } : l)),
    );
  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.service.id !== id));
  const clear = () => {
    setLines([]);
    setSlot(null);
  };
  const total = lines.reduce((a, l) => a + l.service.price * l.qty, 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);

  return (
    <Ctx.Provider value={{ lines, add, setQty, remove, clear, total, count, slot, setSlot }}>{children}</Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
