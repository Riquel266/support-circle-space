import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HeartHandshake, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — CuidarBem" },
      { name: "description", content: "Acesse o painel de monitoramento de cuidados a idosos." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"company" | "admin">("company");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      if (mode === "admin") {
        const res = await fetch(`${API_URL()}/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (data.error) {
          toast.error(data.error);
          setLoading(false);
          return;
        }
        localStorage.setItem("cuidarbem_token", data.token);
        localStorage.setItem("cuidarbem_user", JSON.stringify({
          id: data.admin.id,
          full_name: data.admin.name,
          email: data.admin.email,
          role: "super_admin",
        }));
        toast.success("Login de administrador realizado!");
        navigate({ to: "/admin", replace: true });
      } else {
        const companySlug = String(form.get("companySlug") ?? "").trim();
        if (!companySlug) {
          toast.error("Informe o slug da empresa.");
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_URL()}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, companySlug }),
        });
        const data = await res.json();
        if (data.error) {
          toast.error(data.error);
          setLoading(false);
          return;
        }
        localStorage.setItem("cuidarbem_token", data.token);
        localStorage.setItem("cuidarbem_user", JSON.stringify({
          id: data.user.id,
          full_name: data.user.full_name,
          email: data.user.email,
          role: data.user.role,
          companyId: data.companyId,
        }));
        toast.success("Login realizado!");
        navigate({ to: data.user.role === "supervisor" ? "/painel" : "/idosos", replace: true });
      }
    } catch {
      toast.error("Erro ao conectar com o servidor.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <Link to="/" className="mb-6 flex items-center gap-2 font-bold text-primary">
        <HeartHandshake className="h-8 w-8" />
        <span className="font-display text-2xl">CuidarBem</span>
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display">Bem-vindo(a)</CardTitle>
          <CardDescription>
            {mode === "admin"
              ? "Acesso exclusivo para criadores do sistema."
              : "Use o acesso criado pelo supervisor da sua empresa."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              variant={mode === "company" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("company")}
            >
              Empresa
            </Button>
            <Button
              type="button"
              variant={mode === "admin" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("admin")}
            >
              <Shield className="mr-1 h-3 w-3" />
              Administrador
            </Button>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {mode === "company" && (
              <div className="space-y-1.5">
                <Label htmlFor="login-slug">Slug da Empresa</Label>
                <Input id="login-slug" name="companySlug" required maxLength={100} placeholder="minha-empresa" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="login-email">E-mail</Label>
              <Input id="login-email" name="email" type="email" required maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Senha</Label>
              <Input id="login-password" name="password" type="password" required maxLength={72} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
