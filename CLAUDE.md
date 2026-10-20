# NexoBot – working notes for Claude

TypeScript Discord bot (discord.js v14) with an Express API and a React/Vite/Tailwind v4 dashboard (`dashboard/`),
PostgreSQL. Fork of TitanBot (the LICENSE keeps the codebymitch line).

## Communication and style

- Code, comments and commit messages in English; talk to the user in German.
- Commit footer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- PR body footer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Git workflow

- Never commit on `main`: start a new branch from an up-to-date `main` for every piece of work.
- Do not push or open a PR without asking.
- **After a PR is merged, delete its branch locally and on GitHub** (`git branch -d <branch>`,
  `git push origin --delete <branch>`, `git fetch --prune`), then switch to `main` and pull. Keeps the branch tree
  clean and makes sure nobody keeps working on a branch that is already published.
- Railway does not deploy merges by itself: `railway redeploy --from-source --service NexoBot -y`.

## Do not change

- DB tables, DB columns, key prefixes `guild:{guildId}:...`, the schema ledger (v1 `baseline-v1`) and the DB defaults
  in `src/config/database/postgres.ts`.
- customIds of buttons, menus and modals.
- No secrets in commits; `.env.example` only holds placeholders.
- Never use the production database (Railway) for local tests: use a separate test bot and Docker Postgres.

## Checks before committing

- `npm run typecheck`, `npm run build`, `npm test`.
- Dashboard changes: check them in the mock preview (`npx vite --config dashboard/vite.mock.config.ts`, port 5199,
  launch config "dashboard-mock"), desktop and 375 px, dark and light mode.
- Text contrast ≥ 4.5:1 in both modes (`tests/contrast.test.ts` reads the tokens from `dashboard/src/styles.css`).
