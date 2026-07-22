import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardPlus,
  LogIn,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { calcAge } from "@/lib/care";
import { getCurrentPosition, isWithinRadius, haversineDistance } from "@/lib/geo";

const API_URL = () => `/api`;

export const Route = createFileRoute("/_authenticated/idosos/$elderId")({
  component: ElderDetailPage,
});

function ElderDetailPage() {
  const { role } = useRole();

  if (role === "cuidador") {
    return <CuidadorElderView />;
  }
  return <SupervisorElderView />;
}

function CuidadorElderView() {
  const { elderId } = Route.useParams();
  const { userId } = useRole();
  const queryClient = useQueryClient();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const { data: elder, isLoading } = useQuery({
    queryKey: ["elder", elderId],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/elders`);
      const data = await res.json();
      return data.find((e: any) => e.id === elderId) || null;
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["my-attendance", userId],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/attendance?caregiver_id=${userId}`);
      return res.json();
    },
  });

  const todayRecords = (attendance as any[]).filter(
    (a: any) => {
      const d = new Date(a.created_at);
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return local === todayStr && a.caregiver_id === userId;
    },
  );
  const activeRecordForThisElder = todayRecords.find(
    (a: any) => !a.departure_time && a.elder_id === elderId,
  ) || null;
  const activeRecordForOtherElder = todayRecords.find(
    (a: any) => !a.departure_time && a.elder_id !== elderId,
  ) || null;
  const hasRecordForThisElder = todayRecords.some(
    (a: any) => a.elder_id === elderId,
  );

  const [geoError, setGeoError] = useState<string | null>(null);
  const [checkingGeo, setCheckingGeo] = useState(false);

  const verifyLocationAndCheckIn = async () => {
    setGeoError(null);
    setCheckingGeo(true);
    try {
      if (elder?.location_lat && elder?.location_lng) {
        const position = await getCurrentPosition();
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const elderLat = Number(elder.location_lat);
        const elderLng = Number(elder.location_lng);
        const radius = Number(elder.location_radius) || 100;

        if (!isWithinRadius(userLat, userLng, elderLat, elderLng, radius)) {
          const distance = haversineDistance(userLat, userLng, elderLat, elderLng);
          const msg = `Você está a ~${Math.round(distance)}m do paciente "${elder.full_name}". Dirija-se ao local (até ${radius}m) para registrar presença.`;
          setGeoError(msg);
          toast.error(msg);
          setCheckingGeo(false);
          return;
        }
      }
      checkIn.mutate();
    } catch (err: any) {
      let msg = "Erro ao verificar localização.";
      if (err.code === 1) msg = "Permissão de localização negada. Ative a localização no navegador.";
      else if (err.code === 2) msg = "Não foi possível obter sua localização. Verifique o GPS.";
      else if (err.code === 3) msg = "Tempo esgotado ao obter localização. Tente novamente.";
      else msg = err.message || msg;
      setGeoError(msg);
      toast.error(msg);
    }
    setCheckingGeo(false);
  };

  const checkIn = useMutation({
    mutationFn: async () => {
      const record = {
        id: generateId(),
        caregiver_id: userId,
        elder_id: elderId,
        created_at: new Date().toISOString(),
        departure_time: null,
      };
      const res = await fetch(`${API_URL()}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error("Erro ao registrar entrada");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-attendance", userId] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Entrada registrada!");
    },
    onError: () => toast.error("Não foi possível registrar entrada."),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      if (!activeRecordForThisElder) return;
      const res = await fetch(`${API_URL()}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeRecordForThisElder.id,
          departure_time: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Erro ao registrar saída");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-attendance", userId] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Saída registrada!");
    },
    onError: () => toast.error("Não foi possível registrar saída."),
  });

  return (
    <AppShell>
      <Link
        to="/idosos"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para pacientes
      </Link>
      {isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : elder ? (
        <>
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
                <h1 className="font-display text-xl font-bold">
                  {elder.full_name}
                </h1>
                {elder.birth_date && (
                  <p className="text-sm text-muted-foreground">
                    {calcAge(elder.birth_date)}
                  </p>
                )}
                {elder.medical_notes && (
                  <p className="mt-1 text-sm">{elder.medical_notes}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <ClipboardPlus className="h-10 w-10 text-primary" />
              <div>
                <p className="font-semibold">Registrar Relatório</p>
                <p className="text-sm text-muted-foreground">
                  Preencha o relatório de cuidados deste paciente para enviar ao
                  supervisor.
                </p>
              </div>
              <Button asChild size="lg" className="w-full max-w-xs">
                <Link to="/registrar" search={{ elderId: elder.id }}>
                  <ClipboardPlus className="mr-2 h-4 w-4" />
                  Abrir formulário
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
              {activeRecordForThisElder ? (
                <>
                  <Badge className="bg-success text-sm px-3 py-1">
                    <LogIn className="mr-1 h-3.5 w-3.5" />
                    Presente — Entrada:{" "}
                    {new Date(activeRecordForThisElder.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Badge>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full max-w-xs gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => checkOut.mutate()}
                    disabled={checkOut.isPending}
                  >
                    <LogOut className="h-4 w-4" />
                    {checkOut.isPending ? "Registrando saída..." : "Registrar Saída"}
                  </Button>
                </>
              ) : activeRecordForOtherElder ? (
                <p className="text-sm text-destructive font-semibold">
                  Você já está presente com outro paciente. Registre saída primeiro.
                </p>
              ) : hasRecordForThisElder ? (
                <p className="text-sm text-muted-foreground">
                  Presença já registrada hoje para este paciente.
                </p>
              ) : (
                <>
                <Button
                  variant="default"
                  size="lg"
                  className="w-full max-w-xs gap-2 bg-success hover:bg-success/90"
                  onClick={verifyLocationAndCheckIn}
                  disabled={checkIn.isPending || checkingGeo}
                >
                  <LogIn className="h-4 w-4" />
                  {checkingGeo ? "Verificando localização..." : checkIn.isPending ? "Registrando..." : "Registrar Entrada"}
                </Button>
                {geoError && (
                  <p className="mt-2 w-full max-w-xs text-center text-sm text-destructive">{geoError}</p>
                )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="mb-6">
          <CardContent className="p-6 text-center text-muted-foreground">
            Paciente não encontrado.
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

import { useMemo } from "react";
import {
  BellRing,
  CalendarIcon,
  FileDown,
  FileText,
} from "lucide-react";
import { RecordCard } from "@/components/RecordCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateTime, RECORD_TYPE_LABELS, formatRecordData, SEVERITY_LABELS } from "@/lib/care";
import type { RecordType } from "@/lib/care";
import { generateElderReport } from "@/lib/report";
import jsPDF from "jspdf";

function SupervisorElderView() {
  const { elderId } = Route.useParams();
  const { userId, userName } = useRole();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: elder, isLoading } = useQuery({
    queryKey: ["elder", elderId],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/elders`);
      const data = await res.json();
      return data.find((e: any) => e.id === elderId) || null;
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["records", elderId],
    enabled: !!elderId,
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/records`);
      const all = await res.json();
      return all.filter((r: any) => r.elder_id === elderId);
    },
  });

  const { data: caregivers = [] } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/caregivers`);
      return res.json();
    },
  });

  const alerts: any[] = [];

  const profileName = (id: string) => {
    if (id === userId) return userName || "Supervisor";
    return caregivers?.find((c: any) => c.id === id)?.full_name || "Desconhecido";
  };

  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    if (fromDate && t < new Date(fromDate + "T00:00:00").getTime())
      return false;
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
        profiles: caregivers ?? [],
        range: { from: fromDate || null, to: toDate || null },
      });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o relatório.");
    }
  };

  const downloadSingleRecord = (record: any) => {
    if (!elder) return;
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
    doc.text("Registro individual", marginX, 48);
    doc.setFontSize(9);
    doc.text(formatDateTime(record.created_at), marginX, 62);

    let y = 90;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(elder.full_name, marginX, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    if (elder.birth_date) {
      doc.text(calcAge(elder.birth_date), marginX, y);
      y += 14;
    }
    y += 10;

    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Tipo", marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(RECORD_TYPE_LABELS[record.record_type as RecordType] ?? record.record_type, marginX + 40, y);
    y += 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Cuidador", marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(profileName(record.caregiver_id), marginX + 60, y);
    y += 22;

    const dataLines = formatRecordData(record);
    if (dataLines.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Dados", marginX, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      for (const line of dataLines) {
        const split = doc.splitTextToSize(line, pageWidth - marginX * 2);
        doc.text(split, marginX, y);
        y += split.length * 13;
      }
      y += 6;
    }

    if (record.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text("Observações", marginX, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const noteSplit = doc.splitTextToSize(record.notes, pageWidth - marginX * 2);
      doc.text(noteSplit, marginX, y);
      y += noteSplit.length * 13;
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `CuidarBem — Página ${i} de ${pageCount}`,
        pageWidth - marginX,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" },
      );
    }

    const safeName = elder.full_name.replace(/[^\p{L}\p{N}]+/gu, "_");
    const dateStr = new Date(record.created_at).toISOString().slice(0, 10);
    doc.save(`registro_${safeName}_${dateStr}.pdf`);
  };

  return (
    <AppShell>
      <Link
        to="/idosos"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para pacientes
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
              <h1 className="font-display text-xl font-bold">
                {elder.full_name}
              </h1>
              {elder.birth_date && (
                <p className="text-sm text-muted-foreground">
                  {calcAge(elder.birth_date)}
                </p>
              )}
              {elder.medical_notes && (
                <p className="mt-1 text-sm">{elder.medical_notes}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {fromDate || toDate
                      ? "Período selecionado"
                      : "Filtrar período"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="from-date">De</Label>
                    <Input
                      id="from-date"
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="to-date">Ate</Label>
                    <Input
                      id="to-date"
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                  {(fromDate || toDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setFromDate("");
                        setToDate("");
                      }}
                    >
                      Limpar filtro
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
              <Button onClick={handleDownload} className="gap-2">
                <FileDown className="h-4 w-4" /> Baixar relatório PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="p-6 text-center text-muted-foreground">
            Paciente não encontrado.
          </CardContent>
        </Card>
      )}

      {filteredAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-lg font-bold">
            Alertas recentes
          </h2>
          <div className="space-y-2">
            {filteredAlerts.map((alert: any) => (
              <Card
                key={alert.id}
                className={
                  alert.resolved
                    ? "opacity-60"
                    : alert.severity === "critico"
                      ? "border-destructive"
                      : "border-warning"
                }
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <BellRing
                    className={`h-5 w-5 shrink-0 ${alert.severity === "critico" ? "text-destructive" : "text-warning"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          alert.severity === "critico"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {SEVERITY_LABELS[alert.severity]}
                      </Badge>
                      {alert.resolved && (
                        <Badge variant="outline">Resolvido</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(alert.created_at)}
                      </span>
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
        <h2 className="mb-3 font-display text-lg font-bold">
          Histórico de cuidados
        </h2>
        <div className="space-y-3">
          {filteredRecords.map((r: any) => (
            <div key={r.id}>
              <RecordCard
                record={r}
                caregiverName={profileName(r.caregiver_id)}
                showSelfie
              />
              <div className="flex justify-end mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => downloadSingleRecord(r)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Baixar PDF
                </Button>
              </div>
            </div>
          ))}
          {filteredRecords.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                {fromDate || toDate
                  ? "Nenhum registro no período selecionado."
                  : "Nenhum registro ainda."}
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </AppShell>
  );
}
