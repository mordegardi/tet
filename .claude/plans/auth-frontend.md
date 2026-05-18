# Frontend-авторизация: формы регистрации/входа, контекст и header

## Контекст

На backend уже реализованы `POST /auth/register` и `POST /auth/login` (см. [jwt-auth.md](./jwt-auth.md)) — оба возвращают `AuthResponse { accessToken, user: PublicUser }`. На frontend (`apps/frontend`) сейчас есть только `app/layout.tsx` и пустая `app/page.tsx` с заголовком — никакого UI, никакого состояния авторизации, не подключен shadcn.

Цель плана — собрать минимально-полный auth-flow на стороне Next.js:
1. **Регистрация** (`/register`) и **вход** (`/login`) с формами на shadcn-компонентах.
2. **Приветственная страница** (`/`) — для авторизованного пользователя показывает приветствие с именем, для неавторизованного — публичный лендинг с CTA-кнопками.
3. **Header** — общий для всех страниц: лого, состояние авторизации (имя/email пользователя + Logout *или* кнопки «Войти»/«Регистрация»).
4. **Хранение токена** и глобальный auth-state, доступ к нему в любом клиентском компоненте.

Backend остаётся неизменным — план целиком про `apps/frontend` и переиспользует существующие типы из `@expense-tracker/shared`.

## Технологический выбор

| Решение | Выбор | Причина |
|---|---|---|
| UI-кит | **shadcn/ui** | Запрошен пользователем; копируется в проект, не отдельная зависимость; нативно дружит с Tailwind v4 |
| Формы | **react-hook-form + zod** + `@hookform/resolvers` | Стандартный stack для shadcn `<Form>`; типобезопасные схемы, удобная валидация |
| Уведомления | **sonner** (shadcn-toast обёртка) | Лёгкие тосты «успех/ошибка» при логине/регистрации |
| Хранение токена | `localStorage` (ключ `accessToken`) | Просто и достаточно для MVP; backend ожидает `Authorization: Bearer` — это совместимо. Cookie-вариант (httpOnly) отложен, т.к. требует серверного обработчика и доработок на бэкенде |
| Глобальный state | React Context (`AuthProvider`) | Один источник правды о юзере; легковесно, без Redux/Zustand на текущем объёме |
| API-клиент | Тонкая обёртка `fetch` в `src/lib/api.ts` | Не тащим axios/react-query до появления реальной потребности |
| Защита роутов | **Клиентский guard** (`<RequireAuth />`) | Токен в `localStorage` недоступен на сервере — middleware/SSR-guard здесь бессмыслен. Защита остаётся в клиентском дереве через `useEffect` + `router.replace` |
| Иконки | **lucide-react** | Дефолт shadcn |

> **Важно про Tailwind v4.** Проект использует CSS-first конфиг (`globals.css` = `@import "tailwindcss";`, нет `tailwind.config.ts`). shadcn CLI с флагом нового движка генерирует переменные темы через `@theme` в CSS — никакой `tailwind.config.ts` создавать не нужно.

## Пакеты для установки

В `apps/frontend/package.json`:

```json
"dependencies": {
  "@hookform/resolvers": "^3.9.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.1",
  "lucide-react": "^0.460.0",
  "react-hook-form": "^7.53.0",
  "sonner": "^1.7.0",
  "tailwind-merge": "^2.5.0",
  "zod": "^3.23.8"
}
```

> `@radix-ui/*` примитивы (для `Button`, `Label`, `Dialog`, ...) добавятся автоматически тем же `shadcn add`.

### Инициализация shadcn

Из корня репозитория (фильтр выполняется внутри `apps/frontend`):

```bash
pnpm --filter @expense-tracker/frontend dlx shadcn@latest init
```

Параметры (отвечаем при инициализации):
- Style: **New York**
- Base color: **Slate** (под текущий `bg-gray-50` лендинга)
- CSS variables: **Yes**

Результат: появятся `apps/frontend/components.json`, `apps/frontend/src/lib/utils.ts` (с `cn()`), и `globals.css` будет переписан под shadcn-токены (`--background`, `--foreground`, ...).

Добавить компоненты:
```bash
pnpm --filter @expense-tracker/frontend dlx shadcn@latest add button input label card form sonner
```

