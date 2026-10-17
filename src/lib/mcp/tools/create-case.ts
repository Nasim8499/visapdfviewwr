import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { COUNTRIES } from "../../visa-data";
import { VISA_TYPES } from "../../cases";

export default defineTool({
  name: "create_case",
  title: "Create applicant case",
  description: "Open a new draft visa applicant case in your account.",
  inputSchema: {
    applicant_name: z.string().min(1).max(120).describe("Full name as in passport."),
    country_slug: z.enum(COUNTRIES.map((c) => c.slug) as [string, ...string[]]).describe("Destination country slug."),
    visa_type: z.enum(VISA_TYPES as unknown as [string, ...string[]]).describe("Visa type."),
    passport_no: z.string().max(30).optional(),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
    nationality: z.string().max(60).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("applicant_cases")
      .insert({
        applicant_name: a.applicant_name,
        country_slug: a.country_slug,
        visa_type: a.visa_type,
        passport_no: a.passport_no?.toUpperCase() ?? null,
        date_of_birth: a.date_of_birth ?? null,
        nationality: a.nationality ?? null,
        status: "draft",
        history: [{ status: "draft", at: new Date().toISOString() }],
      })
      .select("id")
      .single();
    if (error || !data) throw new ToolError(error?.message ?? "Could not create case");
    return { content: [{ type: "text", text: `Created case ${data.id}` }], structuredContent: { id: data.id } };
  },
});
