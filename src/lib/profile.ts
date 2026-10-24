import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import type { BankAccount, Profile } from "./types";

export function useMyPlace() {
  const { user } = useAuth();
  const profile = useProfile();
  return useQuery({
    queryKey: ["my-place", user?.id, profile.data?.city, profile.data?.assigned_address, profile.data?.assigned_map_url, profile.data?.assigned_whatsapp],
    enabled: !!user,
    queryFn: async () => {
      const fallback = {
        address: profile.data?.assigned_address || "",
        map_url: profile.data?.assigned_map_url || "",
        whatsapp: profile.data?.assigned_whatsapp || "",
      };
      const { data, error } = await supabase.rpc("my_place");
      if (error || !data) return fallback;
      const row = (Array.isArray(data) ? data[0] : data) as { address?: string | null; map_url?: string | null; whatsapp?: string | null } | null;
      if (!row) return fallback;
      return {
        address: row.address || fallback.address,
        map_url: row.map_url || fallback.map_url,
        whatsapp: row.whatsapp || fallback.whatsapp,
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
