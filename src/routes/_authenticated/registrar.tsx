import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { SelfieCapture } from "@/components/SelfieCapture";
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

const API_URL = () => `http://${window.location.hostname}:3001/api`;

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
      toast.error("Selecione o idoso.");
      return;
    }
    if (!selfie) {
      toast.error("Capture sua assinatura facial antes de salvar.");
      return;
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
        toast.error("Para enviar o Relatorio de Plantao, escreva um resumo.");
        return;
      }
      if (resumo.length < 15) {
        toast.error(
          "Para enviar o Relatorio de Plantao completo, o resumo deve conter pelo menos 15 caracteres.",
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
        "Preencha pelo menos um cuidado ou relatorio de plantao para salvar.",
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
            caregiver_id: userId || "00000000-0000-0000-0000-000000000001",
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
          caregiver_id: userId || "00000000-0000-0000-0000-000000000001",
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
      toast.error("Nao foi possivel salvar os registros. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-center font-display text-2xl font-bold">
          Registrar Cuidados do Idoso
        </h1>
        <p className="-mt-4 text-center text-sm text-muted-foreground">
          Preencha abaixo as acoes de cuidado realizadas neste periodo. Deixe em
          branco as secoes que nao foram executadas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">
                1. Idoso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Selecione o Idoso</Label>
                <Select value={elderId} onValueChange={setElderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o idoso..." />
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
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">
                2. Sinais Vitais (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ps">Pressao sistolica</Label>
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
                  <Label htmlFor="pd">Pressao diastolica</Label>
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
                <Label htmlFor="notes_sinais_vitais">Observacao / Nota</Label>
                <Input
                  id="notes_sinais_vitais"
                  name="notes_sinais_vitais"
                  placeholder="Descreva qualquer alteracao de sinais vitais..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">
                3. Medicacao (Opcional)
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
                Medicacao administrada
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="notes_medicacao">Observacao / Nota</Label>
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
                4. Alimentacao e Hidratacao (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Refeicao</Label>
                  <Select name="refeicao" defaultValue="none">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nao registrado</SelectItem>
                      <SelectItem value="cafe da manha">
                        Cafe da manha
                      </SelectItem>
                      <SelectItem value="almoco">Almoco</SelectItem>
                      <SelectItem value="lanche">Lanche</SelectItem>
                      <SelectItem value="jantar">Jantar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Aceitacao</Label>
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
                <Label htmlFor="notes_alimentacao">Observacao / Nota</Label>
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
                5. Diurese / Eliminacoes (Opcional)
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
                    <SelectItem value="none">Nao registrado</SelectItem>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Nao">Nao</SelectItem>
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
                      Outro (detalhar na observacao)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_diurese">Observacao / Nota</Label>
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
                6. Alteracao de Comportamento (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tipo de alteracao</Label>
                <Select name="tipo_ocorrencia" defaultValue="none">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Nenhuma alteracao registrada
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
                <Label htmlFor="notes_ocorrencia">Observacao / Nota</Label>
                <Input
                  id="notes_ocorrencia"
                  name="notes_ocorrencia"
                  placeholder="Especifique a alteracao ou queixas..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">
                7. Relatorio de Plantao / Passagem (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="resumo">
                  Resumo do plantao (atividades, cuidados)
                </Label>
                <Textarea
                  id="resumo"
                  name="resumo_plantao"
                  maxLength={2000}
                  rows={4}
                  placeholder="Ex.: O idoso passou o dia bem, tomou todos os remedios da manha, almocou toda a refeicao e realizou caminhada..."
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
                  Intercorrencias do periodo (opcional)
                </Label>
                <Input
                  id="intercorrencia"
                  name="intercorrencias"
                  placeholder="Ex.: Nenhuma, ou descreva se houve algo fora do comum"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_plantao">Observacao / Nota</Label>
                <Input
                  id="notes_plantao"
                  name="notes_plantao"
                  placeholder="Informacoes adicionais para o colega..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/25 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">
                8. Assinatura facial (Obrigatorio)
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
        </form>
      </div>
    </AppShell>
  );
}
