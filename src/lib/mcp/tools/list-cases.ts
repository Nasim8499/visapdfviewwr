import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_cases",
  title: "List applicant cases",
  description: "List your visa applicant cases, optionally filtered by status or a search term on applicant name / passport.",
  inputSchema: {
    status: z.string().optional().describe("Filter by case status, e.g. draft, submitted, approved."),
    search: z.string().max(80).optional().describe("Match applicant name or passport number."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, search }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("applicant_cases")
      .select("id, applicant_name, passport_no, nationality, date_of_birth, country_slug, visa_type, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (status) q = q.eq("status", status);
    if (search) {
      const s = search.replace(/[%,()]/g, "");
      q = q.or(`applicant_name.ilike.%${s}%,passport_no.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const cases = (data ?? []).map((c) => ({ ...c }));
    return { content: [{ type: "text", text: JSON.stringify(cases) }], structuredContent: { cases } };
  },
});
