# CLAUDE.md — HOA Portal

Instructions for Claude Code working in this repository.

## What This Project Is

An AI-powered SaaS platform for US Homeowners Associations. It has two user roles — **resident** and **admin** — each with a distinct AI agent that has strictly different tool permissions. Multi-tenant: each HOA is an isolated tenant.

## Tech Stack

- **Next.js 14+** with App Router and TypeScript (no Pages Router)
- **Supabase** for Postgres, Auth, Storage, and pgvector
- **Vercel AI SDK** (`ai` package) with `streamText` and `useChat`
- **Anthropic Claude** as the LLM (`claude-sonnet-4-5` default)
- **Tailwind CSS + shadcn/ui** for all UI components
- **Resend** for email, **Twilio** for SMS

## Project Conventions

### File Structure
- All source code lives under `src/`
- App Router routes under `src/app/`
- Protected routes grouped under `src/app/(app)/`
- Auth routes grouped under `src/app/(auth)/`
- API routes under `src/app/api/`
- Reusable logic under `src/lib/` (supabase, ai, notifications)
- UI components under `src/components/`, organized by feature

### TypeScript
- Strict mode enabled; no `any` unless absolutely necessary
- Generate Supabase types with `supabase gen types typescript` into `src/types/database.ts`
- Import from `@/` path alias (maps to `src/`)

### Supabase Clients
- **Browser components** use `src/lib/supabase/client.ts` (singleton browser client)
- **Server components, API routes, middleware** use `src/lib/supabase/server.ts` (cookie-based SSR client)
- **Never** use the service role key in client-side code
- **Never** bypass RLS with the service role key unless explicitly required for a background job

### Database Rules
- Every table must have `hoa_id uuid NOT NULL REFERENCES hoas(id)`
- Every table must have RLS enabled with at least one policy
- Always use the `my_hoa_id()` and `my_role()` helper functions in policies — never inline subqueries
- All migrations go in `supabase/migrations/` as numbered SQL files (`001_`, `002_`, etc.)
- Never modify existing migrations; always create a new one
- `profiles.is_active = false` → `my_hoa_id()` and `my_role()` return NULL → all RLS policies fail → user loses data access without account deletion
- `resident_invitations` holds shadow profiles (no `auth.users` row yet); a full `profiles` row is only created when the resident accepts the invite via `/accept-invite/[token]`

### AI Agent Routes
- Resident agent: `src/app/api/agent/resident/route.ts`
- Admin agent: `src/app/api/agent/admin/route.ts`
- Tools for each agent are defined in `src/lib/ai/resident-tools.ts` and `src/lib/ai/admin-tools.ts`
- **Security rule:** Never add admin tools to the resident route, even conditionally. The separation must be structural, not runtime-conditional.
- Every tool `execute` function must scope database queries to `profile.hoa_id` — never trust client-provided `hoa_id`
- Use `streamText` from the `ai` package and return `result.toDataStreamResponse()`

### Resident Invite Flow
- Admin uploads CSV at `POST /api/admin/residents/import` → rows inserted into `resident_invitations` + invitation email sent via Resend
- Resident clicks link → `GET /accept-invite/[token]` (server component) fetches data via `get_invitation_by_token()` SECURITY DEFINER function (no auth session required)
- `POST /api/auth/accept-invite` creates `auth.users` + `profiles` (with `is_active = true`) and marks `accepted_at` on the invitation
- `PATCH /api/admin/residents/[id]/deactivate` with `{ active: false }` sets `profiles.is_active = false` and calls `auth.admin.signOut` to invalidate sessions
- The traditional signup route (`POST /api/auth/signup`) returns 409 if a pending invitation exists for that email + HOA, directing the user to use the invite link instead

### Notifications
- Email via `src/lib/notifications/email.ts` (wraps Resend)
- SMS via `src/lib/notifications/sms.ts` (wraps Twilio)
- Both are fire-and-forget in API routes; don't await in the critical path when possible

