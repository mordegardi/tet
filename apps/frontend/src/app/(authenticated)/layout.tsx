import { RequireAuth } from '@/components/require-auth';
import { Sidebar } from '@/components/sidebar';
import type { ReactNode } from 'react';

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </RequireAuth>
  );
}
