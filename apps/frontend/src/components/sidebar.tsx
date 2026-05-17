'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Главная', href: '/' },
  { label: 'Категории', href: '/categories', disabled: true },
  { label: 'Транзакции', href: '/transactions', disabled: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-white px-3 py-4">
      <nav className="flex flex-col gap-1">
        {navItems.map(({ label, href, disabled }) =>
          disabled ? (
            <span
              key={href}
              className="cursor-not-allowed rounded-md px-3 py-2 text-sm text-gray-400"
            >
              {label}
            </span>
          ) : (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100',
                pathname === href && 'bg-gray-100 text-gray-900',
              )}
            >
              {label}
            </Link>
          ),
        )}
      </nav>
    </aside>
  );
}
