CREATE TABLE public.applicant_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  applicant_name text NOT NULL,
  passport_no text,
  country_slug text NOT NULL,
  visa_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_on date,
  biometrics_on date,
  decision_expected_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_cases TO authenticated;
GRANT ALL ON public.applicant_cases TO service_role;
ALTER TABLE public.applicant_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cases select" ON public.applicant_cases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own cases insert" ON public.applicant_cases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cases update" ON public.applicant_cases FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cases delete" ON public.applicant_cases FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ON public.applicant_cases (user_id, updated_at DESC);

CREATE TABLE public.case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.applicant_cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  doc_kind text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  analysis jsonb,
  analysis_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_documents TO authenticated;
GRANT ALL ON public.case_documents TO service_role;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs select" ON public.case_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own docs insert" ON public.case_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.applicant_cases c WHERE c.id = case_id AND c.user_id = auth.uid()));
CREATE POLICY "own docs update" ON public.case_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own docs delete" ON public.case_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "case docs read own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'case-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "case docs upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'case-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "case docs delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'case-docs' AND (storage.foldername(name))[1] = auth.uid()::text);