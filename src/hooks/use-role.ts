import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "supervisor" | "cuidador";

export function useRole() {
  return {
    userId: "0e7874c3-a937-4158-a0ab-949991be81b9",
    role: "supervisor" as AppRole,
    isLoading: false,
  };
}