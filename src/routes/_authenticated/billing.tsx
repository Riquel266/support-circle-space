import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { HeartHandshake, Lock, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { API_URL, getAuthToken } from "@/lib/api";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/billing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Planos — CuidarBem" },
      { name: "description", content: "Escolha um plano para o CuidarBem." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { companyId } = useRole();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL()}/subscription/${companyId}`, {
      headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
    })
      .then((r) => r.json())
      .then((data) => setSubscription(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  const handleStripeCheckout = async () => {
    try {
      const res = await fetch(`${API_URL()}/subscription/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        },
        body: JSON.stringify({ companyId, priceId: "premium_monthly" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Pagamento ainda nao configurado.");
      }
    } catch {
      toast.error("Erro ao criar sessao de pagamento.");
    }
  };

  const handleGooglePlay = () => {
    toast.info("Abra o app no Android para assinar via Google Play.");
  };

  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  const trialDaysLeft = subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/painel" className="flex items-center gap-2 font-bold text-primary">
            <HeartHandshake className="h-6 w-6" />
            <span className="font-display text-xl">CuidarBem</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/painel" })}>
            Voltar
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Escolha seu plano
          </h1>
          <p className="mt-2 text-muted-foreground">
            Acompanhe a localizacao dos cuidadores em tempo real
          </p>
        </div>

        {subscription && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Plano atual: {subscription.plan === "trial" ? "Trial" : "Premium"}
                  {subscription.status === "active" ? " (Ativo)" : " (Expirado)"}
                </p>
                {subscription.plan === "trial" && subscription.trialEndsAt && (
                  <p className="text-xs text-blue-600">
                    {trialDaysLeft} dias restantes de trial
                  </p>
                )}
              </div>
              {subscription.locationAllowed && (
                <span className="text-sm font-semibold text-green-600">✓ Localizacao ativa</span>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <CardHeader className="relative">
              <CardTitle className="font-display text-xl">Trial Gratuito</CardTitle>
              <CardDescription>Teste por 30 dias</CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <p className="text-3xl font-bold">Grátis</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Localizacao em tempo real</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Registro de cuidados</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Relatórios PDF</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Até 30 dias</li>
              </ul>
              {subscription?.plan === "trial" ? (
                <Button disabled className="w-full">Plano atual</Button>
              ) : (
                <Button disabled variant="outline" className="w-full">Indisponivel</Button>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-primary shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <div className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
              POPULAR
            </div>
            <CardHeader className="relative">
              <CardTitle className="font-display text-xl">Premium</CardTitle>
              <CardDescription>Acesso completo</CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <p className="text-3xl font-bold">R$ 600<span className="text-base font-normal text-muted-foreground">/mês</span></p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Tudo do Trial</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Sem limite de tempo</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Suporte prioritário</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Atualizacoes futuras</li>
              </ul>
              {subscription?.plan === "premium" && subscription?.status === "active" ? (
                <Button disabled className="w-full">Plano atual</Button>
              ) : (
                <Button className="w-full" onClick={isAndroid ? handleGooglePlay : handleStripeCheckout}>
                  {isAndroid ? (
                    <>Assinar via Google Play</>
                  ) : (
                    <>Assinar agora <ExternalLink className="ml-1 h-4 w-4" /></>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
