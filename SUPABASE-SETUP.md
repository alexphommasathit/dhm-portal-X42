# Supabase Connection Setup

This guide helps you set up the proper environment variables for connecting your Next.js application to Supabase.

## Setting up your .env.local file

Create or edit your `.env.local` file in the project root and add the following variables:

```
# Supabase Connection URLs
# Get these from the Supabase dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-dashboard

# Database Connection (Optional - only needed for direct database access)
# Use the Connection Pooler (Transaction pooler) string from the screenshot you shared
# Format: postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:6543/postgres
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:6543/postgres

# Next.js Site URL - used for auth callbacks
# For local development:
NEXT_PUBLIC_URL=http://localhost:3000
# For production:
# NEXT_PUBLIC_URL=https://your-production-domain.com
```

## Where to find these values

1. **Supabase URL and Anon Key**
   - Go to Supabase Dashboard > Project Settings > API
   - Copy the URL and anon/public key

2. **Database Connection String (Transaction Pooler)**
   - Go to Supabase Dashboard > Project Settings > Database
   - Under "Connection Pooling", find the "Transaction pooler" section
   - Copy the connection string and replace `[YOUR-PASSWORD]` with your database password

3. **Next Public URL**
   - For local development, use `http://localhost:3000`
   - For production, use your actual domain

## Important Notes

- The `@supabase/auth-helpers-nextjs` client will automatically use the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables.
- The Transaction Pooler connection is recommended for web applications as it's:
  - Designed for stateless applications and serverless functions
  - Maintains a pre-warmed connection pool
  - IPv4 compatible
  - Efficient for handling multiple concurrent users
- Never commit your `.env.local` file to Git; it should be included in your `.gitignore`. 