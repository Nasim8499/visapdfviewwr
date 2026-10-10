export type DocType =
  | "Visitor_Visa"
  | "Work_Visa"
  | "Work_Permit"
  | "Sponsorship_Letter"
  | "Application_Receipt"
  | "Employment_Agreement"
  | "Visa_Pages";

export const DOC_TYPES: { key: DocType; label: string; short: string; isNew?: boolean }[] = [
  { key: "Application_Receipt", label: "Application Submission Acknowledgement Receipt", short: "Receipt", isNew: true },
  { key: "Employment_Agreement", label: "Employment Agreement", short: "Agreement", isNew: true },
  { key: "Visa_Pages", label: "Visa Pages", short: "Visa Pages", isNew: true },
  { key: "Visitor_Visa", label: "Visitor Visa", short: "Visitor" },
  { key: "Work_Visa", label: "Work Visa", short: "Work Visa" },
  { key: "Work_Permit", label: "Work Permit", short: "Permit" },
  { key: "Sponsorship_Letter", label: "Sponsorship Letter", short: "Sponsor" },
];

export interface Country {
  name: string;
  slug: string; // file slug e.g. New_Zealand
  region: string;
  updated: string;
}

export const COUNTRIES: Country[] = [
  { name: "Australia", slug: "Australia", region: "Oceania", updated: "08 Oct 2026" },
  { name: "Serbia", slug: "Serbia", region: "Europe", updated: "07 Oct 2026" },
  { name: "Singapore", slug: "Singapore", region: "Asia", updated: "06 Oct 2026" },
  { name: "Malaysia", slug: "Malaysia", region: "Asia", updated: "05 Oct 2026" },
  { name: "Saudi Arabia", slug: "Saudi_Arabia", region: "Middle East", updated: "04 Oct 2026" },
  { name: "Bahrain", slug: "Bahrain", region: "Middle East", updated: "03 Oct 2026" },
  { name: "United Arab Emirates", slug: "United_Arab_Emirates", region: "Middle East", updated: "02 Oct 2026" },
  { name: "Kuwait", slug: "Kuwait", region: "Middle East", updated: "01 Oct 2026" },
  { name: "Estonia", slug: "Estonia", region: "Europe", updated: "30 Sep 2026" },
  { name: "Lithuania", slug: "Lithuania", region: "Europe", updated: "29 Sep 2026" },
  { name: "Malta", slug: "Malta", region: "Europe", updated: "28 Sep 2026" },
  { name: "Moldova", slug: "Moldova", region: "Europe", updated: "27 Sep 2026" },
  { name: "Montenegro", slug: "Montenegro", region: "Europe", updated: "26 Sep 2026" },
  { name: "Morocco", slug: "Morocco", region: "Africa", updated: "25 Sep 2026" },
  { name: "New Zealand", slug: "New_Zealand", region: "Oceania", updated: "24 Sep 2026" },
];

const photos = import.meta.glob("/src/assets/countries/*.jpg", { eager: true, import: "default" }) as Record<string, string>;
export const photoUrl = (slug: string) => photos[`/src/assets/countries/${slug}.jpg`];

export const pdfUrl = (slug: string, doc: DocType) => `/docs/${slug}_${doc}.pdf`;
export const flagUrl = (slug: string) => `/flags/${slug}.svg`;
