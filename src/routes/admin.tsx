import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { API_URL, getAuthToken } from "@/lib/api";
import { Button } from "@/components/ui/button";

function adminHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeartHandshake, Shield, LogOut, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface Company {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  subscription?: {
    plan: string;
    status: string;
    trialEndsAt?: string;
    currentPeriodEnd?: string;
  };
}

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel Administrativo — CuidarBem" },
      { name: "description", content: "Painel de gerenciamento de empresas para o CuidarBem." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("cuidarbem_user");
    if (!raw) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    try {
      const user = JSON.parse(raw);
      if (user.role !== "super_admin") {
        toast.error("Acesso não autorizado.");
        navigate({ to: "/auth", replace: true });
        return;
      }
    } catch {
      navigate({ to: "/auth", replace: true });
      return;
    }
    fetchCompanies();
  }, [navigate]);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const res = await fetch(API_URL() + "/admin/companies", {
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setCompanies(data.companies ?? data);
      }
    } catch {
      toast.error("Erro ao carregar empresas.");
    }
    setLoadingCompanies(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("cuidarbem_user");
    localStorage.removeItem("cuidarbem_token");
    toast.success("Sessão encerrada.");
    navigate({ to: "/auth", replace: true });
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim();
    const supervisorEmail = String(form.get("supervisorEmail") ?? "").trim();
    const supervisorPassword = String(form.get("supervisorPassword") ?? "");
    const supervisorFullName = String(form.get("supervisorFullName") ?? "").trim();

    if (!name || !slug || !supervisorEmail || !supervisorPassword || !supervisorFullName) {
      toast.error("Preencha todos os campos.");
      setCreating(false);
      return;
    }

    try {
      const res = await fetch(API_URL() + "/admin/companies", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          name,
          slug,
          supervisor: {
            email: supervisorEmail,
            password: supervisorPassword,
            full_name: supervisorFullName,
          },
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Empresa criada com sucesso!");
        (e.target as HTMLFormElement).reset();
        fetchCompanies();
      }
    } catch {
      toast.error("Erro ao criar empresa.");
    }
    setCreating(false);
  };

  const handleToggle = async (company: Company) => {
    setTogglingId(company.id);
    try {
      const res = await fetch(API_URL() + `/admin/companies/${company.id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ active: !company.active }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setCompanies((prev) =>
          prev.map((c) => (c.id === company.id ? { ...c, active: !c.active } : c))
        );
        toast.success(`Empresa ${company.active ? "desativada" : "ativada"}.`);
      }
    } catch {
      toast.error("Erro ao atualizar empresa.");
    }
    setTogglingId(null);
  };

  const handleExtendTrial = async (companyId: string) => {
    try {
      const res = await fetch(API_URL() + `/admin/companies/${companyId}/subscription`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ action: "extend_trial", days: 30 }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Trial estendido em 30 dias!");
        fetchCompanies();
      }
    } catch {
      toast.error("Erro ao estender trial.");
    }
  };

  const handleSetPremium = async (companyId: string) => {
    try {
      const res = await fetch(API_URL() + `/admin/companies/${companyId}/subscription`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ action: "set_plan", plan: "premium", status: "active" }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Plano Premium ativado!");
        fetchCompanies();
      }
    } catch {
      toast.error("Erro ao ativar plano.");
    }
  };

  const handleDelete = async (company: Company) => {
    if (!confirm(`Tem certeza que deseja excluir "${company.name}"? Essa acao nao pode ser desfeita.`)) return;
    setDeletingId(company.id);
    try {
      const res = await fetch(API_URL() + `/admin/companies/${company.id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Empresa "${company.name}" excluida.`);
        fetchCompanies();
      }
    } catch {
      toast.error("Erro ao excluir empresa.");
    }
    setDeletingId(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary">
            <HeartHandshake className="h-6 w-6" />
            <span className="font-display text-xl">CuidarBem</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Shield className="h-4 w-4" />
              Super Admin
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1 h-3 w-3" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Painel Administrativo — CuidarBem
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Plus className="h-5 w-5" />
              Nova Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="company-name">Nome da Empresa</Label>
                <Input id="company-name" name="name" required maxLength={200} placeholder="Minha Empresa" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-slug">Slug</Label>
                <Input id="company-slug" name="slug" required maxLength={100} placeholder="minha-empresa" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supervisor-email">E-mail do Supervisor</Label>
                <Input id="supervisor-email" name="supervisorEmail" type="email" required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supervisor-password">Senha do Supervisor</Label>
                <Input id="supervisor-password" name="supervisorPassword" type="password" required maxLength={72} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="supervisor-fullname">Nome Completo do Supervisor</Label>
                <Input id="supervisor-fullname" name="supervisorFullName" required maxLength={200} placeholder="João da Silva" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={creating}>
                  {creating ? "Criando..." : "Criar Empresa"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Empresas Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCompanies ? (
              <p className="text-sm text-muted-foreground">Carregando empresas...</p>
            ) : companies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>
            ) : (
              <div className="space-y-3">
                {companies.map((company) => {
                  const sub = company.subscription;
                  const isTrial = sub?.plan === "trial";
                  const isActive = sub?.status === "active";
                  const trialDaysLeft = sub?.trialEndsAt
                    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
                    : 0;

                  return (
                    <div
                      key={company.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{company.name}</p>
                        <p className="text-xs text-muted-foreground">/{company.slug}</p>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            isActive && isTrial
                              ? "bg-blue-100 text-blue-800"
                              : isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                          }`}>
                            {isTrial ? "Trial" : "Premium"}
                            {isActive ? " ✓" : " Expirado"}
                          </span>
                          {isTrial && sub?.trialEndsAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {trialDaysLeft}d restantes
                            </span>
                          )}
                          {!isTrial && sub?.currentPeriodEnd && (
                            <span className="text-[10px] text-muted-foreground">
                              Renova em {new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isTrial && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExtendTrial(company.id)}
                          >
                            +30d
                          </Button>
                        )}
                        {!isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetPremium(company.id)}
                          >
                            Ativar Premium
                          </Button>
                        )}
                        <Button
                          variant={company.active ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggle(company)}
                          disabled={togglingId === company.id}
                        >
                          {company.active ? (
                            <ToggleRight className="mr-1 h-4 w-4" />
                          ) : (
                            <ToggleLeft className="mr-1 h-4 w-4" />
                          )}
                          {togglingId === company.id
                            ? "..."
                            : company.active
                              ? "Ativa"
                              : "Inativa"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(company)}
                          disabled={deletingId === company.id}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          {deletingId === company.id ? "..." : "Excluir"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
