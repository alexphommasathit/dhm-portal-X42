'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  const navItems = [
    { name: 'Workflows', href: '/workflows' },
    { name: 'Upload Policy', href: '/workflows/upload-policy' }
  ];
  
  return (
    <div className="space-y-6">
      <div className="border-b">
        <div className="container flex h-14 items-center">
          <nav className="flex items-center space-x-4 lg:space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  pathname === item.href
                    ? "text-foreground border-b-2 border-primary pb-3"
                    : "text-muted-foreground"
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
} 