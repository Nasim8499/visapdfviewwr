<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Chat history lives in Cloud tables chat_threads/chat_messages with owner-only RLS; the browser writes messages, /api/chat only streams AI after verifying the bearer token — keeps the AI endpoint closed to anonymous use.
- Chat pages live under src/routes/_authenticated (list at /chat, thread at /chat/$threadId) — every thread has its own reloadable URL.
