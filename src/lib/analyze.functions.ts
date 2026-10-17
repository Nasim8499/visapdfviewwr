import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalysisSchema = z.object({
  detected_type: z.string(),
  summary: z.string(),
  fields: z.array(z.object({ label: z.string(), value: z.string() })),
  issues: z.array(z.object({ severity: z.enum(["missing", "inconsistent", "warning"]), message: z.string() })),
  expiry_date: z.string().nullable(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) => {
    if (typeof input?.documentId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.documentId)) throw new Error("Invalid document");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: doc, error } = await supabase.from("case_documents").select("*").eq("id", data.documentId).single();
    if (error || !doc) throw new Error("Document not found");
    const { data: c } = await supabase.from("applicant_cases").select("*").eq("id", doc.case_id).single();
    if (!c) throw new Error("Case not found");
    const { data: others } = await supabase
      .from("case_documents")
      .select("doc_kind, analysis")
      .eq("case_id", doc.case_id)
      .neq("id", doc.id)
      .eq("analysis_status", "done");

    const save = (patch: { analysis?: unknown; analysis_status: string }) =>
      supabase.from("case_documents").update(patch as never).eq("id", doc.id);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const { data: file, error: dlErr } = await supabase.storage.from("case-docs").download(doc.storage_path);
    if (dlErr || !file) {
      await save({ analysis_status: "failed" });
      throw new Error("Could not read the uploaded file");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const b64 = btoa(bin);
    const isPdf = doc.mime_type === "application/pdf";
    if (!isPdf && !doc.mime_type.startsWith("image/")) {
      await save({ analysis_status: "failed" });
      throw new Error("Only PDF or image files can be analysed");
    }

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const context_ = `Case: applicant "${c.applicant_name}", passport "${c.passport_no ?? "not given"}", destination ${c.country_slug}, visa type ${c.visa_type}.
Uploaded as: ${doc.doc_kind}.
Other analysed documents in this case (for cross-checking): ${JSON.stringify((others ?? []).map((o) => ({ kind: o.doc_kind, fields: (o.analysis as Analysis | null)?.fields })))}
Today: ${new Date().toISOString().slice(0, 10)}`;

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system:
        "You are a meticulous visa document checker. Read the attached document and extract its key details (name, document number, dates of birth/issue/expiry, nationality, employer, salary, issuing authority, etc. as applicable). Flag: 'missing' for required fields that are absent or unreadable; 'inconsistent' when names, passport numbers or dates disagree with the case details or other documents, or when the document does not match the type it was uploaded as; 'warning' for expiry within 6 months, low quality, or other risks. Write the summary and issue messages in Bangla; keep field labels in English. Do not invent values.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: context_ },
            isPdf
              ? { type: "file", data: b64, mediaType: "application/pdf", filename: doc.file_name }
              : { type: "image", image: b64, mediaType: doc.mime_type },
          ],
        },
      ],
      output: Output.object({ schema: AnalysisSchema }),
      maxRetries: 0,
      providerOptions: {
        openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
      },
    });

    try {
      const analysis = await result.output;
      await save({ analysis, analysis_status: "done" });
      return { analysis };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.error("analyze failed", status, (e as Error).message);
      await save({ analysis_status: "failed" });
      throw new Error(
        status === 429 ? "অনেক বেশি অনুরোধ — একটু পরে চেষ্টা করুন।" : status === 402 ? "AI ক্রেডিট শেষ — ক্রেডিট যোগ করুন।" : "ডকুমেন্ট বিশ্লেষণ করা যায়নি।",
      );
    }
  });

const PassportSchema = z.object({
  full_name: z.string().nullable(),
  passport_no: z.string().nullable(),
  date_of_birth: z.string().nullable().describe("YYYY-MM-DD"),
  nationality: z.string().nullable().describe("Country name in English"),
  readable: z.boolean(),
});
export type PassportScan = z.infer<typeof PassportSchema>;

export const scanPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string; mediaType: string }) => {
    if (typeof input?.image !== "string" || input.image.length > 9_000_000) throw new Error("Image too large (max ~6 MB)");
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(input.mediaType)) throw new Error("Please upload a JPG, PNG or WEBP photo");
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system:
        "You read passport / national ID photos. Extract the holder's full name (given names + surname, as printed), document number, date of birth (YYYY-MM-DD) and nationality (English country name). Use the MRZ to confirm values when visible. Return null for anything not clearly legible. Set readable=false if this is not an identity document. Never guess.",
      messages: [{ role: "user", content: [{ type: "image", image: data.image, mediaType: data.mediaType }] }],
      output: Output.object({ schema: PassportSchema }),
      maxRetries: 0,
      providerOptions: {
        openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
      },
    });
    try {
      return { scan: await result.output };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.error("scanPassport failed", status, (e as Error).message);
      throw new Error(status === 429 ? "Too many requests — try again shortly." : status === 402 ? "AI credits exhausted." : "Could not read the document photo.");
    }
  });
