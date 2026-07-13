import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    const stored = localStorage.getItem("cuidarbem_user");
    if (!stored) {
      throw redirect({ to: "/auth" });
    }
    const user = JSON.parse(stored);
    return { user };
  },
  component: () => <Outlet />,
});
