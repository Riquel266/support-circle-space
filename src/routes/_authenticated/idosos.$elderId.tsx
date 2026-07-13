import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, BellRing, CalendarIcon, FileDown, ClipboardPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { RecordCard } from "@/components/RecordCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { calcAge, formatDateTime, SEVERITY_LABELS } from "@/lib/care";
import { generateElderReport } from "@/lib/report";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/idosos/$elderId")({
  component: ElderDetailPage,
});

function ElderDetailPage() {
  const { elderId } = Route.useParams();
  const { role } = useRole();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: elder, isLoading } = useQuery({
    queryKey: ["elder", elderId],
    queryFn: async () => {
      let remoteElder = null;
      try {
        const { data, error } = await supabase.from("elders").select("*").eq("id", elderId).maybeSingle();
        if (!error) remoteElder = data;
      } catch (e) {
        console.warn("Failed to fetch elder from Supabase:", e);
      }

      if (remoteElder) return remoteElder;

      // Se não achar no Supabase, procura no localStorage
      const localEldersStr = typeof window !== "undefined" ? localStorage.getItem("local-elders") : null;
      const localElders = localEldersStr ? JSON.parse(localEldersStr) : [];
      return localElders.find((e: any) => e.id === elderId) || null;
    },
  });

  const { data: records } = useQuery({
    queryKey: ["elder-records", elderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_records")
        .select("*")
        .eq("elder_id", elderId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
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

  const { data: alerts } = useQuery({
    queryKey: ["elder-alerts", elderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("elder_id", elderId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const profileName = (id: string) => profiles?.find((p) => p.id === id)?.full_name || "Cuidador";

  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    if (fromDate && t < new Date(fromDate + "T00:00:00").getTime()) return false;
    if (toDate && t > new Date(toDate + "T23:59:59").getTime()) return false;
    return true;
  };

  const filteredRecords = useMemo(
    () => (records ?? []).filter((r) => inRange(r.created_at)),
    [records, fromDate, toDate],
  );
  const filteredAlerts = useMemo(
    () => (alerts ?? []).filter((a) => inRange(a.created_at)),
    [alerts, fromDate, toDate],
  );

  const handleDownload = () => {
    if (!elder) return;
    try {
      generateElderReport({
        elder,
        records: filteredRecords,
        alerts: filteredAlerts,
        profiles: profiles ?? [],
        range: { from: fromDate || null, to: toDate || null },
      });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o relatório.");
    }
  };

  return (
    <AppShell>
      <Link to="/idosos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Voltar para idosos
      </Link>

      {isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : elder ? (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            {elder.photo_url ? (
              <img
                src={elder.photo_url}
                alt={elder.full_name}
                className="h-16 w-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-2xl font-bold text-secondary-foreground">
                {elder.full_name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-bold">{elder.full_name}</h1>
              {elder.birth_date && <p className="text-sm text-muted-foreground">{calcAge(elder.birth_date)}</p>}
              {elder.medical_notes && <p className="mt-1 text-sm">{elder.medical_notes}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="gap-1.5">
                <Link to="/registrar" search={{ elderId: elder.id }}>
                  <ClipboardPlus className="h-4 w-4 text-primary" />
                  Registrar Cuidado
                </Link>
              </Button>

              {role === "supervisor" && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {fromDate || toDate ? "Período selecionado" : "Filtrar período"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="from-date">De</Label>
                        <Input id="from-date" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="to-date">Até</Label>
                        <Input id="to-date" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
                      </div>
                      {(fromDate || toDate) && (
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => { setFromDate(""); setToDate(""); }}>
                          Limpar filtro
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>
                  <Button onClick={handleDownload} className="gap-2">
                    <FileDown className="h-4 w-4" /> Baixar relatório PDF
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="p-6 text-center text-muted-foreground">Idoso não encontrado.</CardContent>
        </Card>
      )}

      {filteredAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-lg font-bold">Alertas recentes</h2>
          <div className="space-y-2">
            {filteredAlerts.map((alert) => (
              <Card key={alert.id} className={alert.resolved ? "opacity-60" : alert.severity === "critico" ? "border-destructive" : "border-warning"}>
                <CardContent className="flex items-center gap-3 p-4">
                  <BellRing className={`h-5 w-5 shrink-0 ${alert.severity === "critico" ? "text-destructive" : "text-warning"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={alert.severity === "critico" ? "destructive" : "secondary"}>{SEVERITY_LABELS[alert.severity]}</Badge>
                      {alert.resolved && <Badge variant="outline">Resolvido</Badge>}
                      <span className="text-xs text-muted-foreground">{formatDateTime(alert.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm">{alert.message}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Histórico de cuidados</h2>
        <div className="space-y-2">
          {filteredRecords.map((r) => (
            <RecordCard key={r.id} record={r} caregiverName={profileName(r.caregiver_id)} showSelfie={role === "supervisor"} />
          ))}
          {filteredRecords.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                {fromDate || toDate ? "Nenhum registro no período selecionado." : "Nenhum registro ainda."}
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </AppShell>
  );
}