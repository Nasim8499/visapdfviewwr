export type DocType = "Visitor_Visa" | "Work_Visa" | "Work_Permit" | "Sponsorship_Letter";

export const DOC_TYPES: { key: DocType; label: string; short: string }[] = [
  { key: "Visitor_Visa", label: "Visitor Visa", short: "Visitor" },
  { key: "Work_Visa", label: "Work Visa", short: "Work Visa" },
  { key: "Work_Permit", label: "Work Permit", short: "Permit" },
  { key: "Sponsorship_Letter", label: "Sponsorship Letter", short: "Sponsor" },
];

export interface Country {
  name: string;
  slug: string; // file slug e.g. New_Zealand
  region: string;
}

export const COUNTRIES: Country[] = [
  { name: "Australia", slug: "Australia", region: "Oceania" },
  { name: "Bahrain", slug: "Bahrain", region: "Middle East" },
  { name: "Estonia", slug: "Estonia", region: "Europe" },
  { name: "Kuwait", slug: "Kuwait", region: "Middle East" },
  { name: "Lithuania", slug: "Lithuania", region: "Europe" },
  { name: "Malaysia", slug: "Malaysia", region: "Asia" },
  { name: "Malta", slug: "Malta", region: "Europe" },
  { name: "Moldova", slug: "Moldova", region: "Europe" },
  { name: "Montenegro", slug: "Montenegro", region: "Europe" },
  { name: "Morocco", slug: "Morocco", region: "Africa" },
  { name: "New Zealand", slug: "New_Zealand", region: "Oceania" },
  { name: "Saudi Arabia", slug: "Saudi_Arabia", region: "Middle East" },
  { name: "Serbia", slug: "Serbia", region: "Europe" },
  { name: "Singapore", slug: "Singapore", region: "Asia" },
  { name: "United Arab Emirates", slug: "United_Arab_Emirates", region: "Middle East" },
];

export const pdfUrl = (slug: string, doc: DocType) => `/docs/${slug}_${doc}.pdf`;
export const flagUrl = (slug: string) => `/flags/${slug}.svg`;
