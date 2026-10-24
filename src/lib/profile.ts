import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import type { BankAccount, Profile, SalonLocation, WhatsappNumber } from "./types";

function sameCity(a: string | null | undefined, b: string | null | undefined) {
  const x = (a || "").trim().toLowerCase();
  const y = (b || "").trim().toLowerCase();
  return !!x && x === y;
}

export function useMyPlace() {
  const { user } = useAuth();
  const profile = useProfile();
  return useQuery({
    queryKey: ["my-place", user?.id, profile.data?.city, profile.data?.location_id, profile.data?.whatsapp_id, profile.data?.assigned_address, profile.data?.assigned_map_url, profile.data?.assigned_whatsapp],
    enabled: !!user && profile.isFetched,
    queryFn: async () => {
      const p = profile.data;
      const [locs, nums] = await Promise.all([
        supabase.from("salon_locations").select("*").eq("active", true),
        supabase.from("whatsapp_numbers").select("*").eq("active", true),
      ]);
      const locations = (locs.data ?? []) as SalonLocation[];
      const numbers = (nums.data ?? []) as WhatsappNumber[];
      const loc = locations.find((l) => sameCity(l.city, p?.city));
      if (!loc) return { address: "", map_url: "", whatsapp: "" };
      const linked = numbers.find((n) => n.id === loc.whatsapp_id);
      return {
        address: [loc.city, loc.address].filter(Boolean).join(", "),
        map_url: loc.map_url || "",
        whatsapp: linked?.phone || (p?.location_id === loc.id ? p.assigned_whatsapp || "" : ""),
      };
    },
  });
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user && isSupabaseConfigured,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

/** The bank account the admin assigned to the signed-in customer (RLS only returns that one). */
export function useAssignedBank(bankId: string | null | undefined) {
  return useQuery({
    queryKey: ["assigned-bank", bankId],
    enabled: !!bankId && isSupabaseConfigured,
    queryFn: async () => {
      const { data } = await supabase.from("bank_accounts").select("*").eq("id", bankId!).maybeSingle();
      return (data as BankAccount | null) ?? null;
    },
  });
}

export const ADMIN_EMAIL = "admin@salon.local";
