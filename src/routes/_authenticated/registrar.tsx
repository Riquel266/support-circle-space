import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import { RECORD_TYPE_LABELS, type RecordType } from "@/lib/care";

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
        let remoteElders: any[] = [];
        try {
          const { data, error } = await supabase.from("elders").select("*").eq("active", true);
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
          elders: { id: e.id, full_name: e.full_name },
        }));
      }

      const { data, error } = await supabase
        .from("assignments")
        .select("elder_id, elders(id, full_name)")
        .eq("caregiver_id", userId!);
      if (error) throw error;
      return data;
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

    const recordsToInsert: Array<{ record_type: string; data: any; notes: string | null }> = [];

    // 1. Sinais Vitais
    const svData: any = {};
    if (form.get("pressao_sistolica") && val("pressao_sistolica")) svData.pressao_sistolica = Number(val("pressao_sistolica"));
    if (form.get("pressao_diastolica") && val("pressao_diastolica")) svData.pressao_diastolica = Number(val("pressao_diastolica"));
    if (form.get("temperatura") && val("temperatura")) svData.temperatura = Number(val("temperatura").replace(",", "."));
    if (form.get("glicemia") && val("glicemia")) svData.glicemia = Number(val("glicemia"));
    if (form.get("batimentos") && val("batimentos")) svData.batimentos = Number(val("batimentos"));

    if (Object.keys(svData).length > 0) {
      recordsToInsert.push({
        record_type: "sinais_vitais",
        data: svData,
        notes: val("notes_sinais_vitais") || null,
      });
    }

    // 2. Medicação
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

    // 3. Alimentação
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

    // 4. Diurese
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

    // 5. Ocorrência
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

    // 6. Relatório de Plantão
    let handoverToInsert: any = null;
    if (val("resumo_plantao") || val("intercorrencias") || val("notes_plantao")) {
      const resumo = val("resumo_plantao");
      if (!resumo) {
        toast.error("Para enviar o Relatório de Plantão, escreva um resumo.");
        return;
      }
      if (resumo.length < 15) {
        toast.error("Para enviar o Relatório de Plantão completo, o resumo deve conter pelo menos 15 caracteres.");
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
      toast.error("Preencha pelo menos um cuidado ou relatório de plantão para salvar.");
      return;
    }

    setSaving(true);
    try {
      // Converte a selfie local
      let selfieBase64: string | null = null;
      if (selfie) {
        const reader = new FileReader();
        selfieBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selfie);
        });
      }

      // 1. Salva os registros de cuidado normais se existirem
      if (recordsToInsert.length > 0) {
        const localRecordsStr = typeof window !== "undefined" ? localStorage.getItem("local-care-records") : null;
        const localRecords = localRecordsStr ? JSON.parse(localRecordsStr) : [];

        for (const rec of recordsToInsert) {
          const newRecordId = crypto.randomUUID();
          const path = `${userId || "0e7874c3-a937-4158-a0ab-949991be81b9"}/${Date.now()}-${newRecordId}.jpg`;

          const localRecord = {
            id: newRecordId,
            elder_id: elderId,
            caregiver_id: userId || "0e7874c3-a937-4158-a0ab-949991be81b9",
            record_type: rec.record_type,
            data: rec.data,
            notes: rec.notes || null,
            selfie_path: path,
            selfie_base64: selfieBase64,
            created_at: new Date().toISOString(),
          };

          localRecords.push(localRecord);

          // Tenta salvar no Supabase
          try {
            if (selfie) {
              await supabase.storage
                .from("assinaturas")
                .upload(path, selfie, { contentType: "image/jpeg" });
            }
            await supabase.from("care_records").insert({
              id: newRecordId,
              elder_id: elderId,
              caregiver_id: userId || "0e7874c3-a937-4158-a0ab-949991be81b9",
              record_type: rec.record_type,
              data: rec.data,
              notes: rec.notes || null,
              selfie_path: path,
            });
          } catch (supabaseErr) {
            console.warn("Could not save care record to Supabase, saved locally:", supabaseErr);
          }
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("local-care-records", JSON.stringify(localRecords));
        }
      }

      // 2. Salva o Relatório de Plantão separadamente se existir
      if (handoverToInsert) {
        const handoverId = crypto.randomUUID();
        const path = `${userId || "0e7874c3-a937-4158-a0ab-949991be81b9"}/${Date.now()}-${handoverId}.jpg`;
        const handoverRecord = {
          id: handoverId,
          elder_id: elderId,
          caregiver_id: userId || "0e7874c3-a937-4158-a0ab-949991be81b9",
          resumo_plantao: handoverToInsert.resumo_plantao,
          estado_humor: handoverToInsert.estado_humor,
          intercorrencias: handoverToInsert.intercorrencias,
          notes: handoverToInsert.notes,
          selfie_path: path,
          selfie_base64: selfieBase64,
          created_at: new Date().toISOString(),
        };

        const localHandoversStr = typeof window !== "undefined" ? localStorage.getItem("local-shift-handovers") : null;
        const localHandovers = localHandoversStr ? JSON.parse(localHandoversStr) : [];
        localHandovers.push(handoverRecord);
        if (typeof window !== "undefined") {
          localStorage.setItem("local-shift-handovers", JSON.stringify(localHandovers));
        }

        // Tenta salvar no Supabase
        try {
          if (selfie) {
            await supabase.storage
              .from("assinaturas")
              .upload(path, selfie, { contentType: "image/jpeg" });
          }
          await supabase.from("shift_handovers").insert({
            id: handoverId,
            elder_id: elderId,
            caregiver_id: userId || "0e7874c3-a937-4158-a0ab-949991be81b9",
            resumo_plantao: handoverToInsert.resumo_plantao,
            estado_humor: handoverToInsert.estado_humor,
            intercorrencias: handoverToInsert.intercorrencias,
            notes: handoverToInsert.notes,
            selfie_path: path,
          });
        } catch (supabaseErr) {
          console.warn("Could not save shift handover to remote Supabase, saved locally:", supabaseErr);
        }
      }

      toast.success("Todos os cuidados e relatórios preenchidos foram registrados!");
      navigate({ to: "/painel" });
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
        <h1 className="font-display text-2xl font-bold text-center">Registrar Cuidados do Idoso</h1>
        <p className="text-sm text-muted-foreground text-center -mt-4">
          Preencha abaixo as ações de cuidado realizadas neste período. Deixe em branco as seções que não foram executadas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. SELEÇÃO DO IDOSO */}
          <Card className="shadow-sm border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">1. Idoso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Selecione o Idoso</Label>
                <Select value={elderId} onValueChange={setElderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o idoso..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments?.map((a) =>
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

          {/* 2. SINAIS VITAIS */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">2. Sinais Vitais (Opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ps">Pressão sistólica</Label>
                  <Input id="ps" name="pressao_sistolica" type="number" inputMode="numeric" placeholder="120" min={40} max={300} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pd">Pressão diastólica</Label>
                  <Input id="pd" name="pressao_diastolica" type="number" inputMode="numeric" placeholder="80" min={20} max={200} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="temp">Temp. (°C)</Label>
                  <Input id="temp" name="temperatura" placeholder="36.5" inputMode="decimal" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="glic">Glicemia</Label>
                  <Input id="glic" name="glicemia" type="number" inputMode="numeric" placeholder="99" min={10} max={800} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bpm">Batimentos</Label>
                  <Input id="bpm" name="batimentos" type="number" inputMode="numeric" placeholder="72" min={20} max={250} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_sinais_vitais">Observação / Nota</Label>
                <Input id="notes_sinais_vitais" name="notes_sinais_vitais" placeholder="Descreva qualquer alteração de sinais vitais..." />
              </div>
            </CardContent>
          </Card>

          {/* 3. MEDICAÇÃO */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">3. Medicação (Opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="med">Medicamento</Label>
                <Input id="med" name="medicamento" maxLength={120} placeholder="Ex.: Losartana 50mg" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dose">Dose</Label>
                <Input id="dose" name="dose" maxLength={60} placeholder="Ex.: 1 comprimido" />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox checked={administrado} onCheckedChange={(c) => setAdministrado(c === true)} />
                Medicação administrada
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="notes_medicacao">Observação / Nota</Label>
                <Input id="notes_medicacao" name="notes_medicacao" placeholder="Ex.: Recusou, tomou com suco..." />
              </div>
            </CardContent>
          </Card>

          {/* 4. ALIMENTAÇÃO E HIDRATAÇÃO */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">4. Alimentação e Hidratação (Opcional)</CardTitle>
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
                      <SelectItem value="café da manhã">Café da manhã</SelectItem>
                      <SelectItem value="almoço">Almoço</SelectItem>
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
                      <SelectItem value="parcial">Comeu parcialmente</SelectItem>
                      <SelectItem value="recusou">Recusou</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agua">Água ingerida (ml)</Label>
                <Input id="agua" name="agua_ml" type="number" inputMode="numeric" placeholder="200" min={0} max={5000} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_alimentacao">Observação / Nota</Label>
                <Input id="notes_alimentacao" name="notes_alimentacao" placeholder="Teve dificuldade para engolir, etc..." />
              </div>
            </CardContent>
          </Card>

          {/* 5. DIURESE / ELIMINAÇÕES */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">5. Diurese / Eliminações (Opcional)</CardTitle>
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
                    <SelectItem value="Não">Não</SelectItem>
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
                    <SelectItem value="Urina escura/concentrada">Escura / Concentrada</SelectItem>
                    <SelectItem value="Urina com presença de sangue">Com presença de hematúria (sangue)</SelectItem>
                    <SelectItem value="Outro">Outro (detalhar na observação)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_diurese">Observação / Nota</Label>
                <Input id="notes_diurese" name="notes_diurese" placeholder="Disúria, odor forte, fralda muito cheia..." />
              </div>
            </CardContent>
          </Card>

          {/* 6. ESTADO GERAL / COMPORTAMENTO */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">6. Alteração de Comportamento (Opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tipo de alteração</Label>
                <Select name="tipo_ocorrencia" defaultValue="none">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma alteração registrada</SelectItem>
                    <SelectItem value="humor">Humor / estado emocional</SelectItem>
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
                <Input id="notes_ocorrencia" name="notes_ocorrencia" placeholder="Especifique a alteração ou queixas..." />
              </div>
            </CardContent>
          </Card>

          {/* 7. RELATÓRIO DE PLANTÃO / PASSAGEM */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base text-primary">7. Relatório de Plantão / Passagem (Opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="resumo">Resumo do plantão (atividades, cuidados)</Label>
                <Textarea id="resumo" name="resumo_plantao" maxLength={2000} rows={4} placeholder="Ex.: O idoso passou o dia bem, tomou todos os remédios da manhã, almoçou toda a refeição e realizou caminhada..." />
              </div>
              <div className="space-y-1.5">
                <Label>Estado de humor / Comportamento principal</Label>
                <Select name="estado_humor" defaultValue="calmo">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calmo">Calmo / Cooperativo</SelectItem>
                    <SelectItem value="agitado">Agitado / Ansioso</SelectItem>
                    <SelectItem value="sonolento">Sonolento / Apático</SelectItem>
                    <SelectItem value="alegre">Alegre / Comunicativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intercorrencia">Intercorrências do período (opcional)</Label>
                <Input id="intercorrencia" name="intercorrencias" placeholder="Ex.: Nenhuma, ou descreva se houve algo fora do comum" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes_plantao">Observação / Nota</Label>
                <Input id="notes_plantao" name="notes_plantao" placeholder="Informações adicionais para o colega..." />
              </div>
            </CardContent>
          </Card>

          {/* 8. ASSINATURA FACIAL (OBRIGATÓRIO) */}
          <Card className="shadow-sm border-primary/25">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">8. Assinatura facial (Obrigatório)</CardTitle>
            </CardHeader>
            <CardContent>
              <SelfieCapture onCapture={setSelfie} onClear={() => setSelfie(null)} />
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full shadow-lg text-base h-12" disabled={saving || !selfie || !elderId}>
            {saving ? "Salvando registros..." : "Salvar todos os cuidados preenchidos"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}