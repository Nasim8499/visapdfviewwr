import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCases from "./tools/list-cases";
import getCase from "./tools/get-case";
import createCase from "./tools/create-case";
import listVisaDocuments from "./tools/list-visa-documents";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "mobile-app-master",
  title: "Mobile App Master",
  version: "0.1.0",
  instructions:
    "First Fly International visa tools. Browse the signed-in user's applicant cases, read case details and document analysis, open new draft cases, and list the visa PDF templates available per country.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCases, getCase, createCase, listVisaDocuments],
});
