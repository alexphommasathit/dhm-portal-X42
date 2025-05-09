# Calendar Integration Dependencies

The calendar integration feature requires additional NPM packages. Install them with:

```bash
npm install jsonwebtoken xmldom
npm install --save-dev @types/jsonwebtoken @types/xmldom
```

## Required Packages

### Backend/API Dependencies

- **jsonwebtoken**: For Apple JWT token generation
- **xmldom**: For parsing CalDAV responses from Apple servers

### Types (Dev Dependencies)

- **@types/jsonwebtoken**: TypeScript types for jsonwebtoken
- **@types/xmldom**: TypeScript types for xmldom

## UI Components

For the UI, make sure you have Shadcn UI components installed:

```bash
npx shadcn-ui@latest add button card dialog input label tabs textarea toast
```

## Custom Icons

The UI uses custom icons for Apple and Google. Create these components:

```bash
mkdir -p src/components/icons
```

### src/components/icons/google-logo.tsx

```tsx
import { SVGProps } from 'react';

export function GoogleLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
```

### src/components/icons/apple-logo.tsx

```tsx
import { SVGProps } from 'react';

export function AppleLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M14.94,5.19A4.38,4.38,0,0,0,16,2,4.44,4.44,0,0,0,13,3.52,4.17,4.17,0,0,0,12,6.61,3.69,3.69,0,0,0,14.94,5.19Z"
        fill="currentColor"
      />
      <path
        d="M17.46,12.29c0-2.35,1.92-3.47,2-3.53A4.34,4.34,0,0,0,16.77,6a3.57,3.57,0,0,0-3,1.64,1.64,1.64,0,0,1-1.23.64,1.78,1.78,0,0,1-1.24-.64A3.48,3.48,0,0,0,8.34,6,4.49,4.49,0,0,0,5,8.77a8.62,8.62,0,0,0-2,5.71,14.76,14.76,0,0,0,2.72,7A3.14,3.14,0,0,0,8.12,23a2.87,2.87,0,0,0,1.48-.8A1.12,1.12,0,0,1,10.75,22a1.39,1.39,0,0,1,1.14.8,3.06,3.06,0,0,0,1.47.8,3.06,3.06,0,0,0,2.45-1.5,14.28,14.28,0,0,0,1.65-3.2A4,4,0,0,1,17.46,12.29Z"
        fill="currentColor"
      />
    </svg>
  );
}
```

Then update your imports in calendar page:

```tsx
import { GoogleLogo } from '@/components/icons/google-logo';
import { AppleLogo } from '@/components/icons/apple-logo';
import { Calendar, Plus, Trash2, RefreshCw, LogOut } from 'lucide-react';
``` 