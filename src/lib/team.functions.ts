import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const caregiverSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }).max(72),
  fullName: z.string().trim().min(2, { message: "Nome muito curto" }).max(100),
  phone: z.string().trim().max(30).optional(),
});

export const createCaregiver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => caregiverSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isSupervisor } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "supervisor",
    });
    if (!isSupervisor) throw new Error("Apenas supervisores podem cadastrar cuidadores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        phone: data.phone ?? null,
        role: "cuidador",
      },
    });
    if (error) {
      console.error("createCaregiver error:", error.message);
      throw new Error(
        error.message.includes("already") || error.message.includes("registered")
          ? "Este e-mail já está cadastrado."
          : "Não foi possível criar o cuidador. Tente novamente.",
      );
    }
    return { id: created.user.id };
  });