import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_case",
  title: "Get applicant case",
  description: "Get one applicant case with its status history and uploaded documents (including AI analysis results).",
  inputSchema: { case_id: z.string().uuid().describe("Case ID from list_cases.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ case_id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: c, error } = await sb.from("applicant_cases").select("*").eq("id", case_id).maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!c) throw new ToolError("Case not found");
    const { data: docs } = await sb
      .from("case_documents")
      .select("id, doc_kind, file_name, mime_type, analysis_status, analysis, created_at")
      .eq("case_id", case_id);
    const result = { case: c, documents: docs ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
