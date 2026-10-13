import { COUNTRIES } from "@/lib/visa-data";

export const STATUSES = [
  { key: "draft", label: "Draft", bn: "খসড়া" },
  { key: "documents", label: "Collecting Documents", bn: "কাগজপত্র সংগ্রহ" },
  { key: "submitted", label: "Application Submitted", bn: "আবেদন জমা" },
  { key: "biometrics", label: "Biometrics / Medical", bn: "বায়োমেট্রিক / মেডিকেল" },
  { key: "review", label: "Under Review", bn: "যাচাই চলছে" },
  { key: "approved", label: "Visa Approved", bn: "ভিসা অনুমোদিত" },
  { key: "rejected", label: "Rejected", bn: "প্রত্যাখ্যাত" },
] as const;
export type StatusKey = (typeof STATUSES)[number]["key"];
export const FLOW: StatusKey[] = ["draft", "documents", "submitted", "biometrics", "review", "approved"];

export const VISA_TYPES = ["Work Visa", "Work Permit", "Visitor Visa", "Sponsorship"] as const;

export const DOC_KINDS = [
  "Passport",
  "Photo",
  "Police Clearance",
  "Medical Certificate",
  "Employment Agreement",
  "Educational Certificate",
  "Bank Statement",
  "Sponsorship Letter",
  "Other",
] as const;

const REQUIRED: Record<string, string[]> = {
  "Work Visa": ["Passport", "Photo", "Police Clearance", "Medical Certificate", "Employment Agreement", "Educational Certificate"],
  "Work Permit": ["Passport", "Photo", "Police Clearance", "Medical Certificate", "Employment Agreement"],
  "Visitor Visa": ["Passport", "Photo", "Bank Statement"],
  Sponsorship: ["Passport", "Photo", "Sponsorship Letter", "Bank Statement"],
};
export const requiredDocs = (visaType: string) => REQUIRED[visaType] ?? REQUIRED["Work Visa"];

export const statusLabel = (k: string) => STATUSES.find((s) => s.key === k);
export const countryName = (slug: string) => COUNTRIES.find((c) => c.slug === slug)?.name ?? slug;

export type HistoryEntry = { status: string; at: string; note?: string };

export type CaseRow = {
  id: string;
  applicant_name: string;
  passport_no: string | null;
  country_slug: string;
  visa_type: string;
  status: string;
  history: HistoryEntry[];
  submitted_on: string | null;
  biometrics_on: string | null;
  decision_expected_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Milestone = { label: string; date: string | null; done: boolean };

export function milestones(c: CaseRow, uploadedKinds: string[]): Milestone[] {
  const idx = FLOW.indexOf(c.status as StatusKey);
  const missing = requiredDocs(c.visa_type).filter((d) => !uploadedKinds.includes(d));
  return [
    { label: missing.length ? `Upload ${missing.length} missing document(s)` : "All required documents uploaded", date: null, done: missing.length === 0 },
    { label: "Submit application", date: c.submitted_on, done: idx >= 2 },
    { label: "Biometrics / medical appointment", date: c.biometrics_on, done: idx >= 4 },
    { label: "Expected decision", date: c.decision_expected_on, done: c.status === "approved" || c.status === "rejected" },
  ];
}

export const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
