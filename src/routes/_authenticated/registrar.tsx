import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { SelfieCapture } from "@/components/SelfieCapture";
import { getCurrentPosition, isWithinRadius, haversineDistance } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_URL = () => `/api`;

export const Route = createFileRoute("/_authenticated/registrar")({
  component: RegistrarPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      elderId: (search.elderId as string) || undefined,
    };
  },
});

function RegistrarPage() {
  const { elderId: searchElderId } = Route.useSearch();
  const { role, userId } = useRole();
  const navigate = useNavigate();
  const [elderId, setElderId] = useState(searchElderId || "");
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [administrado, setAdministrado] = useState(true);
  const [caregiverId, setCaregiverId] = useState("");
  const [caregiverLocationError, setCaregiverLocationError] = useState<string | null>(null);

  const { data: activeAttendance } = useQuery({
    queryKey: ["active-attendance", userId],
    enabled: !!userId && role === "cuidador",
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/attendance?caregiver_id=${userId}`);
      const data = await res.json();
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      return data.find((a: any) => {
        const d = new Date(a.created_at);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return local === todayStr && a.caregiver_id === userId && !a.departure_time;
      }) || null;
    },
  });

  const { data: allElders = [] } = useQuery({
    queryKey: ["elders-list"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/elders`);
      return res.json();
    },
  });

  const { data: caregiversList = [] } = useQuery({
    queryKey: ["caregivers-list"],
    enabled: role === "supervisor",
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/caregivers`);
      return res.json();
    },
  });

  const elderDisplayName = (id: string) =>
    allElders?.find((e: any) => e.id === id)?.full_name || "";

  useEffect(() => {
    if (!elderId && activeAttendance?.elder_id) {
      setElderId(activeAttendance.elder_id);
    }
  }, [activeAttendance, elderId]);

  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", role, userId],
    enabled: !!role,
    queryFn: async () => {
      if (role === "supervisor") {
        const res = await fetch(`${API_URL()}/elders`);
        const data = await res.json();
        return data
          .filter((e: any) => e.active !== false)
          .map((e: any) => ({
            elder_id: e.id,
            elders: { id: e.id, full_name: e.full_name },
          }));
      }

      const res = await fetch(`${API_URL()}/assignments`);
      const allAssigns = await res.json();
      const myAssigns = allAssigns.filter(
        (a: any) => a.caregiver_id === userId,
      );

      const eldersRes = await fetch(`${API_URL()}/elders`);
      const allElders = await eldersRes.json();

      return myAssigns.map((a: any) => {
        const elder = allElders.find((e: any) => e.id === a.elder_id);
        return {
          elder_id: a.elder_id,
          elders: { id: a.elder_id, full_name: elder?.full_name || "Idoso" },
        };
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!elderId) {
      toast.error("Selecione o paciente.");
      return;
    }
    if (role === "supervisor" && !caregiverId) {
      toast.error("Selecione o cuidador responsável.");
      return;
    }
    if (!selfie) {
      toast.error("Capture sua assinatura facial antes de salvar.");
      return;
    }

    // Geolocation verification for caregivers
    if (role === "cuidador") {
      const selectedElderData = (allElders as any[]).find((e: any) => e.id === elderId);
      if (selectedElderData?.location_lat && selectedElderData?.location_lng) {
        try {
          const position = await getCurrentPosition();
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const elderLat = Number(selectedElderData.location_lat);
          const elderLng = Number(selectedElderData.location_lng);
          const radius = Number(selectedElderData.location_radius) || 100;

          if (!isWithinRadius(userLat, userLng, elderLat, elderLng, radius)) {
            const distance = haversineDistance(userLat, userLng, elderLat, elderLng);
            const msg = `Você está a ${Math.round(distance)}m do paciente. Registre-se na residência (até ${radius}m).`;
            setCaregiverLocationError(msg);
            toast.error(msg);
            return;
          }
          setCaregiverLocationError(null);
        } catch (err: any) {
          const msg = "Não foi possível acessar sua localização. Habilite o GPS.";
          setCaregiverLocationError(msg);
          toast.error(msg);
          return;
        }
      }
    }

    const form = new FormData(e.currentTarget);
    const val = (k: string) => String(form.get(k) ?? "").trim();

    const recordsToInsert: Array<{
      record_type: string;
      data: any;
      notes: string | null;
    }> = [];

    const svData: any = {};
    if (val("pressao_sistolica"))
      svData.pressao_sistolica = Number(val("pressao_sistolica"));
    if (val("pressao_diastolica"))
      svData.pressao_diastolica = Number(val("pressao_diastolica"));
    if (val("temperatura"))
      svData.temperatura = Number(val("temperatura").replace(",", "."));
    if (val("glicemia")) svData.glicemia = Number(val("glicemia"));
    if (val("batimentos")) svData.batimentos = Number(val("batimentos"));

    if (Object.keys(svData).length > 0) {
      recordsToInsert.push({
        record_type: "sinais_vitais",
        data: svData,
        notes: val("notes_sinais_vitais") || null,
      });
    }

    if (val("medicamento")) {
      recordsToInsert.push({
        record_type: "medicacao",
        data: {
          medicamento: val("medicamento"),
          dose: val("dose"),
          administrado: administrado,
        },
        notes: val("notes_medicacao") || null,
      });
    }

    if (val("refeicao") && val("refeicao") !== "none") {
      recordsToInsert.push({
        record_type: "alimentacao",
        data: {
          refeicao: val("refeicao"),
          aceitacao: val("aceitacao") || "total",
          ...(val("agua_ml") && { agua_ml: Number(val("agua_ml")) }),
        },
        notes: val("notes_alimentacao") || null,
      });
    }

    if (val("teve_diurese") && val("teve_diurese") !== "none") {
      recordsToInsert.push({
        record_type: "diurese",
        data: {
          teve_diurese: val("teve_diurese"),
          aspecto: val("aspecto") || "Urina clara",
        },
        notes: val("notes_diurese") || null,
      });
    }

    if (val("tipo_ocorrencia") && val("tipo_ocorrencia") !== "none") {
      recordsToInsert.push({
        record_type: "ocorrencia",
        data: {
          tipo_ocorrencia: val("tipo_ocorrencia"),
          gravidade: val("gravidade") || "leve",
        },
        notes: val("notes_ocorrencia") || null,
      });
    }

    let handoverToInsert: any = null;
    if (val("resumo_plantao") || val("intercorrencias") || val("notes_plantao")) {
      const resumo = val("resumo_plantao");
      if (!resumo) {
        toast.error("Para enviar o Relatório de Plantão, escreva um resumo.");
        return;
      }
      if (resumo.length < 15) {
        toast.error(
          "Para enviar o Relatório de Plantão completo, o resumo deve conter pelo menos 15 caracteres.",
        );
        return;
      }
      handoverToInsert = {
        resumo_plantao: resumo,
        estado_humor: val("estado_humor") || "calmo",
        intercorrencias: val("intercorrencias") || "nenhuma",
        notes: val("notes_plantao") || null,
      };
    }

    if (recordsToInsert.length === 0 && !handoverToInsert) {
      toast.error(
        "Preencha pelo menos um cuidado ou relatório de plantão para salvar.",
      );
      return;
    }

    setSaving(true);
    try {
      let selfieBase64: string | null = null;
      if (selfie) {
        const reader = new FileReader();
        selfieBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selfie);
        });
      }

      if (recordsToInsert.length > 0) {
        for (const rec of recordsToInsert) {
          const newRecord = {
            id: generateId(),
            elder_id: elderId,
            caregiver_id: role === "supervisor" ? (caregiverId || userId || "00000000-0000-0000-0000-000000000001") : (userId || "00000000-0000-0000-0000-000000000001"),
            record_type: rec.record_type,
            data: rec.data,
            notes: rec.notes || null,
            selfie_base64: selfieBase64,
            created_at: new Date().toISOString(),
          };

          await fetch(`${API_URL()}/records`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRecord),
          });
        }
      }

      if (handoverToInsert) {
        const handoverRecord = {
          id: generateId(),
          elder_id: elderId,
          caregiver_id: role === "supervisor" ? (caregiverId || userId || "00000000-0000-0000-0000-000000000001") : (userId || "00000000-0000-0000-0000-000000000001"),
          record_type: "passagem_plantao",
          data: handoverToInsert,
          selfie_base64: selfieBase64,
          created_at: new Date().toISOString(),
        };

        await fetch(`${API_URL()}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(handoverRecord),
        });
      }

      toast.success("Relatório enviado ao supervisor com sucesso!");
      navigate({ to: "/idosos/$elderId", params: { elderId } });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar os registros. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-center font-display text-2xl font-bold">
          Registrar Cuidados do Paciente
        </h1>
        <p className="-mt-4 text-center text-sm text-muted-foreground">
          Preencha abaixo as ações de cuidado realizadas neste período. Deixe em
          branco as seções que não foram executadas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {role === "supervisor" ? (
            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">
                  1. Paciente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Selecione o Paciente</Label>
                  <Select value={elderId} onValueChange={setElderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o paciente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments?.map((a: any) =>
                        a.elders ? (
                          <SelectItem key={a.elder_id} value={a.elder_id}>
                            {a.elders.full_name}
                          </SelectItem>
                        ) : null,
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Registrando como cuidador</Label>
                  <Select value={caregiverId} onValueChange={setCaregiverId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cuidador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {caregiversList?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ) : elderId ? (
            <Card className="border-primary/20 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Paciente</p>
                <p className="font-semibold text-lg">{elderDisplayName(elderId)}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-destructive/30 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-destructive font-semibold">
                  Nenhuma presença ativa registrada. Registre presença primeiro.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">
                2. Sinais Vitais (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ps">Pressão sistólica</Label>
                  <Input
                    id="ps"
                    name="pressao_sistolica"
                    type="number"
                    inputMode="numeric"
                    placeholder="120"
                    min={40}
                    max={300}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pd">Pressão diastólica</Label>
                  <Input
                    id="pd"
                    name="pressao_diastolica"
                    type="number"
                    inputMode="numeric"
                    placeholder="80"
                    min={20}
                    max={200}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="temp">Temp. (C)</Label>
                  <Input
                    id="temp"
                    name="temperatura"
                    placeholder="36.5"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="glic">Glicemia</Label>
                  <Input
                    id="glic"
                    name="glicemia"
                    type="number"
                    inputMode="numeric"
                    placeholder="99"
                    min={10}
                    max={800}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bpm">Batimentos</Label>
                  <Input
                    id="bpm"
                    name="batimentos"
                    type="number"
                    inputMode="numeric"
                    placeholder="72"
                    min={20}
                    max={250}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_sinais_vitais">Observação / Nota</Label>
                <Input
                  id="notes_sinais_vitais"
                  name="notes_sinais_vitais"
                  placeholder="Descreva qualquer alteração de sinais vitais..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">
                3. Medicação (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="med">Medicamento</Label>
                <Input
                  id="med"
                  name="medicamento"
                  maxLength={120}
                  placeholder="Ex.: Losartana 50mg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dose">Dose</Label>
                <Input
                  id="dose"
                  name="dose"
                  maxLength={60}
                  placeholder="Ex.: 1 comprimido"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={administrado}
                  onCheckedChange={(c) => setAdministrado(c === true)}
                />
                Medicação administrada
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="notes_medicacao">Observação / Nota</Label>
                <Input
                  id="notes_medicacao"
                  name="notes_medicacao"
                  placeholder="Ex.: Recusou, tomou com suco..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">
                4. Alimentação e Hidratação (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Refeição</Label>
                  <Select name="refeicao" defaultValue="none">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não registrado</SelectItem>
                      <SelectItem value="cafe da manha">
                        Café da manhã
                      </SelectItem>
                      <SelectItem value="almoco">Almoço</SelectItem>
                      <SelectItem value="lanche">Lanche</SelectItem>
                      <SelectItem value="jantar">Jantar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Aceitação</Label>
                  <Select name="aceitacao" defaultValue="total">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Comeu tudo</SelectItem>
                      <SelectItem value="parcial">
                        Comeu parcialmente
                      </SelectItem>
                      <SelectItem value="recusou">Recusou</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agua">Agua ingerida (ml)</Label>
                <Input
                  id="agua"
                  name="agua_ml"
                  type="number"
                  inputMode="numeric"
                  placeholder="200"
                  min={0}
                  max={5000}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_alimentacao">Observação / Nota</Label>
                <Input
                  id="notes_alimentacao"
                  name="notes_alimentacao"
                  placeholder="Teve dificuldade para engolir, etc..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">
                5. Diurese / Eliminações (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Teve diurese (urina)?</Label>
                <Select name="teve_diurese" defaultValue="none">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não registrado</SelectItem>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Aspecto da urina</Label>
                <Select name="aspecto" defaultValue="Urina clara">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Urina clara">Clara / Normal</SelectItem>
                    <SelectItem value="Urina escura/concentrada">
                      Escura / Concentrada
                    </SelectItem>
                    <SelectItem value="Urina com presenca de sangue">
                      Com presenca de hematuria (sangue)
                    </SelectItem>
                    <SelectItem value="Outro">
                        Outro (detalhar na observação)
                      </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_diurese">Observação / Nota</Label>
                <Input
                  id="notes_diurese"
                  name="notes_diurese"
                  placeholder="Disuria, odor forte, fralda muito cheia..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">
                6. Alteração de Comportamento (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tipo de alteração</Label>
                <Select name="tipo_ocorrencia" defaultValue="none">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Nenhuma alteração registrada
                    </SelectItem>
                    <SelectItem value="humor">
                      Humor / estado emocional
                    </SelectItem>
                    <SelectItem value="sono">Sono</SelectItem>
                    <SelectItem value="queda">Queda</SelectItem>
                    <SelectItem value="dor">Dor</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Gravidade</Label>
                <Select name="gravidade" defaultValue="leve">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="moderada">Moderada</SelectItem>
                    <SelectItem value="grave">Grave (gera alerta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_ocorrencia">Observação / Nota</Label>
                <Input
                  id="notes_ocorrencia"
                  name="notes_ocorrencia"
                  placeholder="Especifique a alteração ou queixas..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">
                7. Relatório de Plantão / Passagem (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="resumo">
                  Resumo do plantão (atividades, cuidados)
                </Label>
                <Textarea
                  id="resumo"
                  name="resumo_plantao"
                  maxLength={2000}
                  rows={4}
                  placeholder="Ex.: O paciente passou o dia bem, tomou todos os remédios da manhã, almoçou toda a refeição e realizou caminhada..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Estado de humor / Comportamento principal</Label>
                <Select name="estado_humor" defaultValue="calmo">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calmo">Calmo / Cooperativo</SelectItem>
                    <SelectItem value="agitado">
                      Agitado / Ansioso
                    </SelectItem>
                    <SelectItem value="sonolento">
                      Sonolento / Apatico
                    </SelectItem>
                    <SelectItem value="alegre">
                      Alegre / Comunicativo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intercorrencia">
                  Intercorrências do período (opcional)
                </Label>
                <Input
                  id="intercorrencia"
                  name="intercorrencias"
                  placeholder="Ex.: Nenhuma, ou descreva se houve algo fora do comum"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_plantao">Observação / Nota</Label>
                <Input
                  id="notes_plantao"
                  name="notes_plantao"
                  placeholder="Informações adicionais para o colega..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/25 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">
                8. Assinatura facial (Obrigatório)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SelfieCapture
                onCapture={setSelfie}
                onClear={() => setSelfie(null)}
              />
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full text-base shadow-lg"
            disabled={saving || !selfie || !elderId}
          >
            {saving
              ? "Salvando registros..."
              : "Salvar todos os cuidados preenchidos"}
          </Button>

          {caregiverLocationError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {caregiverLocationError}
            </div>
          )}
        </form>
      </div>
    </AppShell>
  );
}
