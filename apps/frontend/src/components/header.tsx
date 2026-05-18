'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          Expense Tracker
        </Link>
        <nav className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-9 w-32" />
          ) : user ? (
            <>
              <span className="text-sm text-gray-700">{user.name}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Войти
              </Link>
              <Link href="/register" className={buttonVariants({ size: 'sm' })}>
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
