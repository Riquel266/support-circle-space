import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogIn, LogOut, Trash2, Clock, UserCheck, Pencil, Check, X, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_URL = () => `/api`;

export const Route = createFileRoute("/_authenticated/presenca")({
  component: PresencaPage,
});

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function PresencaPage() {
  const { userId } = useRole();
  const queryClient = useQueryClient();
  const [filterDate, setFilterDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState("");
  const [editDeparture, setEditDeparture] = useState("");
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/caregivers`);
      return res.json();
    },
  });

  const { data: elders = [] } = useQuery({
    queryKey: ["elders"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/elders`);
      return res.json();
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/attendance`);
      return res.json();
    },
  });

  const updateRecord = useMutation({
    mutationFn: async ({ id, created_at, departure_time }: { id: string; created_at: string; departure_time: string | null }) => {
      const res = await fetch(`${API_URL()}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, created_at, departure_time }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Registro atualizado!");
      setEditingId(null);
    },
    onError: () => toast.error("Não foi possível atualizar."),
  });

  const deleteRecord = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL()}/attendance?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao excluir");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Registro excluído!");
    },
    onError: () => toast.error("Não foi possível excluir."),
  });

  const caregiverName = (id: string) =>
    id === userId
      ? "Supervisor"
      : caregivers?.find((c: any) => c.id === id)?.full_name || "Desconhecido";

  const elderName = (id: string) =>
    elders?.find((e: any) => e.id === id)?.full_name || "";

  const filtered = (attendance as any[]).filter((a: any) => {
    if (filterDate) {
      const d = new Date(a.created_at);
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (local !== filterDate) return false;
    }
    return true;
  }).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));

  const todayRecords = (attendance as any[]).filter((a: any) => {
    const d = new Date(a.created_at);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return local === todayStr;
  });

  const activeNow = todayRecords.filter((a: any) => !a.departure_time).length;

  const startEdit = (a: any) => {
    setEditingId(a.id);
    setEditEntry(toLocalDatetime(a.created_at));
    setEditDeparture(a.departure_time ? toLocalDatetime(a.departure_time) : "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    const entryIso = new Date(editEntry).toISOString();
    const depIso = editDeparture ? new Date(editDeparture).toISOString() : null;
    if (depIso && depIso <= entryIso) {
      toast.error("A saída deve ser posterior à entrada.");
      return;
    }
    updateRecord.mutate({ id: editingId, created_at: entryIso, departure_time: depIso });
  };

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 15;
    const now = new Date();

    doc.setFontSize(18);
    doc.setTextColor(34, 102, 68);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Presença", marginX, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    const subtitle = filterDate
      ? `Filtro: ${formatDate(new Date(filterDate + "T12:00:00").toISOString())}`
      : `Todos os registros — Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    doc.text(subtitle, marginX, 28);

    let y = 35;

    const bodyRows = filtered.map((a: any) => {
      const dep = a.departure_time ? new Date(a.departure_time) : null;
      const entry = new Date(a.created_at);
      let duration = "—";
      if (dep) {
        const diffMs = dep.getTime() - entry.getTime();
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        duration = `${hours}h ${mins}min`;
      }
      return [
        caregiverName(a.caregiver_id),
        a.elder_id ? elderName(a.elder_id) : "—",
        formatDate(a.created_at),
        formatTime(a.created_at),
        dep ? formatTime(a.departure_time) : "—",
        dep ? "Saída registrada" : "Presente",
        duration,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Cuidador", "Idoso", "Data", "Entrada", "Saída", "Status", "Duração"]],
      body: bodyRows,
      styles: { fontSize: 9, cellPadding: 4, valign: "middle" },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 50 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 35 },
        6: { cellWidth: 25 },
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
          pageH - 10,
        );
        doc.text(
          "Relatório de Presença",
          pageWidth - marginX,
          pageH - 10,
          { align: "right" },
        );
      },
    });

    doc.save(`presenca_cuidarbem_${now.toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Registro de Presença</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de entrada e saída dos cuidadores.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{activeNow}</p>
              <p className="text-xs text-muted-foreground">Presentes agora</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{todayRecords.length}</p>
              <p className="text-xs text-muted-foreground">Registros hoje</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label>Filtrar por data</Label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={downloadPDF}
              disabled={filtered.length === 0}
            >
              <FileDown className="h-4 w-4" />
              Baixar PDF
            </Button>
          </div>
          {filterDate && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setFilterDate("")}
            >
              Limpar filtro
            </Button>
          )}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">
          Registros ({filtered.length})
        </h2>
        <div className="space-y-2">
          {filtered.map((a: any) => {
            const dep = a.departure_time ? new Date(a.departure_time) : null;
            const isActive = !a.departure_time;
            const isEditing = editingId === a.id;
            return (
              <Card key={a.id} className={isActive ? "border-success/50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isActive
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isActive ? (
                        <LogIn className="h-5 w-5" />
                      ) : (
                        <LogOut className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm">
                          {caregiverName(a.caregiver_id)}
                        </span>
                        {a.elder_id && elderName(a.elder_id) && (
                          <span className="text-xs text-muted-foreground">
                            — {elderName(a.elder_id)}
                          </span>
                        )}
                        {isActive ? (
                          <Badge variant="default" className="bg-success text-[10px]">
                            Presente
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Saída registrada
                          </Badge>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Entrada</Label>
                            <Input
                              type="datetime-local"
                              value={editEntry}
                              onChange={(e) => setEditEntry(e.target.value)}
                              className="h-8 text-xs w-[200px]"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Saída</Label>
                            <Input
                              type="datetime-local"
                              value={editDeparture}
                              onChange={(e) => setEditDeparture(e.target.value)}
                              className="h-8 text-xs w-[200px]"
                              placeholder="Ainda presente"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{formatDate(a.created_at)}</span>
                          <span className="font-medium text-foreground">
                            Entrada: {formatTime(a.created_at)}
                          </span>
                          {dep && (
                            <>
                              <span>→</span>
                              <span className="font-medium text-foreground">
                                Saída: {formatTime(a.departure_time)}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                            onClick={saveEdit}
                            disabled={updateRecord.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => startEdit(a)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm("Excluir este registro?")) {
                                deleteRecord.mutate(a.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Nenhum registro de presença{filterDate ? " nesta data" : ""}.
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </AppShell>
  );
}
