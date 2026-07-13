import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  calcAge,
  formatDateTime,
  formatRecordData,
  RECORD_TYPE_LABELS,
  SEVERITY_LABELS,
  type Alert,
  type CareRecord,
  type Elder,
  type Profile,
  type RecordType,
} from "@/lib/care";

function groupByDay(records: CareRecord[]): Map<string, CareRecord[]> {
  const map = new Map<string, CareRecord[]>();
  for (const r of records) {
    const day = new Date(r.created_at).toLocaleDateString("pt-BR");
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(r);
  }
  return map;
}

export function generateElderReport(opts: {
  elder: Elder;
  records: CareRecord[];
  alerts: Alert[];
  profiles: Profile[];
  range?: { from: string | null; to: string | null };
}) {
  const { elder, records, alerts, profiles, range } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name || "Cuidador";

  // Header
  doc.setFillColor(34, 102, 68);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("CuidarBem", marginX, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Relatório de cuidados", marginX, 60);
  doc.setFontSize(9);
  doc.text(`Emitido em ${formatDateTime(new Date().toISOString())}`, marginX, 76);

  let y = 120;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(elder.full_name, marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  if (elder.birth_date) {
    doc.text(calcAge(elder.birth_date), marginX, y);
    y += 14;
  }
  if (elder.medical_notes) {
    const notes = doc.splitTextToSize(`Observações: ${elder.medical_notes}`, pageWidth - marginX * 2);
    doc.text(notes, marginX, y);
    y += notes.length * 12;
  }
  if (range && (range.from || range.to)) {
    const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
    const label = range.from && range.to
      ? `Período: ${fmt(range.from)} a ${fmt(range.to)}`
      : range.from
        ? `Período: a partir de ${fmt(range.from)}`
        : `Período: até ${fmt(range.to!)}`;
    doc.text(label, marginX, y);
    y += 14;
  }
  y += 10;

  // Alerts section
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Alertas", marginX, y);
  y += 8;
  if (alerts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Data", "Severidade", "Mensagem", "Status"]],
      body: alerts.map((a) => [
        formatDateTime(a.created_at),
        SEVERITY_LABELS[a.severity] ?? a.severity,
        a.message,
        a.resolved ? "Resolvido" : "Aberto",
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [34, 102, 68] },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  } else {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text("Nenhum alerta registrado.", marginX, y);
    y += 24;
  }

  // Daily history
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Histórico diário", marginX, y);
  y += 12;

  const byDay = groupByDay(records);
  if (byDay.size === 0) {
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text("Nenhum registro de cuidado.", marginX, y);
  } else {
    for (const [day, dayRecords] of byDay) {
      autoTable(doc, {
        startY: y,
        head: [[`${day}`, "", "", ""]],
        body: dayRecords.map((r) => [
          formatDateTime(r.created_at).split(" ").pop() ?? "",
          RECORD_TYPE_LABELS[r.record_type as RecordType] ?? r.record_type,
          formatRecordData(r).join(" · ") || (r.notes ?? "—"),
          nameOf(r.caregiver_id),
        ]),
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 110 },
          3: { cellWidth: 100 },
        },
        styles: { fontSize: 9, cellPadding: 4, valign: "top" },
        headStyles: { fillColor: [225, 236, 229], textColor: [20, 60, 40], fontStyle: "bold" },
        margin: { left: marginX, right: marginX },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    }
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" },
    );
  }

  const safeName = elder.full_name.replace(/[^\p{L}\p{N}]+/gu, "_");
  doc.save(`relatorio_${safeName}.pdf`);
}