> Если CLI промптит «Use --legacy?» — соглашаемся только при необходимости совместимости; по умолчанию Tailwind v4 поддерживается из коробки в новых версиях `shadcn`.

## Конфигурация окружения

`apps/frontend/.env.local.example` (и `.env.local`):

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Уже задокументировано в CLAUDE.md, но если файла нет — создать.

## Структура frontend (после изменений)

```
apps/frontend/
├── components.json                ← создаётся shadcn init
├── src/
│   ├── app/
│   │   ├── layout.tsx             ← обернуть в <AuthProvider>, добавить <Header>, <Toaster>
│   │   ├── page.tsx               ← приветственная страница (welcome / public landing)
│   │   ├── globals.css            ← перезаписан shadcn init
│   │   ├── login/
│   │   │   └── page.tsx           ← НОВОЕ
│   │   └── register/
│   │       └── page.tsx           ← НОВОЕ
│   ├── components/
│   │   ├── ui/                    ← генерится shadcn add (button, input, label, card, form, sonner)
│   │   ├── header.tsx             ← НОВОЕ: лого + auth-блок
│   │   ├── login-form.tsx         ← НОВОЕ
│   │   ├── register-form.tsx      ← НОВОЕ
│   │   └── require-auth.tsx       ← НОВОЕ: клиентский guard
│   ├── lib/
│   │   ├── utils.ts               ← создаётся shadcn init (`cn`)
│   │   ├── api.ts                 ← НОВОЕ: fetch-обёртка + auth-методы
│   │   └── auth-storage.ts        ← НОВОЕ: localStorage helpers
│   └── contexts/
│       └── auth-context.tsx       ← НОВОЕ: AuthProvider + useAuth
```

## API-клиент: `src/lib/api.ts`

Никаких сторонних библиотек, чистый `fetch`. Базовый url читается на клиенте из `process.env.NEXT_PUBLIC_API_URL` (Next.js встраивает `NEXT_PUBLIC_*` в бандл).

```typescript
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '@expense-tracker/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
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
    // Backend кидает { statusCode, message: string | string[], error }
    const body = (await res.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const msg = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message ?? `Request failed: ${res.status}`;
    throw new ApiError(res.status, msg);
  }

  return res.json() as Promise<T>;
}

export const authApi = {
  register: (dto: RegisterRequest) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  login: (dto: LoginRequest) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
};
```

> Заголовок `Authorization: Bearer` здесь пока не нужен (оба эндпоинта публичные). Когда появится `categories`/`expenses` — расширим `request()` опцией `auth: true` и будем подтягивать токен из `auth-storage`.

## localStorage helpers: `src/lib/auth-storage.ts`

```typescript
import type { PublicUser } from '@expense-tracker/shared';

const TOKEN_KEY = 'accessToken';
const USER_KEY = 'authUser';

export const authStorage = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  getUser(): PublicUser | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PublicUser;
    } catch {
      return null;
    }
  },
  save(token: string, user: PublicUser): void {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear(): void {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};
```

> Все геттеры безопасны для SSR — на сервере возвращают `null`. Это критично для Next.js App Router: компоненты рендерятся и на сервере, и на клиенте, прямой доступ к `window` на сервере крашит билд.

## AuthContext: `src/contexts/auth-context.tsx`

Клиентский провайдер: загружает токен/юзера из `localStorage` на маунте, отдаёт state и actions.

```typescript
'use client';

import type { AuthResponse, PublicUser } from '@expense-tracker/shared';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authStorage } from '@/lib/auth-storage';

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;           // true до первой гидрации из localStorage
  setSession: (res: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(authStorage.getUser());
    setIsLoading(false);
  }, []);

  const setSession = useCallback((res: AuthResponse) => {
    authStorage.save(res.accessToken, res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
```

