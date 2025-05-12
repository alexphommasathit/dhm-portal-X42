# DHM Portal - HIPAA-Compliant Healthcare Application

This is a Next.js application with Supabase authentication and HIPAA compliance features built for healthcare provider management.

## Features

### Authentication

- Supabase authentication integration
- Sign-in/sign-out flows with error handling
- Password reset functionality
- Auth callback handling and error pages

### Role-Based Access Control (RBAC)

- Comprehensive permission matrix for different healthcare roles
- Protected routes and components based on user roles
- High-order component for role-based rendering
- Context provider for role permissions

### HIPAA Compliance Features

- Detailed audit logging system for PHI access
- Immutable audit records with fallback storage
- Automatic session timeout after inactivity (20 minutes)
- Database schema with Row Level Security policies

### Policy Document Management & Q&A

- Secure document upload (PDF, DOCX) directly to Supabase Storage from the client.
- Automated parsing of DOCX (via `docx-extractor` standard Supabase Function) and PDF (via `unjs/unpdf` in `policy-parser` Edge Function).
- Automated chunking of document text within the `policy-parser` Edge Function.
- Embedding generation for text chunks using OpenAI (`text-embedding-3-small`) via the `policy-embed` Edge Function.
- Hybrid search functionality combining semantic vector search (pgvector HNSW index on embeddings via `match_policy_chunks` SQL function) and full-text search (GIN index on `fts` generated column via `fts_policy_chunks` SQL function). Results are combined using Reciprocal Rank Fusion (RRF) in the `/api/policies/search` API route.
- AI-powered Question & Answering on policy documents using an LLM (e.g., GPT-3.5-turbo) via the `askPolicyQa` Supabase Edge Function, accessible through the `/api/ask-policy` API route.
- Integrated "Policy Assistant" sidebar in the admin document list view for a unified search and Q&A experience.

## Code Organization

We follow a **function/module-based organization** pattern for maintainability:

- Files are grouped by their functional domain rather than by file type
- API endpoints mirror the frontend structure where applicable
- Related components are kept together in the same directory

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed file organization rules and examples.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin protected routes
│   │   ├── policies/
│   │   │   ├── list/page.tsx     # Policy document list and assistant view
│   │   │   └── page.tsx          # Policy document upload page
│   │   └── page.tsx          # Policy document upload page
│   ├── api/                # API routes
│   │   ├── auth/           # Authentication API endpoints
│   │   ├── policies/
│   │   │   ├── search/route.ts # Hybrid search API
│   │   │   └── upload-metadata/route.ts # Metadata API for uploads
│   │   ├── ask-policy/route.ts   # Q&A API route
│   │   └── documents/
│   │       └── process/route.ts  # Triggers document processing (parsing/embedding)
│   ├── auth/               # Auth pages and flows
│   │   ├── error/          # Auth error page
│   │   ├── login/          # Login page
│   │   └── reset-password/ # Password reset flow
│   ├── patients/           # Patient protected routes
│   └── profile/            # User profile management
├── components/             # Reusable components
│   ├── auth/               # Auth-related components
│   ├── PolicyAssistantSidebar.tsx # New component
│   ├── Protected.tsx       # RBAC protection component
│   └── withRoleCheck.tsx   # HOC for role-based access
├── context/                # React context providers
│   ├── AuthContext.tsx     # Authentication state management
│   └── RBACContext.tsx     # Role-based permissions
├── lib/                    # Utility functions
│   ├── audit-logger.ts     # HIPAA-compliant audit logging
│   ├── policy-embedder.ts  # Client-side helper for embedding status
│   ├── policy-parser.ts    # Client-side helper for chunking status
│   ├── policy-uploader.ts  # Client-side helper for upload and processing initiation
│   ├── session-timeout.ts  # Automatic session timeout
│   └── supabase-cookie-helper.ts # Supabase cookie handling
├── sql/                    # Database definitions
│   ├── functions/
│   │   ├── fts_policy_chunks.sql
│   │   └── match_policy_chunks.sql
│   └── schema/             # SQL schema files (now mainly in supabase/migrations)
└── types/                  # TypeScript type definitions
    └── supabase.ts         # Supabase type definitions
```

## Getting Started

**Prerequisites:**

- Node.js and npm/yarn
- Supabase Account
- Supabase CLI (for local development and migrations): `npm install -g supabase`
- OpenAI Account and API Key

First, set up the environment variables:

1.  Create a `.env.local` file in the project root.
2.  Add your Supabase and OpenAI credentials:

```plaintext
# Supabase credentials (replace with your actual values)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# OpenAI API Key (replace with your actual key)
OPENAI_API_KEY=sk-...

# Supabase Service Role Key (required for some backend operations)
# Get this from your Supabase Project Settings -> API -> Project API keys
PRIVATE_SUPABASE_SERVICE_KEY=your-supabase-service-role-key 
# OR use SUPABASE_SERVICE_ROLE_KEY if that's what you named it

