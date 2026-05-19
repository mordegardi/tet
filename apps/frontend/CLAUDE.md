# Frontend (Next.js 16, App Router)

## Routing

- Все маршруты под `apps/frontend/src/app/`. `app/layout.tsx` — корневой layout: подключает `globals.css`, шрифт **Geist** (через `next/font/google` как CSS-переменная `--font-sans`), `<AuthProvider>` оборачивает приложение, `<Toaster richColors position="top-right" />` из `sonner` смонтирован глобально.
- Защищённые страницы лежат в route-группе `app/(authenticated)/`. Её `layout.tsx` оборачивает контент в `<RequireAuth>` + `<Sidebar>`. Скобки в имени группы означают, что сегмент не появляется в URL — `app/(authenticated)/page.tsx` это `/`.
- Публичные страницы (`/login`, `/register`) живут вне группы — без guard'а.

## Tailwind CSS v4 + shadcn/ui

- **Tailwind v4 с CSS-first конфигом**: нет `tailwind.config.ts`. Дизайн-система настраивается в `globals.css` через `@theme { ... }` (и `@theme inline { ... }` для маппинга на CSS-переменные shadcn). PostCSS использует `@tailwindcss/postcss` (НЕ `tailwindcss` + `autoprefixer` как в v3). Контент детектится автоматически — `content:` глоб не нужен.
- **shadcn/ui v4** настроен через `components.json` (`style: base-nova`, `baseColor: neutral`, `iconLibrary: lucide`, `rsc: true`). CSS-переменные включены — все цвета (`--background`, `--primary`, `--card` и т.п.) определены в `:root` и `.dark` в `globals.css` в формате `oklch(...)`.
- Тёмная тема настроена через `@custom-variant dark (&:is(.dark *))` в `globals.css`. Установлен `next-themes` — переключатель ещё не подключён, но классовая стратегия (`.dark`) готова.
- Анимации — `tw-animate-css` (импортится в `globals.css`).
- Алиасы (из `components.json`): `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils` (там `cn` на базе `clsx` + `tailwind-merge`), `@/hooks`.
- Добавлять компоненты через `pnpm dlx shadcn@latest add <name>` из `apps/frontend/`. Не править `src/components/ui/*` вручную больше, чем нужно для интеграции — апдейты shadcn перетрут изменения.

## Формы (React Hook Form + Zod + shadcn Form)

Стандартный паттерн (см. `src/components/login-form.tsx`, `register-form.tsx`):

1. Описать схему через `zod`, тип значений — `z.infer<typeof schema>`.
2. `useForm({ resolver: zodResolver(schema), defaultValues })`.
3. Рендерить через `<Form {...form}>` + `<FormField>` со слотами `FormLabel/FormControl/FormMessage`. Не использовать «голый» `<Input>` без `FormField` — пропадут aria-атрибуты и сообщения об ошибках.
4. Состояние сабмита держать в локальном `useState` (`isSubmitting`), а не доставать `formState.isSubmitting`, если нужно блокировать UI на время API-вызова.

## API клиент

- `src/lib/api.ts` — единственная точка похода в backend. `API_URL` берётся из `NEXT_PUBLIC_API_URL` (`.env.local`), default `http://localhost:3001`.
- Все типы запросов/ответов импортятся из `@expense-tracker/shared` (`AuthResponse`, `LoginRequest`, `Transaction` и т.п.) — backend гарантирует те же типы через `implements`.
- `request()` бросает `ApiError(status, message)` с распарсенным `body.message` (string или string[]) при `!res.ok`. Ловить `instanceof ApiError` в UI и показывать `err.message` через `toast.error(...)`.
- `authenticatedRequest()` достаёт токен из `authStorage`, кидает 401 если его нет, и добавляет `Authorization: Bearer <token>`. Использовать для всех приватных эндпоинтов.

## Auth flow

- `src/lib/auth-storage.ts` — обёртка над `localStorage` (`accessToken`, `authUser`). SSR-safe: возвращает `null` если `typeof window === 'undefined'`. **Не читать localStorage напрямую** — все доступы только через `authStorage`.
- `src/contexts/auth-context.tsx` — `AuthProvider` гидратирует пользователя из storage в `useEffect` (поэтому `isLoading` стартует как `true`). Хук `useAuth()` бросает, если вызван вне провайдера.
- `src/components/require-auth.tsx` — клиентский guard: пока `isLoading` рендерит `null`, при отсутствии юзера делает `router.replace('/login')`. Подключается через `app/(authenticated)/layout.tsx` — отдельным страницам guard добавлять не нужно.
- Логин/регистрация: вызвать `authApi.*`, передать `AuthResponse` в `setSession(res)` (сохранит токен + юзера, обновит контекст), затем `router.replace('/')`. Тосты через `sonner` (`toast.success`/`toast.error`).
- При истечении токена API ответит 401; обработка авто-логаута пока не реализована — добавлять централизованно в `authenticatedRequest()`.

## Тосты и иконки

- Уведомления — `sonner` (`import { toast } from 'sonner'`). `<Toaster>` уже в root layout, дополнительно нигде монтировать не нужно.
- Иконки — `lucide-react` (соответствует `iconLibrary` в `components.json`). Не подмешивать другие icon-паки.

## TypeScript / структура

- `tsconfig.json` наследует workspace-настройки из `tsconfig.base.json` (включая `noUncheckedIndexedAccess: true`). Path alias `@/*` → `./src/*`.
- `next.config.ts`: `reactStrictMode: true`, `transpilePackages: ['@expense-tracker/shared']` (обязательно — иначе RSC/SSR упадут на TS-сорсах из workspace-пакета).
- Backend URL — `NEXT_PUBLIC_API_URL` в `apps/frontend/.env.local` (есть `.env.example`).

## Чего не делать

- Не добавлять `tailwind.config.ts` — конфиг в CSS (`@theme`), Tailwind v4 не подхватит JS-конфиг автоматически.
- Не импортировать типы из `apps/backend/...` — только через `@expense-tracker/shared`.
- Не работать с токеном напрямую в компонентах — всё через `authStorage` + `useAuth()`.
- Не оборачивать страницы внутри `(authenticated)/` в `<RequireAuth>` ещё раз — layout уже это делает.
