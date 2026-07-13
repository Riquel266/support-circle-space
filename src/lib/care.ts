import type { Tables } from "@/integrations/supabase/types";

export type CareRecord = Tables<"care_records">;
export type Elder = Tables<"elders">;
export type Alert = Tables<"alerts">;
export type Profile = Tables<"profiles">;

export type RecordType = "sinais_vitais" | "medicacao" | "alimentacao" | "ocorrencia" | "passagem_plantao" | "diurese";

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  sinais_vitais: "Sinais vitais",
  medicacao: "Medicação",
  alimentacao: "Alimentação e hidratação",
  ocorrencia: "Estado geral / Ocorrência",
  passagem_plantao: "Relatório de Plantão / Passagem",
  diurese: "Diurese / Eliminações",
};

export const SEVERITY_LABELS: Record<string, string> = {
  info: "Informativo",
  atencao: "Atenção",
  critico: "Crítico",
};

export function formatRecordData(record: CareRecord): string[] {
  const d = (record.data ?? {}) as Record<string, string | number | boolean | null>;
  const lines: string[] = [];
  switch (record.record_type) {
    case "sinais_vitais":
      if (d.pressao_sistolica && d.pressao_diastolica)
        lines.push(`Pressão: ${d.pressao_sistolica}/${d.pressao_diastolica} mmHg`);
      if (d.temperatura) lines.push(`Temperatura: ${d.temperatura} °C`);
      if (d.glicemia) lines.push(`Glicemia: ${d.glicemia} mg/dL`);
      if (d.batimentos) lines.push(`Batimentos: ${d.batimentos} bpm`);
      break;
    case "medicacao":
      if (d.medicamento) lines.push(`Medicamento: ${d.medicamento}`);
      if (d.dose) lines.push(`Dose: ${d.dose}`);
      lines.push(d.administrado ? "✓ Administrado" : "✗ Não administrado");
      break;
    case "alimentacao":
      if (d.refeicao) lines.push(`Refeição: ${d.refeicao}`);
      if (d.aceitacao) lines.push(`Aceitação: ${d.aceitacao}`);
      if (d.agua_ml) lines.push(`Água: ${d.agua_ml} ml`);
      break;
    case "ocorrencia":
      if (d.tipo_ocorrencia) lines.push(`Tipo: ${d.tipo_ocorrencia}`);
      if (d.gravidade) lines.push(`Gravidade: ${d.gravidade}`);
      break;
    case "passagem_plantao":
      if (d.resumo_plantao) lines.push(`Resumo do plantão: ${d.resumo_plantao}`);
      if (d.estado_humor) lines.push(`Estado de humor: ${d.estado_humor}`);
      if (d.intercorrencias) lines.push(`Intercorrências: ${d.intercorrencias}`);
      break;
    case "diurese":
      if (d.teve_diurese) lines.push(`Diurese: ${d.teve_diurese}`);
      if (d.aspecto) lines.push(`Aspecto: ${d.aspecto}`);
      break;
  }
  return lines;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function calcAge(birthDate: string | null): string {
  if (!birthDate) return "";
  const diff = Date.now() - new Date(birthDate).getTime();
  const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return `${age} anos`;
}