# Supabase URL (often same as public, but needed for server-side/functions)
SUPABASE_URL=your-supabase-url 
```

**Local Development Setup:**

1.  **Start Supabase Services:**
    ```bash
    supabase start
    ```
    (This initializes the local Docker containers for Postgres, GoTrue, Storage, etc.)

2.  **Apply Database Migrations:** Ensure your local database schema matches the required structure.
    ```bash
    supabase db push
    ```
    (This applies SQL files found in `supabase/migrations/`.)

3.  **Deploy Edge Functions:** Deploy the necessary Supabase functions.
    ```bash
    supabase functions deploy askPolicyQa
    supabase functions deploy docx-extractor
    supabase functions deploy policy-embed
    supabase functions deploy policy-parser
    # Note: Ensure function-specific secrets (like OPENAI_API_KEY) are set in your Supabase project dashboard (Project Settings -> Functions -> Secrets) if deploying to the cloud.
    ```

4.  **Run the Next.js Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase Setup Details

- **Database Schema:** The required tables (`policy_documents`, `policy_chunks`, `profiles`, `audit_logs`) and functions (`match_policy_chunks`, `fts_policy_chunks`) are defined in SQL files within the `supabase/migrations/` directory. Use `supabase db push` to apply these migrations.
- **Row Level Security (RLS):** Appropriate RLS policies should be applied to tables, especially `policy_documents` and `policy_chunks`, to ensure data access control (Examples might be in `supabase/migrations/` or need manual setup).
- **Storage:** A bucket named `policy-documents` is required for storing uploaded files. Ensure appropriate storage policies are set for access control.
- **pgvector Extension:** The `vector` extension must be enabled in your Supabase database (Settings -> Database -> Extensions).
- **Indexes:** Ensure necessary indexes are created for performance: HNSW index on `policy_chunks(embedding)` and GIN index on `policy_chunks(fts)` (created by the migrations).
- **Function Secrets:** Set the `OPENAI_API_KEY` and other necessary secrets (like `PRIVATE_SUPABASE_SERVICE_KEY`, `SUPABASE_URL`) in your Supabase project dashboard (Project Settings -> Functions -> Secrets) for deployed functions.

## HIPAA Compliance Notes

## Key Technologies & Dependencies

- **Framework:** Next.js (App Router)
- **Backend/DB:** Supabase (Postgres, Auth, Storage, Edge Functions, Standard Functions)
- **AI:** OpenAI API (Embeddings: `text-embedding-3-small`, Q&A: `gpt-3.5-turbo`)
- **Database:** PostgreSQL with `pgvector` extension
- **UI:** React, Tailwind CSS, `@heroicons/react`
- **Key Libraries:**
  - `@supabase/ssr` (Server-side Supabase utilities for Next.js)
  - `@supabase/supabase-js` (Client-side Supabase library)
  - Deno (Runtime for Supabase Edge Functions)
  - `openai` (Deno/Node library for OpenAI API)
  - `mammoth` (Node library for DOCX parsing - used in standard function via esm.sh)
  - `unjs/unpdf` (Deno library for PDF parsing - used in edge function via esm.sh)
  - `react-hot-toast` (Notifications)

## Development Notes

## Scripting Recommendations

For consistency in executing arbitrary SQL from Node.js scripts within this project, consider the following:

### Refactor Scripts to Use `pg_query` RPC Function

Scripts such as `fix-cloud.js`, `apply-dev-setup.js`, and `simple-fix.js` currently use direct `fetch` calls to the `/rest/v1/sql` Supabase endpoint.

It is recommended to refactor these scripts to utilize the `public.pg_query` PostgreSQL function via the Supabase client's RPC method: `supabase.rpc('pg_query', { sql_query: yourSqlStatement })`.

This approach aligns with the method used in `direct-sql.js` and provides a single, robust, and debugged pathway for SQL execution from Node.js scripts.

**Prerequisites for this refactoring:**

1.  Ensure the `public.pg_query` function (as defined and corrected during recent debugging) is present in the target Supabase database.
2.  The Node.js script must initialize a Supabase client instance (typically using the service role key for admin-level tasks).

This will simplify maintenance and ensure a consistent interface for database script operations.

## ⚠️ Supabase Local Development Caveats

- The Supabase CLI/Docker local environment may not enforce all Postgres constraints as defined in migrations.
- Known issues:
  - `NOT NULL` constraints on `public.profiles` columns may not be enforced locally.
  - A rogue foreign key (`profiles_id_fkey` on `id`) may appear locally, causing insert errors, but does not exist in the cloud.
- **Workaround:** Always validate your migrations by pushing to a Supabase cloud project (`supabase db push`). The cloud environment will enforce constraints as expected.
- For production and staging, rely on the cloud project as the source of truth for schema and data integrity.

---

## Supabase Local Development: Troubleshooting & Best Practices

### Problem

When using Supabase locally (via CLI/Docker), you may encounter issues where:
- `NOT NULL` constraints and some foreign keys are not enforced as defined in your migrations.
- A foreign key constraint (`profiles_id_fkey` on `public.profiles.id`) is created locally, but not in the cloud, causing insert errors for rows not linked to `auth.users`.

### Symptoms
- Inserts into `public.profiles` fail locally with `violates foreign key constraint "profiles_id_fkey"`.
- `information_schema.columns` shows columns as nullable locally, even if defined as `NOT NULL` in migrations.
- The cloud project (Supabase Dashboard) shows the correct schema and constraints.

### Workaround
- **Always push and validate migrations in a Supabase cloud project:**
  - Link your local CLI to the cloud project: `supabase link --project-ref <project_id>`
  - Push migrations: `supabase db push`
  - Use the cloud dashboard's SQL editor to verify schema and constraints.
- Use the cloud project as the source of truth for schema and production-like testing.
- For local development, be aware that some constraints may not be enforced. Validate critical changes in the cloud.

### Reporting
- If you encounter these issues, consider reporting them to Supabase support or GitHub, referencing your experience and this documentation.

### Goal
- **Ultimate goal:** Achieve local development that mirrors the cloud. Track Supabase CLI updates and revisit local behavior as the tooling improves.