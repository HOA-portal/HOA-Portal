# HOA Portal

An AI-powered management platform for US Homeowners Associations (HOAs) and self-managed condominiums.

## What It Does

HOA Portal gives every community two AI agents in a single dashboard — one for residents, one for the board — each with strictly scoped permissions. The AI knows your community's rules, handles requests, and automates communications.

**For residents:**
- Ask questions about CC&Rs and get answers with exact section citations
- Submit maintenance requests by describing the problem in plain language
- Check availability and book amenities
- Get payment links and dues status

**For board members (admins):**
- Draft and publish community announcements with AI assistance
- Issue formal violation notices from a photo — AI drafts the letter and cites the rule
- Manage and triage maintenance work orders
- Send payment reminders to delinquent residents

## Target Market

**Primary: Self-Managed HOAs** — smaller communities run by volunteer board members who lack technical staff. The AI replaces the need for a property manager.

**Secondary: Property Management Companies** — firms managing dozens of HOAs. The AI becomes a force multiplier, letting one manager handle far more communities without losing service quality.

## Stack

| Layer | Technology |
|---|---|
| Frontend & Backend | Next.js 14+ (App Router, TypeScript) |
| Database & Auth | Supabase (Postgres + Row Level Security + Auth) |
| AI | Anthropic Claude via Vercel AI SDK |
| Vector Search | pgvector (Supabase extension) |
| Email | Resend |
| SMS | Twilio |
| Deployment | Vercel |
| UI | Tailwind CSS + shadcn/ui |

## Architecture Overview

### Multi-Tenancy
Each HOA is an isolated tenant. Every database table carries an `hoa_id` column. Supabase Row Level Security (RLS) enforces tenant isolation at the database level — no application-layer filtering is trusted alone.

### Role-Based AI Agents
Authentication determines which agent and which tools a user gets:

- **Resident agent** (`/api/agent/resident`) — read-only tools: search CC&Rs, open work orders, check bookings, get invoices.
- **Admin agent** (`/api/agent/admin`) — superset: all resident tools plus draft announcements, issue violations, manage work orders, send reminders.

Tool availability is enforced at the API route level. A resident cannot trigger an admin tool even via prompt injection because admin tools are never instantiated in the resident route.

### CC&Rs RAG Pipeline
Admins upload HOA rule PDFs. The system chunks them by section header (Article / Section patterns), embeds each chunk using a text embedding model, and stores embeddings in pgvector. When a resident or the AI asks a question, the nearest chunks are retrieved and Claude answers with section citations.

### Resident Onboarding (Invite Flow)
HOAs don't ask residents to self-register from scratch. Admins upload a CSV exported from any property management CRM (AppFolio, Yardi, Buildium, spreadsheets) and the system creates `resident_invitations` records — shadow profiles with no auth account yet. An invitation email is sent via Resend. Residents click the link, choose a password, and their account activates. Deactivated profiles (`is_active = false`) lose all data access because the `my_hoa_id()` RLS helper returns NULL, causing every policy to fail — without deleting any historical data.

## Local Development Setup

### Prerequisites
- Node.js 20+
- Supabase CLI (`npm install -g supabase`)
- Accounts: Supabase, Anthropic, Resend, Twilio (can stub SMS in dev)

### Steps

```bash
# 1. Clone and install
git clone https://github.com/Zanettis/HOA-Portal.git
cd HOA-Portal
npm install

# 2. Start local Supabase
supabase start

# 3. Apply migrations
supabase db push

# 4. Copy env template and fill in values
cp .env.example .env.local

# 5. Run dev server
npm run dev
```

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only — never expose to client

# AI
ANTHROPIC_API_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_ADDRESS=noreply@yourhoa.app

# SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # login, signup, OAuth callback
│   ├── (app)/           # protected routes — dashboard, agent, modules
│   └── api/             # agent routes, CRUD APIs, notification routes
├── components/          # UI components by feature
├── lib/
│   ├── supabase/        # client.ts, server.ts (SSR-safe clients)
│   ├── ai/              # tool definitions, system prompts, RAG helpers
│   └── notifications/   # Resend and Twilio wrappers
└── types/               # Supabase generated types + app interfaces
supabase/
└── migrations/          # SQL migrations — schema, RLS, storage buckets
```

## Security Model

- **Authentication first** — all app routes redirect to login if unauthenticated (enforced in `src/middleware.ts`)
- **RLS everywhere** — every Supabase table has Row Level Security enabled; two helper functions (`my_hoa_id()`, `my_role()`) scope all queries automatically
- **Tool-level authorization** — AI tools are constructed at the server side per authenticated user role; the AI cannot use tools it was never given
- **Service role key is server-only** — only used in API routes and never sent to the browser
- **No cross-tenant leakage** — tested explicitly in the verification suite

## Feature Roadmap (MVP Phases)

1. ✅ **Foundation** — Auth, multi-tenancy, role-aware dashboard
2. ✅ **CC&Rs Oracle** — PDF upload, chunking, embedding, hybrid RAG search (pgvector + tsvector RRF), AI Q&A with citations
3. ✅ **Work Orders** — resident submission via chat, admin triage
4. ✅ **Announcements** — AI drafting, publish, email/SMS blast
5. ✅ **Amenity Bookings** — calendar, conflict prevention, dues gate
6. ✅ **Violations** — photo upload, AI-drafted formal notice, send to resident
7. ✅ **Resident Invite Flow** — bulk CSV import, shadow profiles, email invitations, profile deactivation with immediate session invalidation
8. **CRM Webhooks** — real-time sync with AppFolio, Yardi, Buildium (move-in/move-out automation)
9. **Polish & Deploy** — rate limiting, mobile optimization, production Vercel deploy
