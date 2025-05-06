// app/login/page.tsx
'use client'; // This page needs client-side interactivity

import { redirect } from 'next/navigation';

// Redirect from the old login page to the new auth/login page
export default function LoginRedirect() {
  redirect('/auth/login');
}
