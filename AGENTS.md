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

- Questionnaire choices render bundled local SVG emoji artwork for consistent, playful icons across platforms.
- Database access goes through src/db (typed client, schema types, repositories); schema changes are numbered SQL files in src/db/migrations applied by `bun run db:migrate`, so the database never needs manual imports.
- Database settings come from root .env (VITE_* for browser, DB_*/DATABASE_URL server-only) with fallbacks in src/db/utils/config.ts, because .env is not deployed with the published site.