### UI Components
- Use shadcn/ui components from `src/components/ui/` (generated, don't edit directly)
- Custom components go in feature subfolders: `src/components/agent/`, `src/components/work-orders/`, etc.
- All pages are server components by default; add `"use client"` only when needed (event handlers, hooks, `useChat`)

## Security Checklist

Before any PR that touches auth, agents, or database:
- [ ] New table has `hoa_id` and RLS enabled
- [ ] New RLS policy uses `my_hoa_id()` helper
- [ ] New API route verifies `auth.getUser()` before doing anything
- [ ] No admin tool is accessible from the resident agent route
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` usage in client-side code
- [ ] No user-provided `hoa_id` trusted in server-side tool execution
- [ ] Invitation tokens are opaque UUIDs with 7-day TTL; lookup via `get_invitation_by_token()` (SECURITY DEFINER) only
- [ ] Profile deactivation calls `auth.admin.signOut(userId, 'global')` to immediately invalidate all sessions

## Running Locally

```bash
supabase start          # start local Supabase
npm run dev             # start Next.js dev server
```

Local Supabase dashboard: http://localhost:54323

## Key Files

| File | Purpose |
|---|---|
| `src/middleware.ts` | Edge middleware — redirects unauthenticated users |
| `src/lib/supabase/server.ts` | SSR-safe Supabase client used in all API routes |
| `src/lib/ai/resident-tools.ts` | Tool definitions for the resident agent |
| `src/lib/ai/admin-tools.ts` | Tool definitions for the admin agent (superset) |
| `src/lib/ai/rag.ts` | CC&R chunk search using pgvector |
| `src/lib/ai/system-prompts.ts` | System prompt templates for both agents |
| `supabase/migrations/001_init_schema.sql` | Source of truth for all table definitions |
| `supabase/migrations/002_rls_policies.sql` | All RLS policies and helper functions |
| `supabase/migrations/006_crm_integration.sql` | `profiles.email` + `is_active`, `resident_invitations`, `crm_integrations`, updated `my_hoa_id()`/`my_role()` helpers |
| `src/app/api/admin/residents/import/route.ts` | Bulk CSV import → creates invitations + sends emails |
| `src/app/api/auth/accept-invite/route.ts` | Converts invitation into `auth.users` + `profiles` |
| `src/app/(auth)/accept-invite/[token]/page.tsx` | Pre-login invite acceptance page |

## Testing Conventions

Framework: **Vitest** para unitários/integração, **Playwright** para E2E. Ver `TESTING.md` para o guia completo.

- Arquivos de teste: `src/**/*.test.ts` (co-locados com o fonte)
- Arquivos E2E: `e2e/**/*.spec.ts` — **nunca** em `src/`, pois o Vitest os capturaria
- Mock do Supabase: usar sempre `buildSupabaseMock()` de `src/test/mocks/supabase.ts`
- Libs instanciadas com `new` (OpenAI, Resend, Twilio): obrigatório usar `vi.hoisted()` no mock
- `redirect()` do Next.js: já mockado em `src/test/setup.ts` para lançar `Error('REDIRECT:/path')` — assertar com `.rejects.toThrow('REDIRECT:/chat')`
- Mocks globais automáticos: `next/navigation`, `next/cache`, `next/headers` — não redeclarar nos arquivos de teste

```bash
npm run test:run      # roda todos os testes
npm run test:coverage # coverage report
npm run test:e2e      # E2E Playwright
```

## What Not To Do

- Do not use the Pages Router (`src/pages/`) — App Router only
- Do not add agent tools conditionally based on runtime role checks inside a single route — use separate routes
- Do not skip RLS on any table "for now"
- Do not store secrets in `.env` committed to git — use `.env.local`
- Do not use `supabase.auth.getSession()` on the server — always use `supabase.auth.getUser()` (verifies with Supabase server)
- Do not create new UI components from scratch when shadcn/ui has an equivalent

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
