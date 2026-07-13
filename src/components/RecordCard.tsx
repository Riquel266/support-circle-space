import { Activity, Pill, Utensils, HeartPulse, ClipboardList, Droplet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  RECORD_TYPE_LABELS,
  formatRecordData,
  formatDateTime,
  type RecordType,
} from "@/lib/care";

const TYPE_ICONS: Record<RecordType, typeof Activity> = {
  sinais_vitais: HeartPulse,
  medicacao: Pill,
  alimentacao: Utensils,
  ocorrencia: Activity,
  passagem_plantao: ClipboardList,
  diurese: Droplet,
};

interface RecordCardProps {
  record: any;
  caregiverName?: string;
  elderName?: string;
  showSelfie?: boolean;
}

export function RecordCard({ record, caregiverName, elderName, showSelfie = true }: RecordCardProps) {
  const Icon = TYPE_ICONS[record.record_type as RecordType] ?? Activity;
  const selfieUrl = showSelfie ? (record.selfie_base64 || null) : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{RECORD_TYPE_LABELS[record.record_type as RecordType]}</Badge>
            <span className="text-xs text-muted-foreground">{formatDateTime(record.created_at)}</span>
          </div>
          {elderName && <p className="mt-1 text-sm font-semibold">{elderName}</p>}
          <ul className="mt-1 space-y-0.5 text-sm">
            {formatRecordData(record).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {record.notes && <p className="mt-1 text-sm text-muted-foreground">“{record.notes}”</p>}
          {caregiverName && (
            <p className="mt-1.5 text-xs text-muted-foreground">Registrado por {caregiverName}</p>
          )}
        </div>
        {showSelfie && selfieUrl && (
          <img
            src={selfieUrl}
            alt="Assinatura facial do cuidador"
            loading="lazy"
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-xl border object-cover"
            title="Assinatura facial"
          />
        )}
      </CardContent>
    </Card>
  );
}