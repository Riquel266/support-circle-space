import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, LayoutDashboard, Users, ClipboardPlus, UserCog, LogOut, CalendarCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/use-role";

export function AppShell({ children }: { children: ReactNode }) {
  const { role } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    localStorage.removeItem("cuidarbem_user");
    navigate({ to: "/auth", replace: true });
  };

  const navItems = [
    ...(role === "supervisor" ? [
      { to: "/painel", label: "Painel", icon: LayoutDashboard },
      { to: "/idosos", label: "Idosos", icon: Users },
      { to: "/equipe", label: "Equipe", icon: UserCog },
      { to: "/presenca", label: "Presença", icon: CalendarCheck },
    ] : []),
    ...(role === "cuidador" ? [
      { to: "/idosos", label: "Idosos", icon: Users },
    ] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to={role === "supervisor" ? "/painel" : "/idosos"} className="flex items-center gap-2 font-bold text-primary">
            <HeartHandshake className="h-6 w-6" />
            <span className="font-display text-lg">CuidarBem</span>
          </Link>
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground [&.active]:bg-secondary [&.active]:text-secondary-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:pb-8">{children}</main>
      {/* Navegação inferior no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card sm:hidden">
        <div className="grid auto-cols-fr grid-flow-col">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted-foreground [&.active]:text-primary"
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}