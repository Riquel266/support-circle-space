import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

const API_URL = () => `/api`;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const stored = localStorage.getItem("cuidarbem_user");
    if (!stored) {
      throw redirect({ to: "/auth" });
    }
    const user = JSON.parse(stored);
    try {
      const res = await fetch(`${API_URL()}/auth/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: user.role }),
      });
      const data = await res.json();
      if (!data.valid) {
        localStorage.removeItem("cuidarbem_user");
        throw redirect({ to: "/auth" });
      }
    } catch {
      // Se não conseguir validar, deixa passar (offline)
    }
    return { user };
  },
  component: () => <Outlet />,
});
