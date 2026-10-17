import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { COUNTRIES, DOC_TYPES } from "../../visa-data";

export default defineTool({
  name: "list_visa_documents",
  title: "List visa PDF templates",
  description: "List the visa PDF documents available per destination country, with their download paths on this site.",
  inputSchema: { country: z.string().optional().describe("Country name or slug to filter, e.g. Malaysia.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ country }) => {
    const f = country?.toLowerCase().replace(/[^a-z]/g, "");
    const list = COUNTRIES.filter((c) => !f || c.slug.toLowerCase().replace(/[^a-z]/g, "") === f || c.name.toLowerCase().replace(/[^a-z]/g, "") === f).map((c) => ({
      country: c.name,
      slug: c.slug,
      documents: DOC_TYPES.map((d) => ({ type: d.label, path: `/docs/${c.slug}_${d.key}.pdf` })),
    }));
    return { content: [{ type: "text", text: JSON.stringify(list) }], structuredContent: { countries: list } };
  },
});
