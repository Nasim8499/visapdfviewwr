import { jsPDF } from "jspdf";
import { type CaseRow, STATUSES, FLOW, countryName, fmtDate, milestones, requiredDocs, statusLabel } from "@/lib/cases";

type Doc = { doc_kind: string; file_name: string; analysis_status: string; analysis: { issues?: { severity: string; message: string }[] } | null };

export function downloadCaseSummary(c: CaseRow, docs: Doc[]) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  let y = 0;
  pdf.setFillColor(14, 42, 92);
  pdf.rect(0, 0, W, 28, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("First Fly International", 14, 13);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Applicant Case Summary", 14, 20);
  pdf.text(`Generated ${fmtDate(new Date().toISOString())}`, W - 14, 20, { align: "right" });
  pdf.setTextColor(20, 20, 30);
  y = 38;

  const section = (t: string) => {
    if (y > 265) { pdf.addPage(); y = 18; }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(30, 90, 200);
    pdf.text(t, 14, y);
    pdf.setDrawColor(210, 220, 235);
    pdf.line(14, y + 2, W - 14, y + 2);
    pdf.setTextColor(20, 20, 30);
    y += 9;
  };
  const row = (k: string, v: string) => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text(k, 14, y);
    pdf.setFont("helvetica", "normal"); pdf.text(v || "—", 70, y);
    y += 7;
  };

  section("Applicant Details");
  row("Applicant name", c.applicant_name);
  row("Passport number", c.passport_no ?? "");
  row("Destination", countryName(c.country_slug));
  row("Visa type", c.visa_type);
  row("Case ID", c.id.slice(0, 8).toUpperCase());
  row("Opened", fmtDate(c.created_at));

  section("Case Status");
  row("Current status", statusLabel(c.status)?.label ?? c.status);
  const idx = FLOW.indexOf(c.status as (typeof FLOW)[number]);
  FLOW.forEach((s, i) => {
    const done = i <= idx;
    const h = c.history.filter((e) => e.status === s).at(-1);
    pdf.setFillColor(done ? 30 : 220, done ? 150 : 225, done ? 90 : 235);
    pdf.circle(17, y - 1.3, 1.8, "F");
    pdf.setFont("helvetica", done ? "bold" : "normal");
    pdf.text(STATUSES.find((x) => x.key === s)!.label, 22, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(h ? fmtDate(h.at) : "", W - 14, y, { align: "right" });
    y += 6.5;
  });
  y += 2;
  section("Upcoming Milestones");
  const kinds = docs.map((d) => d.doc_kind);
  milestones(c, kinds).forEach((m) => {
    row(`${m.done ? "[x]" : "[ ]"} ${m.label}`.slice(0, 40), m.date ? fmtDate(m.date) : m.done ? "Done" : "Pending");
  });

  section("Required Documents Checklist");
  requiredDocs(c.visa_type).forEach((k) => {
    const d = docs.find((x) => x.doc_kind === k);
    const issues = d?.analysis?.issues?.length ?? 0;
    pdf.setDrawColor(120, 120, 140);
    pdf.rect(14, y - 3.5, 4, 4);
    if (d) { pdf.setFont("helvetica", "bold"); pdf.text("x", 15.1, y - 0.3); }
    pdf.setFont("helvetica", "normal");
    pdf.text(k, 22, y);
    pdf.text(!d ? "Missing" : d.analysis_status !== "done" ? "Uploaded (not checked)" : issues ? `Uploaded - ${issues} issue(s) flagged` : "Uploaded - verified", W - 14, y, { align: "right" });
    y += 7;
  });

  if (c.notes) {
    section("Notes");
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(c.notes.replace(/[^\x20-\x7E\n]/g, ""), W - 28);
    pdf.text(lines, 14, y);
  }
  pdf.setFontSize(8);
  pdf.setTextColor(130, 130, 140);
  pdf.text("This summary is for tracking purposes. Verify requirements with the official authority.", 14, 290);
  pdf.save(`Case_${c.applicant_name.replace(/[^A-Za-z0-9]+/g, "_")}_${c.id.slice(0, 8)}.pdf`);
}