> **Про гидрацию.** `user` всегда стартует как `null` (одинаково на сервере и на клиенте — нет mismatch'а). Реальное значение поднимается в `useEffect`. `isLoading=true` нужен, чтобы header не «мигал» кнопками «Войти/Регистрация» у уже залогиненного юзера в первый кадр.

## Header: `src/components/header.tsx`

Клиентский компонент: показывает разное содержимое в зависимости от `useAuth()`.

```typescript
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';

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
            <div className="h-9 w-32" /> /* плейсхолдер от мигания */
          ) : user ? (
            <>
              <span className="text-sm text-gray-700">{user.name}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Войти</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Регистрация</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
```

## Формы

Обе формы используют shadcn-паттерн с `useForm` + `zodResolver` и shadcn-компонентами `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>`.

### `src/components/register-form.tsx`

Zod-схема согласована с backend-валидацией из `RegisterDto`:

```typescript
const schema = z.object({
  email: z.string().email('Некорректный email'),
  name: z.string().min(2, 'Минимум 2 символа').max(64),
  password: z.string().min(8, 'Минимум 8 символов').max(128),
});
type FormValues = z.infer<typeof schema>;
```

Скелет компонента:

```typescript
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { ApiError, authApi } from '@/lib/api';

export function RegisterForm() {
  const { setSession } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const res = await authApi.register(values);
      setSession(res);
      toast.success('Регистрация успешна');
      router.replace('/');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // <Form>...<FormField name="email" />...<FormField name="name" />...<FormField name="password" type="password" />
  // <Button type="submit" disabled={isSubmitting}>Зарегистрироваться</Button>
}
```

### `src/components/login-form.tsx`

Аналогично, но схема проще (email + password ≥ 1 символ — backend сам отдаст 401, если пароль не совпал). После успеха — `router.replace('/')`.

### Страницы `/login` и `/register`

`src/app/login/page.tsx`:

```typescript
import { LoginForm } from '@/components/login-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Вход</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
```

`/register` — зеркально. Обе страницы серверные по умолчанию, форма внутри — клиентская.

> **Редирект уже авторизованного пользователя**. Опционально: добавить на обеих страницах маленький клиентский компонент `<RedirectIfAuth />`, который в `useEffect` смотрит `useAuth().user` и делает `router.replace('/')`. Не обязательно для MVP, но улучшает UX.

## Защита маршрутов: `src/components/require-auth.tsx`

Понадобится в будущем (для `categories`/`expenses`), но удобнее заложить сразу:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/auth-context';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;   // или скелетон
  return <>{children}</>;
}
```

На приветственной странице (`/`) НЕ оборачиваем — пусть отдаёт разный контент в зависимости от `user`. Guard пригодится позже на защищённых страницах.

## Приветственная страница: `src/app/page.tsx`

Заменяем существующую заглушку. Клиентская страница (нужен `useAuth`):

```typescript
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';

