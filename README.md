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

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin protected routes
│   ├── api/                # API routes
│   │   └── auth/           # Authentication API endpoints
│   ├── auth/               # Auth callback route
│   ├── login/              # Login page
│   ├── patients/           # Patient protected routes
│   ├── profile/            # User profile management
│   └── reset-password/     # Password reset flow
├── components/             # Reusable components
│   ├── Protected.tsx       # RBAC protection component
│   └── withRoleCheck.tsx   # HOC for role-based access
├── context/                # React context providers
│   ├── AuthContext.tsx     # Authentication state management
│   └── RBACContext.tsx     # Role-based permissions
├── lib/                    # Utility functions
│   ├── audit-logger.ts     # HIPAA-compliant audit logging
│   ├── session-timeout.ts  # Automatic session timeout
│   └── supabaseClient.js   # Supabase client initialization
├── sql/                    # Database definitions
│   └── schema/             # SQL schema files
└── types/                  # TypeScript type definitions
    └── supabase.ts         # Supabase type definitions
```

## Getting Started

First, set up the environment variables:

1. Create a `.env.local` file with Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

2. Run the development server:

```bash
npm run dev
# or
yarn dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase Setup

See `SUPABASE-SETUP.md` for instructions on setting up the Supabase project with the required tables, functions, and policies.

## HIPAA Compliance Notes

This application implements several HIPAA compliance features:

1. **Audit Logging**: All PHI access is logged with user, timestamp, IP address, and action details
2. **Session Timeout**: Automatic logout after 20 minutes of inactivity
3. **Role-Based Access**: Strict permission controls based on healthcare roles
4. **Secure Authentication**: Password policies and secure reset flows
5. **Immutable Logs**: Audit records cannot be modified or deleted

## Development Notes

- Use the withRoleCheck HOC for role-protected components
- Always use the audit logger when accessing PHI
- Test with different user roles to ensure proper access control

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
