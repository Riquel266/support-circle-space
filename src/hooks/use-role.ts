import { useState } from "react";

export type AppRole = "supervisor" | "cuidador";

interface StoredUser {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
}

export function useRole() {
  const stored = localStorage.getItem("cuidarbem_user");
  const user: StoredUser | null = stored ? JSON.parse(stored) : null;

  return {
    userId: user?.id ?? null,
    userName: user?.full_name ?? null,
    role: (user?.role ?? "supervisor") as AppRole,
    isLoading: false,
  };
}
