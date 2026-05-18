# Dashboard (Main Page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the authenticated main page (dashboard) showing the last 10 transactions, with a persistent left sidebar navigation on all authenticated pages.

**Architecture:** Use a Next.js route group `(authenticated)` with its own layout that enforces auth and renders the sidebar. The global root layout (Header + Toaster) stays untouched. A new `authenticatedRequest` helper in `lib/api.ts` reads the JWT from `authStorage` and attaches it to requests. The dashboard page is a server component; data fetching lives in a dedicated `TransactionList` client component.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS v4, shared types from `@expense-tracker/shared`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/frontend/src/lib/api.ts` | Add `authenticatedRequest` helper + `transactionsApi.getAll()` |
| Create | `apps/frontend/src/components/sidebar.tsx` | Left navigation sidebar |
| Create | `apps/frontend/src/app/(authenticated)/layout.tsx` | Auth-group layout (RequireAuth + Sidebar) |
| Create | `apps/frontend/src/components/transaction-list.tsx` | Fetches & renders last 10 transactions |
| Create | `apps/frontend/src/app/(authenticated)/page.tsx` | Dashboard page (replaces current home page) |
| Delete | `apps/frontend/src/app/page.tsx` | Replaced by `(authenticated)/page.tsx` |

---

### Task 1: Create feature branch

**Files:** none

- [ ] **Step 1: Create branch from main**

  ```bash
  git checkout main && git pull && git checkout -b feat/dashboard
  ```

---

### Task 2: Add `authenticatedRequest` and `transactionsApi` to `api.ts`

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Step 1: Replace the file with the new content**

  `apps/frontend/src/lib/api.ts`:
  ```typescript
  import { authStorage } from '@/lib/auth-storage';
  import type { AuthResponse, LoginRequest, RegisterRequest, Transaction } from '@expense-tracker/shared';

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  export class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
      const msg = Array.isArray(body?.message)
        ? body.message.join(', ')
        : (body?.message ?? `Request failed: ${res.status}`);
      throw new ApiError(res.status, msg);
    }

    return res.json() as Promise<T>;
  }

  function authenticatedRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const token = authStorage.getToken();
    if (!token) return Promise.reject(new ApiError(401, 'Not authenticated'));
    return request<T>(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  export const authApi = {
    register: (dto: RegisterRequest) =>
      request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(dto) }),
    login: (dto: LoginRequest) =>
      request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(dto) }),
  };

  export const transactionsApi = {
    getAll: () => authenticatedRequest<Transaction[]>('/transactions'),
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/frontend/src/lib/api.ts
  git commit -m "feat: add authenticatedRequest helper and transactionsApi"
  ```

---

### Task 3: Create `Sidebar` component

**Files:**
- Create: `apps/frontend/src/components/sidebar.tsx`

- [ ] **Step 1: Create the file**

  `apps/frontend/src/components/sidebar.tsx`:
  ```tsx
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
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/frontend/src/components/sidebar.tsx
  git commit -m "feat: add Sidebar navigation component"
  ```

---

### Task 4: Create authenticated route-group layout

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/layout.tsx`

The `(authenticated)` route group is invisible to the URL — files inside still map to their normal paths (e.g. `(authenticated)/page.tsx` → `/`). Its layout enforces auth and renders the sidebar below the global Header.

- [ ] **Step 1: Create the directory and file**

  `apps/frontend/src/app/(authenticated)/layout.tsx`:
  ```tsx
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
  ```

  > `min-h-[calc(100vh-3.5rem)]`: subtracts the global Header height (h-14 = 3.5rem) so the layout fills the remaining viewport.

- [ ] **Step 2: Commit**

  ```bash
  git add apps/frontend/src/app/(authenticated)/layout.tsx
  git commit -m "feat: add authenticated route-group layout with sidebar"
  ```

---

### Task 5: Create `TransactionList` component

**Files:**
- Create: `apps/frontend/src/components/transaction-list.tsx`

This is a client component — it reads the JWT via `authStorage` (through `transactionsApi`) so it cannot be a server component.

- [ ] **Step 1: Create the file**

  `apps/frontend/src/components/transaction-list.tsx`:
  ```tsx
  'use client';

  import { ApiError, transactionsApi } from '@/lib/api';
  import type { Transaction } from '@expense-tracker/shared';
  import { useEffect, useState } from 'react';

  function formatAmount(amount: string, type: string): string {
    const num = parseFloat(amount);
    const sign = type === 'INCOME' ? '+' : '-';
    return `${sign}${Math.abs(num).toFixed(2)}`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  export function TransactionList() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      transactionsApi
        .getAll()
        .then((data) => setTransactions(data.slice(0, 10)))
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : 'Ошибка загрузки транзакций');
        })
        .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) return <p className="text-sm text-gray-500">Загрузка...</p>;
    if (error) return <p className="text-sm text-red-500">{error}</p>;
    if (transactions.length === 0)
      return <p className="text-sm text-gray-500">Транзакций пока нет.</p>;

    return (
      <ul className="divide-y rounded-lg border bg-white">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{t.category.icon}</span>
              <div>
                <p className="text-sm font-medium">{t.category.name}</p>
                {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
              </div>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-semibold ${
                  t.category.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatAmount(t.amount, t.category.type)}
              </p>
              <p className="text-xs text-gray-400">{formatDate(t.date)}</p>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/frontend/src/components/transaction-list.tsx
  git commit -m "feat: add TransactionList component"
  ```

---

### Task 6: Create dashboard page and remove old home page

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/page.tsx`
- Delete: `apps/frontend/src/app/page.tsx`

> **Why delete `app/page.tsx`?** Route groups don't change URL paths — `(authenticated)/page.tsx` maps to `/`, same as `app/page.tsx`. Next.js will throw a build error if both exist. The new dashboard page replaces the old one.

- [ ] **Step 1: Create the dashboard page**

  `apps/frontend/src/app/(authenticated)/page.tsx`:
  ```tsx
  import { TransactionList } from '@/components/transaction-list';

  export default function DashboardPage() {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold">Последние транзакции</h1>
        <TransactionList />
      </div>
    );
  }
  ```

- [ ] **Step 2: Delete the old home page**

  ```bash
  git rm apps/frontend/src/app/page.tsx
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/frontend/src/app/(authenticated)/page.tsx
  git commit -m "feat: add dashboard page with last 10 transactions, remove old home page"
  ```

---

### Task 7: Manual QA

- [ ] **Step 1: Start the dev stack**

  ```bash
  pnpm db:up
  pnpm dev
  ```

- [ ] **Step 2: Unauthenticated visit**

  Open `http://localhost:3000` in the browser without being logged in.
  Expected: redirect to `/login`.

- [ ] **Step 3: Log in**

  Log in via `http://localhost:3000/login`.
  Expected: redirect to `/` → dashboard with sidebar visible on the left.

- [ ] **Step 4: Sidebar**

  Verify sidebar shows:
  - "Главная" — highlighted/active (clickable, links to `/`)
  - "Категории" — greyed out, not clickable
  - "Транзакции" — greyed out, not clickable

- [ ] **Step 5: Header**

  Verify global Header still shows user name (top right) and Logout button.

- [ ] **Step 6: Transactions list**

  - If the user has transactions: list shows up to 10 items with category icon, name, amount (green for income, red for expense), and date.
  - If no transactions: "Транзакций пока нет." message.

- [ ] **Step 7: Logout**

  Click Logout → redirected to `/` → which redirects to `/login`.

