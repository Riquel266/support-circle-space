import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { API_URL, getAuthToken } from "@/lib/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/") return;

    const stored = localStorage.getItem("cuidarbem_user");
    if (!stored) {
      throw redirect({ to: "/auth" });
    }
    const user = JSON.parse(stored);

    if (user.role === "super_admin") {
      throw redirect({ to: "/admin" });
    }

    const token = getAuthToken();
    try {
      const res = await fetch(`${API_URL()}/auth/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          ...(user.companyId ? { "X-Company-Id": user.companyId } : {}),
        },
        body: JSON.stringify({ userId: user.id, role: user.role }),
      });
      const data = await res.json();
      if (!data.valid) {
        localStorage.removeItem("cuidarbem_user");
        localStorage.removeItem("cuidarbem_token");
        throw redirect({ to: "/auth" });
      }
    } catch {
      // Se não conseguir validar, deixa passar (offline)
    }
    return { user };
  },
  component: () => <Outlet />,
});
