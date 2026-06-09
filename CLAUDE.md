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

### AI Agent Routes
- Resident agent: `src/app/api/agent/resident/route.ts`
- Admin agent: `src/app/api/agent/admin/route.ts`
- Tools for each agent are defined in `src/lib/ai/resident-tools.ts` and `src/lib/ai/admin-tools.ts`
- **Security rule:** Never add admin tools to the resident route, even conditionally. The separation must be structural, not runtime-conditional.
- Every tool `execute` function must scope database queries to `profile.hoa_id` — never trust client-provided `hoa_id`
- Use `streamText` from the `ai` package and return `result.toDataStreamResponse()`

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
