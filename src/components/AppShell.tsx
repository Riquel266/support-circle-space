import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, LayoutDashboard, Users, ClipboardPlus, UserCog, LogOut, CalendarCheck, Shield, CreditCard, MapPinOff } from "lucide-react";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRole } from "@/hooks/use-role";
import { useLocationTracker } from "@/hooks/use-location-tracker";
import { OfflineBanner } from "@/components/OfflineBanner";

export function AppShell({ children }: { children: ReactNode }) {
  const { role, userId, companyId } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  useLocationTracker(userId);

  useEffect(() => {
    if (role !== "cuidador") {
      setLocationGranted(true);
      return;
    }
    if (!navigator.geolocation) {
      setLocationGranted(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationGranted(true),
      () => setLocationGranted(false),
      { timeout: 10000 },
    );
  }, [role]);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    localStorage.removeItem("cuidarbem_user");
    localStorage.removeItem("cuidarbem_token");
    navigate({ to: "/auth", replace: true });
  };

  const handleOpenLocationSettings = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationGranted(true);
          window.location.reload();
        },
        () => setLocationGranted(false),
        { timeout: 10000 },
      );
    }
  };

  if (role === "cuidador" && locationGranted === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <MapPinOff className="mx-auto h-12 w-12 text-red-500" />
            <CardTitle className="font-display text-xl">Localizacao necessaria</CardTitle>
            <CardDescription>
              O CuidarBem precisa da sua localizacao para funcionar. Ative o GPS e permita o acesso a localizacao neste dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={handleOpenLocationSettings}>
              Permitir Localizacao
            </Button>
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = [
    ...(role === "supervisor" ? [
      { to: "/painel", label: "Painel", icon: LayoutDashboard },
      { to: "/idosos", label: "Pacientes", icon: Users },
      { to: "/equipe", label: "Equipe", icon: UserCog },
      { to: "/presenca", label: "Presença", icon: CalendarCheck },
    ] : []),
    ...(role === "cuidador" ? [
      { to: "/idosos", label: "Pacientes", icon: Users },
    ] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OfflineBanner />
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
            {role === "super_admin" && (
              <Link
                to="/admin"
                className="hidden items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground sm:flex"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            {role === "supervisor" && (
              <Link
                to="/billing"
                className="hidden items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground sm:flex"
              >
                <CreditCard className="h-4 w-4" />
                Planos
              </Link>
            )}
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
