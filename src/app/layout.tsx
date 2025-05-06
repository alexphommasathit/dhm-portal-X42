import type { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import { RBACProvider } from '@/context/RBACContext';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'DHM Agency Web App',
  description: 'Secure, scalable, and AI-powered web platform for healthcare management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <RBACProvider>
            {children}
            <Toaster />
          </RBACProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
