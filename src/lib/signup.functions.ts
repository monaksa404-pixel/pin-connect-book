import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const createAccount = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(2).max(80),
      phone: z.string().trim().min(8).max(16),
      city: z.string().trim().min(2).max(80),
      password: z.string().min(6).max(72),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const url = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const key = process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) return { ok: false as const, error: "Account creation is not set up yet. Add the Supabase service role key." };
    const digits = data.phone.replace(/\D/g, "");
    const email = `${digits}@customers.beautyhouse.salon`;
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, phone: data.phone, city: data.city },
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, email };
  });
