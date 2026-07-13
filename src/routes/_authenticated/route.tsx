import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    // Retorna usuário mockado diretamente para ignorar qualquer autenticação
    return {
      user: {
        id: "0e7874c3-a937-4158-a0ab-949991be81b9",
        email: "mibsbs3@gmail.com",
      },
    };
  },
  component: () => <Outlet />,
});