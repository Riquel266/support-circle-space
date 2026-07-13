import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BellRing, Users, ClipboardList, HeartPulse, CheckCircle2, ClipboardPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { RecordCard } from "@/components/RecordCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SEVERITY_LABELS, formatDateTime, type Alert, type CareRecord } from "@/lib/care";

export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelPage,
});

function PainelPage() {
  const { role, userId, isLoading } = useRole();
  const [activeTab, setActiveTab] = useState<"supervisor" | "cuidador" | "passagens">("supervisor");

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
              {tabBtn("cuidador", "Visão do Cuidador")}
            </div>
          </div>

          {activeTab === "supervisor" ? (
            <SupervisorDashboard />
          ) : activeTab === "passagens" ? (
            <HandoversTab />
          ) : (
            <CaregiverDashboard userId={userId!} />
          )}
        </div>
      ) : (
        <CaregiverDashboard userId={userId!} />
      )}
    </AppShell>
  );
}

/* ---------------- SUPERVISOR ---------------- */

function SupervisorDashboard() {
  const queryClient = useQueryClient();

  // Realtime: novos registros e alertas
  useEffect(() => {
    const channel = supabase
      .channel("painel-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "care_records" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["recent-records"] });
          toast.info("Novo registro de cuidado recebido");
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["open-alerts"] });
        toast.warning("Novo alerta gerado!");
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: elders } = useQuery({
    queryKey: ["elders"],
    queryFn: async () => {
      let remoteElders: any[] = [];
      try {
        const { data, error } = await supabase.from("elders").select("*").eq("active", true).order("full_name");
        if (!error && data) {
          remoteElders = data;
        }
      } catch (e) {
        console.warn("Failed to fetch elders from Supabase:", e);
      }

      const localEldersStr = typeof window !== "undefined" ? localStorage.getItem("local-elders") : null;
      const localElders = localEldersStr ? JSON.parse(localEldersStr) : [];

      const merged = [...remoteElders];
      localElders.forEach((local: any) => {
        if (!merged.some((m) => m.id === local.id)) {
          merged.push(local);
        }
      });
      return merged.sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["all-assignments"],
    queryFn: async () => {
      let remoteAssignments: any[] = [];
      try {
        const { data, error } = await supabase.from("assignments").select("*");
        if (!error && data) remoteAssignments = data;
      } catch (e) {
        console.warn("Failed to fetch assignments from Supabase:", e);
      }

      const localAssignStr = typeof window !== "undefined" ? localStorage.getItem("local-assignments") : null;
      const localAssigns = localAssignStr ? JSON.parse(localAssignStr) : [];

      const merged = [...remoteAssignments];
      localAssigns.forEach((local: any) => {
        if (!merged.some((m) => m.id === local.id)) {
          merged.push(local);
        }
      });
      return merged;
    },
  });

  const { data: records } = useQuery({
    queryKey: ["recent-records"],
    queryFn: async () => {
      let remoteRecords: any[] = [];
      try {
        const { data, error } = await supabase
          .from("care_records")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (!error && data) remoteRecords = data;
      } catch (e) {
        console.warn("Failed to fetch care records from Supabase:", e);
      }

      const localRecordsStr = typeof window !== "undefined" ? localStorage.getItem("local-care-records") : null;
      const localRecords = localRecordsStr ? JSON.parse(localRecordsStr) : [];

      const merged = [...remoteRecords];
      localRecords.forEach((local: any) => {
        if (!merged.some((m) => m.id === local.id)) {
          merged.push(local);
        }
      });
      return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["open-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").update({ resolved: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["open-alerts"] });
      toast.success("Alerta resolvido");
    },
  });

  const { data: shiftHandovers } = useQuery({
    queryKey: ["shift-handovers"],
    queryFn: async () => {
      let remoteHandovers: any[] = [];
      try {
        const { data, error } = await (supabase as any)
          .from("shift_handovers")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data) remoteHandovers = data;
      } catch (e) {
        console.warn("Could not fetch remote shift handovers:", e);
      }

      const localHandoversStr = typeof window !== "undefined" ? localStorage.getItem("local-shift-handovers") : null;
      const localHandovers = localHandoversStr ? JSON.parse(localHandoversStr) : [];

      const merged = [...remoteHandovers];
      localHandovers.forEach((local: any) => {
        if (!merged.some((m) => m.id === local.id)) {
          merged.push(local);
        }
      });
      return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const profileName = (id: string) => profiles?.find((p) => p.id === id)?.full_name || "Cuidador";
  const elderName = (id: string) => elders?.find((e) => e.id === id)?.full_name || "Idoso";

  const today = new Date().toDateString();
  const recordsToday = records?.filter((r) => new Date(r.created_at).toDateString() === today).length ?? 0;

  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const recentRecords = records?.filter((r: any) => new Date(r.created_at) >= twelveHoursAgo) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Painel do supervisor</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Idosos ativos" value={elders?.length ?? 0} />
        <StatCard icon={ClipboardList} label="Registros hoje" value={recordsToday} />
        <StatCard icon={BellRing} label="Alertas abertos" value={alerts?.length ?? 0} highlight={(alerts?.length ?? 0) > 0} />
        <StatCard icon={HeartPulse} label="Últimos registros" value={records?.length ?? 0} />
      </div>

      {alerts && alerts.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Alertas</h2>
          <div className="space-y-2">
            {alerts.map((alert: Alert) => (
              <Card key={alert.id} className={alert.severity === "critico" ? "border-destructive" : "border-warning"}>
                <CardContent className="flex items-center gap-3 p-4">
                  <BellRing className={`h-5 w-5 shrink-0 ${alert.severity === "critico" ? "text-destructive" : "text-warning"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={alert.severity === "critico" ? "destructive" : "secondary"}>
                        {SEVERITY_LABELS[alert.severity]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(alert.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{elderName(alert.elder_id)}</p>
                    <p className="text-sm">{alert.message}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => resolveAlert.mutate(alert.id)} disabled={resolveAlert.isPending}>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Resolver
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="bg-card border rounded-2xl p-5 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-bold flex items-center gap-2 text-foreground">
          <ClipboardList className="h-5 w-5 text-primary" />
          Resumo de cuidados (últimas 12 horas)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {elders?.map((elder) => {
            const elderRecs = recentRecords.filter((r) => r.elder_id === elder.id);
            const elderAssigns = assignments?.filter((a) => a.elder_id === elder.id) ?? [];
            const caregiverNames = elderAssigns
              .map((a) => profiles?.find((p) => p.id === a.caregiver_id)?.full_name)
              .filter(Boolean)
              .join(", ");
            return (
              <div key={elder.id} className="rounded-xl border p-4 bg-background/50 space-y-3">
                <div className="flex items-center gap-2">
                  {elder.photo_url ? (
                    <img src={elder.photo_url} alt={elder.full_name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                      {elder.full_name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-sm block truncate">{elder.full_name}</span>
                    <span className="text-xs text-muted-foreground block truncate">
                      Cuidadores: {caregiverNames || "nenhum vinculado"}
                    </span>
                  </div>
                </div>
                
                {elderRecs.length > 0 ? (
                  <div className="space-y-1.5">
                    {elderRecs.map((r) => {
                      const time = new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      let summary = "";
                      if (r.record_type === "sinais_vitais") {
                        const s = [];
                        if (r.data.pressao_sistolica) s.push(`PA: ${r.data.pressao_sistolica}/${r.data.pressao_diastolica}`);
                        if (r.data.temperatura) s.push(`T: ${r.data.temperatura}°C`);
                        summary = `Sinais vitais (${s.join(", ")})`;
                      } else if (r.record_type === "medicacao") {
                        summary = `Remédio: ${r.data.medicamento}`;
                      } else if (r.record_type === "alimentacao") {
                        summary = `Refeição: ${r.data.refeicao}`;
                      } else if (r.record_type === "diurese") {
                        summary = `Diurese: ${r.data.teve_diurese} (${r.data.aspecto})`;
                      } else if (r.record_type === "passagem_plantao") {
                        summary = `Plantão: ${r.data.estado_humor}`;
                      } else {
                        summary = `Ocorrência: ${r.data.tipo_ocorrencia}`;
                      }
                      const cgName = profiles?.find((p) => p.id === r.caregiver_id)?.full_name || "Cuidador";
                      return (
                        <div key={r.id} className="text-xs flex flex-col border-l-2 border-primary/40 pl-2 py-0.5">
                          <div className="flex justify-between gap-1 text-muted-foreground">
                            <span className="font-semibold text-foreground truncate">{summary}</span>
                            <span className="shrink-0 font-medium">{time}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">Por: {cgName}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-destructive bg-destructive/10 rounded-lg p-2 flex items-center gap-1">
                    ⚠️ Sem cuidados nas últimas 12h
                  </p>
                )}
                
                <div className="pt-2 border-t border-dashed mt-2 flex justify-end">
                  <Button size="sm" asChild variant="ghost" className="gap-1 text-xs text-primary hover:text-primary-foreground hover:bg-primary h-7 px-2">
                    <Link to="/registrar" search={{ elderId: elder.id }}>
                      <ClipboardPlus className="h-3.5 w-3.5" /> Registrar Cuidado
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
          {(!elders || elders.length === 0) && (
            <p className="text-sm text-muted-foreground col-span-full text-center">Nenhum idoso cadastrado para exibir o resumo.</p>
          )}
        </div>
      </section>

      <section className="bg-card border border-primary/20 rounded-2xl p-5 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-bold flex items-center gap-2 text-foreground">
          <ClipboardList className="h-5 w-5 text-primary" />
          Relatórios de Passagem de Plantão (Exclusivo Supervisor)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto pr-1">
          {shiftHandovers && shiftHandovers.length > 0 ? (
            shiftHandovers.map((sh) => {
              const elder = elders?.find((e) => e.id === sh.elder_id);
              const cg = profiles?.find((p) => p.id === sh.caregiver_id);
              return (
                <div key={sh.id} className="p-4 rounded-xl border bg-background/40 hover:bg-background/80 transition-colors space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2 border-b pb-2 mb-2">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Idoso</span>
                        <span className="font-semibold text-xs text-foreground truncate max-w-[120px] block">{elder?.full_name || "Idoso"}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block">Data e Hora</span>
                        <span className="font-medium text-[10px] text-foreground">{formatDateTime(sh.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="text-muted-foreground">
                        Cuidador: <strong className="text-foreground">{cg?.full_name || "Cuidador"}</strong>
                      </p>
                      <p className="text-muted-foreground">
                        Humor do idoso: <Badge variant="secondary" className="text-[9px] py-0 px-1">{sh.estado_humor}</Badge>
                      </p>
                      <p className="text-muted-foreground mt-2 bg-secondary/20 p-2 rounded border italic">
                        “{sh.resumo_plantao}”
                      </p>
                      {sh.intercorrencias && sh.intercorrencias !== "nenhuma" && (
                        <p className="text-destructive font-semibold mt-1">
                          ⚠️ Intercorrências: {sh.intercorrencias}
                        </p>
                      )}
                      {sh.notes && (
                        <p className="text-muted-foreground mt-1">
                          Nota: {sh.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 col-span-full">Nenhum relatório de plantão recebido.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Atividade em tempo real</h2>
        {records && records.length > 0 ? (
          <div className="space-y-2">
            {records.map((r: CareRecord) => (
              <RecordCard key={r.id} record={r} elderName={elderName(r.elder_id)} caregiverName={profileName(r.caregiver_id)} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhum registro ainda. Cadastre idosos e cuidadores para começar.
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

/* ---------------- CUIDADOR ---------------- */

function CaregiverDashboard({ userId }: { userId: string }) {
  const { role } = useRole();
  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", userId, role],
    queryFn: async () => {
      if (role === "supervisor") {
        let remoteElders: any[] = [];
        try {
          const { data, error } = await supabase.from("elders").select("*").eq("active", true).order("full_name");
          if (!error && data) remoteElders = data;
        } catch (e) {
          console.warn(e);
        }

        const localEldersStr = typeof window !== "undefined" ? localStorage.getItem("local-elders") : null;
        const localElders = localEldersStr ? JSON.parse(localEldersStr) : [];

        const merged = [...remoteElders];
        localElders.forEach((local: any) => {
          if (!merged.some((m) => m.id === local.id)) {
            merged.push(local);
          }
        });

        return merged.map((e) => ({
          elder_id: e.id,
          elders: e,
        }));
      }

      let remoteAssignments: any[] = [];
      try {
        const { data, error } = await supabase
          .from("assignments")
          .select("elder_id, elders(*)")
          .eq("caregiver_id", userId);
        if (!error && data) remoteAssignments = data;
      } catch (e) {
        console.warn("Failed to fetch caregiver assignments:", e);
      }

      const localAssignStr = typeof window !== "undefined" ? localStorage.getItem("local-assignments") : null;
      const localAssigns = localAssignStr ? JSON.parse(localAssignStr) : [];
      const localMyAssigns = localAssigns.filter((a: any) => a.caregiver_id === userId);

      const localEldersStr = typeof window !== "undefined" ? localStorage.getItem("local-elders") : null;
      const localElders = localEldersStr ? JSON.parse(localEldersStr) : [];

      const merged = [...remoteAssignments];
      localMyAssigns.forEach((la: any) => {
        if (!merged.some((m) => m.elder_id === la.elder_id)) {
          const elder = localElders.find((e: any) => e.id === la.elder_id);
          if (elder) {
            merged.push({
              elder_id: la.elder_id,
              elders: elder,
            });
          }
        }
      });
      return merged;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      let remoteProfiles: any[] = [];
      try {
        const { data, error } = await supabase.from("profiles").select("*");
        if (!error && data) remoteProfiles = data;
      } catch (e) {
        console.warn(e);
      }
      return remoteProfiles;
    },
  });

  const assignedElderIds = assignments?.map((a) => a.elder_id) || [];

  const { data: realTimeObservations } = useQuery({
    queryKey: ["realtime-observations", assignedElderIds],
    enabled: assignedElderIds.length > 0,
    queryFn: async () => {
      let remoteRecords: any[] = [];
      try {
        const { data, error } = await supabase
          .from("care_records")
          .select("*")
          .in("elder_id", assignedElderIds)
          .order("created_at", { ascending: false })
          .limit(20);
        if (!error && data) remoteRecords = data;
      } catch (e) {
        console.warn("Failed to fetch realtime observations:", e);
      }

      const localRecordsStr = typeof window !== "undefined" ? localStorage.getItem("local-care-records") : null;
      const localRecords = localRecordsStr ? JSON.parse(localRecordsStr) : [];
      const localAssigned = localRecords.filter((r: any) => assignedElderIds.includes(r.elder_id));

      const merged = [...remoteRecords];
      localAssigned.forEach((local: any) => {
        if (!merged.some((m) => m.id === local.id)) {
          merged.push(local);
        }
      });
      return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const { data: myRecords } = useQuery({
    queryKey: ["my-records", userId],
    queryFn: async () => {
      let remoteRecords: any[] = [];
      try {
        const { data, error } = await supabase
          .from("care_records")
          .select("*")
          .eq("caregiver_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);
        if (!error && data) remoteRecords = data;
      } catch (e) {
        console.warn(e);
      }

      const localRecordsStr = typeof window !== "undefined" ? localStorage.getItem("local-care-records") : null;
      const localRecords = localRecordsStr ? JSON.parse(localRecordsStr) : [];
      const userLocalRecords = localRecords.filter((r: any) => r.caregiver_id === userId);

      const merged = [...remoteRecords];
      userLocalRecords.forEach((local: any) => {
        if (!merged.some((m) => m.id === local.id)) {
          merged.push(local);
        }
      });
      return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

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
        <h2 className="mb-3 font-display text-lg font-bold">Idosos sob meus cuidados</h2>
        {assignments && assignments.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {assignments.map((a) => {
              const elder = a.elders;
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
              Nenhum idoso vinculado ainda. Peça ao seu supervisor para vincular você.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="bg-card border rounded-2xl p-5 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary animate-pulse" />
          Observações em tempo real
        </h2>
        {realTimeObservations && realTimeObservations.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {realTimeObservations.map((r) => {
              const elder = assignments?.find((a) => a.elder_id === r.elder_id)?.elders;
              const elderNameStr = elder?.full_name || "Idoso";
              const caregiverNameStr = profiles?.find((p) => p.id === r.caregiver_id)?.full_name || "Cuidador";
              return (
                <RecordCard
                  key={r.id}
                  record={r}
                  elderName={elderNameStr}
                  caregiverName={caregiverNameStr}
                  showSelfie={false}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic bg-secondary/35 p-3 rounded-lg text-center">
            Nenhuma observação ou cuidado registrado em tempo real para os seus idosos.
          </p>
        )}
      </section>



      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Meus últimos registros</h2>
        <div className="space-y-2">
          {myRecords?.map((r) => <RecordCard key={r.id} record={r} showSelfie={false} />)}
          {(!myRecords || myRecords.length === 0) && (
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
