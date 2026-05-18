import { Header } from '@/components/header';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Track your expenses with ease',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={cn('font-sans', geist.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthProvider>
          <Header />
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
