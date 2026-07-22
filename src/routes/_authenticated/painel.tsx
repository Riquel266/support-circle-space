import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { BellRing, Users, ClipboardList, HeartPulse, CheckCircle2, ClipboardPlus, FileDown, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { RecordCard } from "@/components/RecordCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SEVERITY_LABELS, formatDateTime, type Alert, type CareRecord } from "@/lib/care";

const API_URL = () => `/api`;

export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelPage,
});

function PainelPage() {
  const { role, userId, isLoading } = useRole();
  const [activeTab, setActiveTab] = useState<"supervisor" | "passagens" | "localizacao">("supervisor");

  if (!isLoading && role !== "supervisor") {
    return (
      <AppShell>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Apenas supervisores podem acessar o Painel.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const tabBtn = (id: typeof activeTab, label: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-1.5 font-display text-sm font-semibold rounded-lg transition-all ${
        activeTab === id
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <AppShell>
      {isLoading || !role ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : role === "supervisor" ? (
        <div className="space-y-6">
          <div className="flex justify-center mb-6">
            <div className="inline-flex flex-wrap justify-center rounded-xl bg-secondary p-1 border gap-1">
              {tabBtn("supervisor", "Painel Supervisor (Adm)")}
              {tabBtn("passagens", "Passagens de Plantão")}
              {tabBtn("localizacao", "Localização")}
            </div>
          </div>

          {activeTab === "supervisor" ? (
            <SupervisorDashboard />
          ) : activeTab === "passagens" ? (
            <HandoversTab />
          ) : (
            <LocationTab />
          )}
        </div>
      ) : (
        <CaregiverDashboard userId={userId!} />
      )}
    </AppShell>
  );
}

function SupervisorDashboard() {
  const { userId, userName } = useRole();
  const queryClient = useQueryClient();

  const { data: elders } = useQuery({
    queryKey: ["elders"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/elders`);
      const data = await res.json();
      return data.sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
    },
  });

  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/caregivers`);
      return res.json();
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["all-assignments"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/assignments`);
      return res.json();
    },
  });

  const { data: records } = useQuery({
    queryKey: ["recent-records"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/records`);
      const data = await res.json();
      return data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["open-alerts"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/records`);
      const data = await res.json();
      return data.filter((r: any) => r.record_type === "alerta" && !r.resolved);
    },
  });

  const profileName = (id: string) => {
    const found = caregivers?.find((c: any) => c.id === id);
    if (found) return found.full_name;
    if (id === userId) return userName || "Supervisor";
    return "Desconhecido";
  };
  const elderName = (id: string) => elders?.find((e: any) => e.id === id)?.full_name || "Paciente";

  const today = new Date().toDateString();
  const recordsToday = records?.filter((r: any) => new Date(r.created_at).toDateString() === today).length ?? 0;

  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const recentRecords = records?.filter((r: any) => new Date(r.created_at) >= twelveHoursAgo) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Painel do supervisor</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Pacientes ativos" value={elders?.length ?? 0} />
        <StatCard icon={ClipboardList} label="Registros hoje" value={recordsToday} />
        <StatCard icon={BellRing} label="Alertas abertos" value={alerts?.length ?? 0} highlight={(alerts?.length ?? 0) > 0} />
        <StatCard icon={HeartPulse} label="Últimos registros" value={records?.length ?? 0} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Atividade recente</h2>
        {records && records.length > 0 ? (
          <div className="space-y-2">
            {records.map((r: any) => (
              <RecordCard key={r.id} record={r} elderName={elderName(r.elder_id)} caregiverName={profileName(r.caregiver_id)} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhum registro ainda. Cadastre pacientes e cuidadores para começar.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: typeof Users; label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-destructive" : undefined}>
      <CardContent className="p-4">
        <Icon className={`h-5 w-5 ${highlight ? "text-destructive" : "text-primary"}`} />
        <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function HandoversTab() {
  const { userId, userName } = useRole();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: records } = useQuery({
    queryKey: ["all-records"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/records`);
      const data = await res.json();
      return data.filter((r: any) => r.record_type === "passagem_plantao").sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const { data: elders } = useQuery({
    queryKey: ["elders"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/elders`);
      return res.json();
    },
  });

  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/caregivers`);
      return res.json();
    },
  });

  const filtered = (records ?? []).filter((r: any) => {
    const t = new Date(r.created_at).getTime();
    if (from) {
      const f = new Date(from + "T00:00:00").getTime();
      if (t < f) return false;
    }
    if (to) {
      const tEnd = new Date(to + "T23:59:59").getTime();
      if (t > tEnd) return false;
    }
    return true;
  });

  const handleDownload = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum registro para baixar.");
      return;
    }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;

    const nameOf = (id: string) =>
      id === userId
        ? userName || "Supervisor"
        : caregivers?.find((c: any) => c.id === id)?.full_name || "Desconhecido";

    doc.setFillColor(34, 102, 68);
    doc.rect(0, 0, pageWidth, 90, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("CuidarBem", marginX, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Relatório de Passagens de Plantão", marginX, 58);
    doc.setFontSize(9);
    doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, marginX, 76);

    let y = 110;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    if (from || to) {
      const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
      const label = from && to
        ? `Período: ${fmt(from)} a ${fmt(to)}`
        : from
          ? `A partir de ${fmt(from)}`
          : `Até ${fmt(to!)}`;
      doc.text(label, marginX, y);
    } else {
      doc.text("Todos os registros", marginX, y);
    }
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(`Total: ${filtered.length} passagem(ns) de plantão`, marginX, y);
    y += 20;

    const bodyRows = filtered.map((r: any) => {
      const elder = elders?.find((e: any) => e.id === r.elder_id);
      const d = new Date(r.created_at);
      return [
        elder?.full_name || "—",
        nameOf(r.caregiver_id),
        d.toLocaleDateString("pt-BR"),
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        r.data?.estado_humor || "—",
        r.data?.resumo_plantao || "—",
        r.data?.intercorrencias && r.data.intercorrencias !== "nenhuma"
          ? r.data.intercorrencias
          : "Nenhuma",
        r.data?.notes || "",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Paciente", "Cuidador", "Data", "Hora", "Humor", "Resumo", "Intercorrências", "Nota"]],
      body: bodyRows,
      styles: { fontSize: 8, cellPadding: 4, valign: "top", overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 70 },
        4: { cellWidth: 50 },
        6: { cellWidth: 65 },
      },
      headStyles: { fillColor: [34, 102, 68], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 250, 247] },
      margin: { left: marginX, right: marginX },
      didDrawPage: (data: any) => {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const pageH = doc.internal.pageSize.getHeight();
        doc.text(
          `CuidarBem — Página ${doc.getNumberOfPages()}`,
          marginX,
          pageH - 20,
        );
        doc.text(
          `Passagens de Plantão`,
          pageWidth - marginX,
          pageH - 20,
          { align: "right" },
        );
      },
    });

    const safeName = `passagens_plantao${from ? "_" + from : ""}${to ? "_" + to : ""}`;
    doc.save(`${safeName}.pdf`);
    toast.success("Relatório PDF baixado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Passagens de Plantão
        </h1>
        <Badge variant="secondary">Exclusivo Supervisor</Badge>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="from">De</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Até</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
          </div>
          {(from || to) && (
            <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>
              Limpar filtro
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} registro{filtered.length === 1 ? "" : "s"}
          </span>
          {filtered.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
              <FileDown className="h-4 w-4" /> Baixar PDF
            </Button>
          )}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            Nenhuma passagem de plantão no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r: any) => {
            const elder = elders?.find((e: any) => e.id === r.elder_id);
            const cg = caregivers?.find((c: any) => c.id === r.caregiver_id);
            return (
              <div key={r.id} className="p-4 rounded-xl border bg-background/40 space-y-2">
                <div className="flex justify-between items-start gap-2 border-b pb-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Paciente</span>
                    <span className="font-semibold text-xs text-foreground block">{elder?.full_name || "Paciente"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Data e Hora</span>
                    <span className="font-medium text-[11px] text-foreground">{formatDateTime(r.created_at)}</span>
                  </div>
                </div>
                <div className="text-xs space-y-1">
                  <p className="text-muted-foreground">
                    Cuidador: <strong className="text-foreground">{cg?.full_name || "Cuidador"}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Humor: <Badge variant="secondary" className="text-[9px] py-0 px-1">{r.data?.estado_humor}</Badge>
                  </p>
                  <p className="text-muted-foreground mt-2 bg-secondary/20 p-2 rounded border italic">
                    "{r.data?.resumo_plantao}"
                  </p>
                  {r.data?.intercorrencias && r.data.intercorrencias !== "nenhuma" && (
                    <p className="text-destructive font-semibold mt-1">
                      Intercorrências: {r.data.intercorrencias}
                    </p>
                  )}
                  {r.data?.notes && <p className="text-muted-foreground mt-1">Nota: {r.data.notes}</p>}
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => {
                      const doc = new jsPDF({ unit: "pt", format: "a4" });
                      const pageWidth = doc.internal.pageSize.getWidth();
                      const marginX = 40;

                      doc.setFillColor(34, 102, 68);
                      doc.rect(0, 0, pageWidth, 70, "F");
                      doc.setTextColor(255, 255, 255);
                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(16);
                      doc.text("CuidarBem", marginX, 30);
                      doc.setFont("helvetica", "normal");
                      doc.setFontSize(10);
                      doc.text("Passagem de Plantão", marginX, 48);
                      doc.setFontSize(9);
                      doc.text(formatDateTime(r.created_at), marginX, 62);

                      let y = 90;
                      doc.setTextColor(20, 20, 20);

                      const addField = (label: string, value: string) => {
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(10);
                        doc.text(label, marginX, y);
                        doc.setFont("helvetica", "normal");
                        doc.text(value || "—", marginX + 80, y);
                        y += 16;
                      };

                      addField("Paciente:", elder?.full_name || "—");
                      addField("Cuidador:", cg?.full_name || "—");
                      y += 4;

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(12);
                      doc.text("Resumo do Plantão", marginX, y);
                      y += 16;
                      doc.setFont("helvetica", "normal");
                      doc.setFontSize(10);
                      const resumoSplit = doc.splitTextToSize(r.data?.resumo_plantao || "—", pageWidth - marginX * 2);
                      doc.text(resumoSplit, marginX, y);
                      y += resumoSplit.length * 13 + 6;

                      addField("Estado de humor:", r.data?.estado_humor || "—");

                      if (r.data?.intercorrencias && r.data.intercorrencias !== "nenhuma") {
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(180, 40, 40);
                        doc.setFontSize(10);
                        doc.text("Intercorrências:", marginX, y);
                        doc.setFont("helvetica", "normal");
                        doc.text(r.data.intercorrencias, marginX + 90, y);
                        y += 16;
                        doc.setTextColor(20, 20, 20);
                      }

                      if (r.data?.notes) {
                        addField("Observação:", r.data.notes);
                      }

                      const pageCount = doc.getNumberOfPages();
                      for (let i = 1; i <= pageCount; i++) {
                        doc.setPage(i);
                        doc.setFontSize(8);
                        doc.setTextColor(150, 150, 150);
                        doc.text(`CuidarBem — Página ${i} de ${pageCount}`, pageWidth - marginX, doc.internal.pageSize.getHeight() - 20, { align: "right" });
                      }

                      const safeName = (elder?.full_name || "paciente").replace(/[^\p{L}\p{N}]+/gu, "_");
                      const dateStr = new Date(r.created_at).toISOString().slice(0, 10);
                      doc.save(`plantao_${safeName}_${dateStr}.pdf`);
                    }}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Baixar PDF
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CaregiverDashboard({ userId }: { userId: string }) {
  const { userName } = useRole();
  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", userId],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/assignments`);
      const all = await res.json();
      return all.filter((a: any) => a.caregiver_id === userId);
    },
  });

  const { data: elders } = useQuery({
    queryKey: ["elders"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/elders`);
      return res.json();
    },
  });

  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/caregivers`);
      return res.json();
    },
  });

  const { data: records } = useQuery({
    queryKey: ["my-records", userId],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/records`);
      const all = await res.json();
      return all.filter((r: any) => r.caregiver_id === userId).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const assignedElderIds = assignments?.map((a: any) => a.elder_id) || [];

  const { data: recentForMyElders } = useQuery({
    queryKey: ["elders-records", assignedElderIds],
    enabled: assignedElderIds.length > 0,
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/records`);
      const all = await res.json();
      return all
        .filter((r: any) => assignedElderIds.includes(r.elder_id))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);
    },
  });

  const profileName = (id: string) => {
    const found = caregivers?.find((c: any) => c.id === id);
    if (found) return found.full_name;
    if (id === userId) return userName || "Supervisor";
    return "Desconhecido";
  };
  const elderName = (id: string) => elders?.find((e: any) => e.id === id)?.full_name || "Paciente";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Meus cuidados</h1>
        <Button asChild>
          <Link to="/registrar">
            <ClipboardPlus className="mr-1 h-4 w-4" /> Novo registro
          </Link>
        </Button>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Pacientes sob meus cuidados</h2>
        {assignments && assignments.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {assignments.map((a: any) => {
              const elder = elders?.find((e: any) => e.id === a.elder_id);
              if (!elder) return null;
              return (
                <Card key={a.elder_id} className="transition-shadow hover:shadow-md flex flex-col justify-between">
                  <div>
                    <CardHeader className="pb-2">
                      <CardTitle className="font-display text-base">
                        <Link to="/idosos/$elderId" params={{ elderId: a.elder_id }} className="hover:underline hover:text-primary">
                          {elder.full_name}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-muted-foreground">
                      {elder.medical_notes ? elder.medical_notes.slice(0, 80) : "Ver histórico completo"}
                    </CardContent>
                  </div>
                  <div className="p-4 pt-0 flex justify-end">
                    <Button size="sm" asChild variant="outline" className="gap-1 text-xs">
                      <Link to="/registrar" search={{ elderId: a.elder_id }}>
                        <ClipboardPlus className="h-3.5 w-3.5" /> Registrar Cuidado
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhum paciente vinculado ainda. Peça ao seu supervisor para vincular você.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="bg-card border rounded-2xl p-5 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary animate-pulse" />
          Observações em tempo real
        </h2>
        {recentForMyElders && recentForMyElders.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {recentForMyElders.map((r: any) => (
              <RecordCard
                key={r.id}
                record={r}
                elderName={elderName(r.elder_id)}
                caregiverName={profileName(r.caregiver_id)}
                showSelfie={false}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic bg-secondary/35 p-3 rounded-lg text-center">
            Nenhuma observação ou cuidado registrado em tempo real para os seus pacientes.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Meus últimos registros</h2>
        <div className="space-y-2">
          {records?.map((r: any) => <RecordCard key={r.id} record={r} showSelfie={false} />)}
          {(!records || records.length === 0) && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Você ainda não fez registros hoje.
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

function LocationTab() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/caregivers`);
      return res.json();
    },
  });

  const fetchLocations = async () => {
    try {
      const res = await fetch(`${API_URL()}/caregiver-locations`);
      const data = await res.json();
      setLocations(data);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 15000);
    return () => clearInterval(interval);
  }, []);

  const caregiverName = (id: string) =>
    caregivers?.find((c: any) => c.id === id)?.full_name || "Desconhecido";

  const caregiverPhoto = (id: string) =>
    caregivers?.find((c: any) => c.id === id)?.photo_url || null;

  const now = Date.now();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          Localização dos Cuidadores
        </h1>
        <Badge variant="secondary">Atualiza a cada 15s</Badge>
      </div>

      {locations.length > 0 && (
        <Card className="overflow-hidden">
          <div className="h-[400px] w-full bg-secondary relative">
            <LocationMap locations={locations} caregivers={caregivers} />
          </div>
        </Card>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">
          Cuidadores ({locations.length})
        </h2>
        {loading ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Carregando localizações...
            </CardContent>
          </Card>
        ) : locations.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhuma localização registrada ainda. Os cuidadores precisam ter o GPS ativo no celular.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc: any) => {
              const diffMs = now - new Date(loc.updated_at).getTime();
              const diffMin = Math.floor(diffMs / 60000);
              const isRecent = diffMin < 5;
              return (
                <Card key={loc.caregiver_id} className={isRecent ? "border-success/50" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {caregiverPhoto(loc.caregiver_id) ? (
                        <img
                          src={caregiverPhoto(loc.caregiver_id)}
                          alt={caregiverName(loc.caregiver_id)}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
                          {caregiverName(loc.caregiver_id).charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">
                          {caregiverName(loc.caregiver_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isRecent ? (
                            <span className="text-success">Ativo agora</span>
                          ) : (
                            <span>Há {diffMin} min</span>
                          )}
                        </p>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button variant="ghost" size="sm" className="gap-1 text-xs">
                          <MapPin className="h-3.5 w-3.5" />
                          Abrir mapa
                        </Button>
                      </a>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground truncate">
                      {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function LocationMap({ locations, caregivers }: { locations: any[]; caregivers: any[] }) {
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("react-leaflet"),
      import("leaflet/dist/leaflet.css"),
      import("leaflet"),
    ]).then(([rl, _css, L]) => {
      if (cancelled) return;
      (window as any).L = L.default;
      delete (L.default as any).Icon.Default.prototype._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setMapContainer(() => rl.MapContainer);
      setTileLayer(() => rl.TileLayer);
      setMarker(() => rl.Marker);
      setPopup(() => rl.Popup);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!ready || !MapContainer) {
    return <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Carregando mapa...</div>;
  }

  const avgLat = locations.reduce((s, l) => s + l.lat, 0) / locations.length;
  const avgLng = locations.reduce((s, l) => s + l.lng, 0) / locations.length;

  const caregiverName = (id: string) =>
    caregivers?.find((c: any) => c.id === id)?.full_name || "Desconhecido";

  return (
    <MapContainer
      center={[avgLat, avgLng]}
      zoom={13}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc: any) => (
        <Marker key={loc.caregiver_id} position={[loc.lat, loc.lng]}>
          <Popup>
            <strong>{caregiverName(loc.caregiver_id)}</strong>
            <br />
            {new Date(loc.updated_at).toLocaleString("pt-BR")}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