export default function HomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-8">
      <div className="text-center">
        {user ? (
          <>
            <h1 className="text-4xl font-bold tracking-tight">
              Добро пожаловать, {user.name}!
            </h1>
            <p className="mt-4 text-gray-600">
              Здесь будет ваш дашборд расходов.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold tracking-tight">Expense Tracker</h1>
            <p className="mt-4 text-gray-600">
              Отслеживайте свои расходы. Зарегистрируйтесь, чтобы начать.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild>
                <Link href="/register">Регистрация</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login">Войти</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
```

## Обновление `src/app/layout.tsx`

Оборачиваем приложение в `AuthProvider`, добавляем `Header` и `Toaster` от sonner:

```typescript
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/header';
import { AuthProvider } from '@/contexts/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Track your expenses with ease',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
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
```

> Цвета меняются с `bg-gray-50 text-gray-900` на shadcn-токены `bg-background text-foreground` — после `shadcn init` эти переменные определены в `globals.css`.

## Файлы для модификации/создания

**Изменить:**
- `apps/frontend/package.json` — новые зависимости (см. выше)
- `apps/frontend/src/app/layout.tsx` — `AuthProvider`, `Header`, `Toaster`
- `apps/frontend/src/app/page.tsx` — welcome / public landing
- `apps/frontend/src/app/globals.css` — перепишется `shadcn init` (shadcn-токены поверх `@import "tailwindcss";`)
- `apps/frontend/.env.local.example` (и локальный `.env.local`) — добавить `NEXT_PUBLIC_API_URL`, если ещё нет

**Создать (наше):**
- `apps/frontend/src/lib/api.ts`
- `apps/frontend/src/lib/auth-storage.ts`
- `apps/frontend/src/contexts/auth-context.tsx`
- `apps/frontend/src/components/header.tsx`
- `apps/frontend/src/components/login-form.tsx`
- `apps/frontend/src/components/register-form.tsx`
- `apps/frontend/src/components/require-auth.tsx`
- `apps/frontend/src/app/login/page.tsx`
- `apps/frontend/src/app/register/page.tsx`

**Создаётся shadcn CLI (не редактировать руками после генерации, кроме как для патчей):**
- `apps/frontend/components.json`
- `apps/frontend/src/lib/utils.ts`
- `apps/frontend/src/components/ui/button.tsx`
- `apps/frontend/src/components/ui/input.tsx`
- `apps/frontend/src/components/ui/label.tsx`
- `apps/frontend/src/components/ui/card.tsx`
- `apps/frontend/src/components/ui/form.tsx`
- `apps/frontend/src/components/ui/sonner.tsx`

## Верификация

### 1. Сборка и типы

```bash
pnpm install
pnpm --filter @expense-tracker/frontend typecheck
pnpm --filter @expense-tracker/frontend lint
```

Обе команды должны проходить без ошибок. Biome может попросить отформатировать сгенерированные shadcn-файлы — выполнить `pnpm format`.

### 2. Запуск

```bash
pnpm db:up
pnpm dev
```

Открыть `http://localhost:3000`.

### 3. Ручные сценарии

**Шапка (неавторизованный):**
- На `/` в header видны кнопки «Войти» и «Регистрация». Имени юзера и Logout нет.

**Регистрация:**
- Перейти на `/register`, заполнить корректные значения → 201 от backend, тост «Регистрация успешна», редирект на `/`, в header — имя юзера и Logout, на странице — «Добро пожаловать, {name}!».
- Проверить валидацию на стороне клиента: email без `@`, пароль 5 символов, имя пустое — кнопка остаётся доступной, но сабмит блокируется сообщениями под полями.
- Дубль (тот же email повторно): backend вернёт 409 → тост «Email already registered».

**Логин:**
- Logout (кнопка в header) → state очищен, токен удалён из `localStorage`, редирект на `/`.
- На `/login` ввести правильные креды → редирект на `/`, имя в header.
- Неверный пароль → backend 401 → тост «Invalid credentials», полей формы не очищаем.

**Перезагрузка страницы:**
- После логина F5 → header сразу (после первой клиентской гидрации) показывает имя; на `/` — приветствие. Это подтверждает, что чтение `localStorage` в `AuthProvider.useEffect` работает.

**Кросс-таб (опционально):**
- Logout в одной вкладке не разлогинит другую без слушателя `storage`-event. На MVP — допустимо; пометить как backlog.

### 4. DevTools

- В Application → Local Storage → `http://localhost:3000`: после логина видны ключи `accessToken` (JWT) и `authUser` (JSON с `id`, `email`, `name`).
- В Network → запрос `POST /auth/register` или `/auth/login` — тело `application/json` с ровно теми полями, что в `RegisterRequest`/`LoginRequest`, ответ `{ accessToken, user }`.

### 5. Отсутствие SSR-mismatch

- В консоли браузера на любой странице не должно быть warning'ов вида `Hydration failed` / `Text content does not match`. Это проверка, что `AuthProvider` стартует с `user=null` и обновляется только в `useEffect`.

## Что осталось за рамками этого плана

- **httpOnly cookie для токена** и SSR-аутентификация (`middleware.ts`) — отложено; потребует серверного хендлера set-cookie на backend.
- **Refresh-токены и автологаут по истечении** — отложено вместе с refresh-логикой на backend.
- **Подтверждение email, сброс пароля, OAuth** — отложено.
- **Cross-tab синхронизация** через `window.addEventListener('storage', ...)` — попадёт в backlog UX-улучшений.
- **Глобальный обработчик 401** (автоматический logout при истечении токена на любой защищённой ручке) — добавить вместе с первой защищённой страницей (`/categories`).
- **Защищённые маршруты с `<RequireAuth>`** — компонент создаётся, но не применяется (приветственная страница умышленно публичная и показывает разное содержимое сама).
- **Тесты** (Playwright/RTL) — отдельный план, по аналогии с решением для `jwt-auth`/`categories`.
