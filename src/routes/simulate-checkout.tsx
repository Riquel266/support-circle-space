import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { HeartHandshake, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";

export const Route = createFileRoute("/simulate-checkout")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
  component: SimulateCheckoutPage,
});

function SimulateCheckoutPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token de pagamento invalido.");
      return;
    }

    setStatus("processing");
    setMessage("Processando pagamento...");

    const timer = setTimeout(() => {
      fetch(`${API_URL()}/subscription/simulate-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setStatus("success");
            setMessage(data.message || "Plano premium ativado com sucesso!");
          } else {
            setStatus("error");
            setMessage(data.error || "Erro ao processar pagamento.");
          }
        })
        .catch(() => {
          setStatus("error");
          setMessage("Erro ao conectar com o servidor.");
        });
    }, 2000);

    return () => clearTimeout(timer);
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-6 flex items-center gap-2 font-bold text-primary">
        <HeartHandshake className="h-8 w-8" />
        <span className="font-display text-2xl">CuidarBem</span>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-display">
            {status === "success" ? "Pagamento Confirmado" : status === "error" ? "Erro no Pagamento" : "Processando Pagamento"}
          </CardTitle>
          <CardDescription>
            {status === "processing" ? "Aguarde enquanto confirmamos seu pagamento..." : message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "processing" && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-center text-sm text-muted-foreground">
                Seu plano premium foi ativado. Acesse o painel para acompanhar a localizacao dos cuidadores em tempo real.
              </p>
              <Button className="w-full" onClick={() => navigate({ to: "/painel", replace: true })}>
                Ir para o Painel
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-red-500" />
              <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/billing", replace: true })}>
                Voltar para Planos
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
