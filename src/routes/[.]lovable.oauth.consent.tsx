import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthResult = { data: { redirect_url?: string; redirect_to?: string; client?: { name?: string } } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails(id: string): Promise<OAuthResult>;
  approveAuthorization(id: string): Promise<OAuthResult>;
  denyAuthorization(id: string): Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  head: () => ({
    meta: [
      { title: "Connect an assistant — First Fly International" },
      { name: "description", content: "Approve an AI assistant to access your visa cases." },
      { property: "og:title", content: "Connect an assistant — First Fly International" },
      { property: "og:description", content: "Approve an AI assistant to access your visa cases." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-sm p-6 text-sm text-navy">Could not load this authorization request: {error instanceof Error ? error.message : String(error)}</main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? "An app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve ? await oauth().approveAuthorization(authorization_id) : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen bg-background px-5 py-12">
      <div className="mx-auto max-w-sm rounded-3xl border bg-card p-6 shadow-soft">
        <p className="font-display text-2xl font-extrabold italic"><span className="text-blue">First</span> <span className="text-gold">Fly</span></p>
        <h1 className="mt-4 text-xl font-extrabold text-navy">Connect {name} to your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">{name} will be able to view your applicant cases, read document analysis and open new draft cases as you.</p>
        {error && <p role="alert" className="mt-3 text-sm text-fail">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button disabled={busy} onClick={() => decide(false)} className="rounded-2xl border py-3 text-sm font-semibold text-navy disabled:opacity-60">Deny</button>
          <button disabled={busy} onClick={() => decide(true)} className="gradient-blue rounded-2xl py-3 text-sm font-bold text-card shadow-glow disabled:opacity-60">Approve</button>
        </div>
      </div>
    </main>
  );
}
