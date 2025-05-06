import { redirect } from 'next/navigation';

// Redirect from the old reset-password page to the new auth/reset-password page
export default function ResetPasswordRedirect() {
  redirect('/auth/reset-password');
}

// This file is kept to maintain backward compatibility
// It redirects users from the old path to the new organized path
