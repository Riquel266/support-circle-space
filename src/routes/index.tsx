import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { HeartHandshake, HeartPulse, Camera, BellRing, Users } from "lucide-react";
import heroImg from "@/assets/hero-cuidado.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
  component: Index,
});

const FEATURES = [
  {
    icon: HeartPulse,
    title: "Sinais vitais e medicações",
    text: "Pressão, temperatura, glicemia, batimentos e confirmação de remédios em segundos.",
  },
  {
    icon: Camera,
    title: "Assinatura facial",
    text: "Cada registro traz a selfie do cuidador que o realizou — transparência total.",
  },
  {
    icon: BellRing,
    title: "Alertas automáticos",
    text: "Valores fora do normal geram alertas imediatos para o supervisor.",
  },
  {
    icon: Users,
    title: "Painel do supervisor",
    text: "Acompanhe em tempo real o que cada cuidador registra pelo celular.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2 font-bold text-primary">
          <HeartHandshake className="h-7 w-7" />
          <span className="font-display text-xl">CuidarBem</span>
        </div>
        <Button asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
            Cuidado com idosos, <span className="text-primary">acompanhado de perto</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Cuidadores registram sinais vitais, medicações, alimentação e ocorrências pelo celular —
            com assinatura facial. O supervisor acompanha tudo em tempo real.
          </p>
          <div className="mt-6 flex gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Começar agora</Link>
            </Button>
          </div>
        </div>
        <img
          src={heroImg}
          alt="Cuidadora segurando as mãos de uma idosa sorridente"
          width={1408}
          height={928}
          className="rounded-3xl shadow-lg"
        />
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
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
    </div>
  );
}
