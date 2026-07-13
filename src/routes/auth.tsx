import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    setLoading(false);
    if (error) {
      toast.error("E-mail ou senha incorretos.");
      return;
    }
    navigate({ to: "/painel" });
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    if (fullName.length < 2) {
      toast.error("Informe seu nome completo.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role: "supervisor" },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("already")
          ? "Este e-mail já está cadastrado."
          : "Não foi possível criar a conta. " + error.message,
      );
      return;
    }
    toast.success("Conta criada! Verifique seu e-mail para confirmar, depois entre.");
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
            Cuidadores: use o acesso criado pelo seu supervisor. Supervisores podem criar uma conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta (supervisor)</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-2">
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
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Nome completo</Label>
                  <Input id="signup-name" name="full_name" required maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input id="signup-email" name="email" type="email" required maxLength={255} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    maxLength={72}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar conta de supervisor"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}