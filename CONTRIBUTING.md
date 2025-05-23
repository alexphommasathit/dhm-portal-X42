# Contribution Guidelines

## 1. Code Style & Formatting

- **Prettier**: Add an explicit .prettierrc file with your team's preferred settings (semicolons, quote style, trailing commas, etc.). Enforce formatOnSave.
- **ESLint**: Continue enforcing ESLint rules strictly.
- **Naming Conventions**: Define clear conventions for variables, functions, components, files (e.g., camelCase for variables/functions, PascalCase for components).

## 2. TypeScript Usage

- **Strict Types**: Leverage TypeScript's strengths. Avoid `any` wherever possible. Define clear interfaces and types.
- **Type Safety**: Utilize Supabase's type generation for database interactions.

## 3. Security Practices (Reinforce & Expand)

- **RBAC Everywhere**: Explicitly check roles/permissions in API routes/Edge Functions and conditionally render UI components using the established RBAC context/HOC. Never trust client-side checks alone.
- **Input Validation**: Validate all inputs received from the client (API route bodies, function arguments) using libraries like Zod.
- **Supabase RLS**: Rely on Row Level Security as the ultimate gatekeeper. Ensure policies are comprehensive and tested. Code should assume RLS is active.
- **Audit Logging**: Log all significant actions involving PHI or critical system changes, following the established system. Be mindful not to log excessively sensitive data (like full PHI details) in the logs themselves if avoidable.
- **Error Handling**: Implement robust error handling; don't expose sensitive system details in error messages sent to the client.
- **Secrets Management**: Use environment variables (.env.local, Vercel env vars) for API keys, Supabase keys, etc. Never hardcode secrets.

## 4. Component & Architecture

- **Adhere to Structure**: Follow the established project structure (App Router conventions, components, context, lib).
- **Reusability**: Build reusable components (especially UI elements using ShadCN UI) where appropriate.
- **State Management**: Use Context API for global state (like RBAC) and useState/useReducer for local component state unless more complex needs arise.

## 5. API Usage (Supabase & AI)

- **Supabase Client**: Use the shared Supabase client instances.
- **Data Fetching**: Select only the data needed (select('column1, column2')) to minimize data transfer.
- **AI APIs**: Ensure all interactions with AI APIs (Embeddings, Chat) happen server-side (Edge Functions/API routes). Adhere strictly to BAA terms. Handle potential API errors gracefully.

## 6. AI Tool Usage (Cursor Rules)

- **Review Mandate**: All AI-generated code must be reviewed and understood before committing.
- **No Sensitive Data in Prompts**: Use placeholders or abstract descriptions, never real PHI.
- **Context is Key**: Provide clear context for better suggestions.
- **Security Focus**: Explicitly ask for secure coding patterns when relevant. Verify AI suggestions meet security requirements (RBAC, validation, RLS awareness).
- **Test AI Output**: Write tests for logic generated by AI.
- **Leverage Strengths**: Use for boilerplate, refactoring, docs, tests, but be critical of complex logic.

## 7. Testing

- **Strategy**: Define a basic testing strategy (e.g., Vitest/Jest + React Testing Library).
- **Priorities**: Prioritize testing critical functions: Auth logic, RBAC checks, API endpoints, security-sensitive utility functions, core business logic (like P&P interactions later).

## 8. Documentation

- **Code Comments**: Use JSDoc/TSDoc for functions, complex logic, and component props.
- **README**: Keep the README updated with setup instructions, core features, and links to further documentation (like the Development Guidelines).

## 9. Git Workflow

- **Branching**: Use a consistent branching strategy (e.g., Gitflow - main, develop, feature/xxx).
- **Commits**: Write clear, descriptive commit messages.

## Code Organization

We follow a function/module-based organization pattern for our codebase to maintain clarity and scalability.

### File and Folder Structure Rules

1. **Module-based organization**: Group related files by their functional domain rather than by file type.

   - ✅ Good: `/auth/login`, `/auth/reset-password`, `/auth/error`
   - ❌ Avoid: `/pages/auth-login`, `/pages/auth-reset`, `/components/auth-form`

2. **Consistent naming**: Use clear, consistent naming patterns that indicate the purpose.

   - Component files should match their exported component name
   - Page files should describe their route/functionality

3. **Clean API structure**: API endpoints should mirror the frontend structure where applicable.

   - Example: `/api/auth/callback` for authentication callback endpoint

4. **Shared code**: Place shared utilities, types, and components in dedicated folders:
   - `/lib` - General utilities and helper functions
   - `/components` - Reusable UI components
   - `/types` - TypeScript type definitions
   - `/hooks` - Custom React hooks

### Component Organization

Components should be organized as follows:

```
src/components/
  ├── auth/               # Auth-related components
  │   ├── LoginForm.tsx
  │   └── ResetPasswordForm.tsx
  ├── layout/             # Layout components
  │   ├── Header.tsx
  │   └── Footer.tsx
  └── common/             # Common UI components
      ├── Button.tsx
      └── Input.tsx
```

### Page Organization

Pages should follow Next.js app router conventions and be organized by domain:

```
src/app/
  ├── auth/               # Authentication-related pages
  │   ├── login/
  │   │   └── page.tsx    # /auth/login route
  │   └── reset-password/
  │       └── page.tsx    # /auth/reset-password route
  └── (dashboard)/        # Dashboard routes (grouped)
      ├── layout.tsx      # Shared dashboard layout
      └── page.tsx        # Main dashboard page
```

### API Routes Organization

API endpoints should mirror the frontend organization:

```
src/app/api/
  ├── auth/               # Auth-related endpoints
  │   ├── callback/
  │   │   └── route.ts    # /api/auth/callback endpoint
  │   └── reset-password/
  │       └── route.ts    # /api/auth/reset-password endpoint
  └── users/              # User-related endpoints
      └── route.ts        # /api/users endpoint
```

## Pull Request Process

1. Create a feature branch from `main` with a descriptive name
2. Follow the code organization rules above
3. Update documentation as needed
4. Submit a PR with a clear description of changes
