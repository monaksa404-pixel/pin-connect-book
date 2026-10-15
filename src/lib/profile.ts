import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import type { BankAccount, Profile } from "./types";

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
