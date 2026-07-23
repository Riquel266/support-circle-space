import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HeartHandshake, HeartPulse, Camera, BellRing, Users, MessageCircle, Shield } from "lucide-react";
import { toast } from "sonner";
import heroImg from "@/assets/hero-cuidado.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";

const WHATSAPP_NUMBER = "5511962682854";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CuidarBem — Monitoramento de Cuidados a Idosos" },
      { name: "description", content: "Acompanhe cuidadores e idosos em tempo real." },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: HeartPulse,
    title: "Sinais vitais",
    text: "Pressao, temperatura, glicemia e batimentos em segundos.",
  },
  {
    icon: Camera,
    title: "Assinatura facial",
    text: "Selfie do cuidador em cada registro — transparencia total.",
  },
  {
    icon: BellRing,
    title: "Alertas automaticos",
    text: "Valores fora do normal geram alertas imediatos.",
  },
  {
    icon: Users,
    title: "Painel do supervisor",
    text: "Acompanhe em tempo real pelo celular.",
  },
];

function Index() {
  const navigate = useNavigate();
  const [loginMode, setLoginMode] = useState<"company" | "admin">("company");
  const [loading, setLoading] = useState(false);

  const handleCompanyLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const slug = String(form.get("slug") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!slug || !email || !password) {
      toast.error("Preencha todos os campos.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, companySlug: slug }),
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
    } catch {
      toast.error("Erro ao conectar com o servidor.");
    }
    setLoading(false);
  };

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("adminEmail") ?? "").trim();
    const password = String(form.get("adminPassword") ?? "");

    if (!email || !password) {
      toast.error("Preencha todos os campos.");
      setLoading(false);
      return;
    }

    try {
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
    } catch {
      toast.error("Erro ao conectar com o servidor.");
    }
    setLoading(false);
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Ola! Quero ativar o trial do CuidarBem.")}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2 font-bold text-primary">
          <HeartHandshake className="h-7 w-7" />
          <span className="font-display text-xl">CuidarBem</span>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
            Cuidado com idosos, <span className="text-primary">acompanhado de perto</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Cuidadores registram sinais vitais, medicacoes e ocorrencias pelo celular —
            com assinatura facial. O supervisor acompanha tudo em tempo real.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-green-600 hover:bg-green-700">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-5 w-5" />
                Fale conosco no WhatsApp
              </a>
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Envie uma mensagem para ativar seu acesso gratuito de 30 dias.
            </p>
          </div>
        </div>
        <img
          src={heroImg}
          alt="Cuidadora segurando as maos de uma idosa sorridente"
          width={1408}
          height={928}
          className="rounded-3xl shadow-lg"
        />
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-5">
              <f.icon className="h-8 w-8 text-primary" />
              <h2 className="mt-3 font-display text-base font-bold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="mx-auto max-w-md space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={loginMode === "company" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setLoginMode("company")}
            >
              Empresa
            </Button>
            <Button
              type="button"
              variant={loginMode === "admin" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setLoginMode("admin")}
            >
              <Shield className="mr-1 h-3 w-3" />
              Administrador
            </Button>
          </div>

          {loginMode === "company" ? (
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="font-display text-lg">Ja tem acesso?</CardTitle>
                <CardDescription>Entre com os dados da sua empresa</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCompanyLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-slug">Slug da Empresa</Label>
                    <Input id="login-slug" name="slug" required maxLength={100} placeholder="minha-empresa" />
                  </div>
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
          ) : (
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="font-display text-lg">Painel Administrativo</CardTitle>
                <CardDescription>Acesso exclusivo para criadores do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAdminLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email">E-mail</Label>
                    <Input id="admin-email" name="adminEmail" type="email" required maxLength={255} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-password">Senha</Label>
                    <Input id="admin-password" name="adminPassword" type="password" required maxLength={72} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
