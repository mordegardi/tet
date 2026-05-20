# Архитектура проекта Expense Tracker

## Обзор

Монорепо на **pnpm workspaces + Turborepo** с двумя приложениями и одним общим пакетом.

```
expense-tracker/
├── apps/
│   ├── backend/          # NestJS API (порт 3001)
│   └── frontend/         # Next.js 16 App Router (порт 3000)
├── packages/
│   └── shared/           # Общие типы и DTO-контракты
├── turbo.json
└── package.json          # root — pnpm workspaces
```

## Стек технологий

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Backend | NestJS, TypeScript, Passport, JWT |
| ORM | Prisma v7 (`prisma-client` генератор) |
| БД | PostgreSQL 16 (Docker Compose) |
| Общий пакет | `@expense-tracker/shared` — типы/контракты |
| Линтинг | Biome (заменяет ESLint + Prettier) |
| Git хуки | Husky + lint-staged |
| Сборка | Turborepo (кеширует `build`, `lint`, `typecheck`) |

## Backend (NestJS)

### Точка входа

`apps/backend/src/main.ts` — Bootstrap:
- Глобальный `ValidationPipe` (`whitelist`, `transform`, `forbidNonWhitelisted`)
- Swagger смонтирован на `/api/docs`
- CORS разрешает `FRONTEND_URL` (default `http://localhost:3000`) с `credentials: true`
- Порт из `ConfigService` (default `3001`)

### Модульная структура

```
AppModule
├── ConfigModule (global, isGlobal: true)
├── PrismaModule (global)
├── ThrottlerModule (120 req / 60s, APP_GUARD)
├── UsersModule
├── AuthModule
├── CategoriesModule
└── TransactionsModule
```

### Паттерн Controller → Service → Repository

Каждый ресурс строго трёхуровневый:

- **Controller** — только HTTP: декораторы Swagger, `@UseGuards`, `@CurrentUser()`, возврат результата сервиса напрямую.
- **Service** — бизнес-логика: проверка прав владельца, маппинг Prisma-ошибок в `HttpException` (`P2002 → ConflictException`, `P2003 → ConflictException`).
- **Repository** — единственный слой с Prisma. Все запросы скоупятся по `userId` через `findFirst({ where: { id, userId } })`.

### Аутентификация

- JWT через `@nestjs/passport` + `passport-jwt`
- `JwtStrategy.validate` резолвит пользователя из БД и кладёт `PublicUser` в `req.user`
- `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()` ставятся на контроллеры ресурсов (не глобально — `/auth/*` остаются открытыми)
- `@CurrentUser()` — единственный способ получить текущего пользователя в хэндлере

### Prisma v7

- Генератор `prisma-client` (не `prisma-client-js`)
- Клиент генерируется в `apps/backend/src/generated/prisma`
- Импорт: `../generated/prisma/client` (не `@prisma/client`)
- `DATABASE_URL` живёт в `apps/backend/prisma.config.ts` через `defineConfig`
- Адаптер `PrismaPg` в `PrismaService`: `super({ adapter: new PrismaPg(...) })`

### Rate Limiting

- `ThrottlerGuard` глобально через `APP_GUARD`: дефолт 120 req / 60s
- `/auth/*` перекрыт: 10 req / 60s через `@Throttle`

## Frontend (Next.js 16)

### App Router

- Роуты в `apps/frontend/src/app/`
- `layout.tsx` — корневой layout

### Tailwind CSS v4

- CSS-first конфигурация: `globals.css` содержит только `@import "tailwindcss"`
- Нет `tailwind.config.ts` — кастомизация через `@theme { ... }` в CSS
- PostCSS использует `@tailwindcss/postcss` (не `tailwindcss` + `autoprefixer`)

### Переменные окружения

- `NEXT_PUBLIC_API_URL` — URL бэкенда (default `http://localhost:3001`)

## Shared пакет (`packages/shared`)

- Экспортирует TypeScript-источники напрямую (без build step)
- Содержит: request/response типы, DTO-контракты, `JwtPayload`
- Оба приложения импортируют через TS path aliases (`@expense-tracker/shared`)
- Next.js listens в `transpilePackages`

**Правило:** при добавлении нового эндпоинта — сначала описать request/response в `packages/shared/src/`, затем имплементировать в backend DTO и frontend fetcher.

## Turborepo Pipeline

| Задача | Зависимость | Кеш |
|--------|-------------|-----|
| `dev` | — | нет (persistent) |
| `build` | `^build` | `.next/**`, `dist/**` |
| `lint` | `^build` | да |
| `typecheck` | `^build` | да |

## TypeScript конфигурация

- `tsconfig.base.json`: `strict: true`, `noUncheckedIndexedAccess: true`
- Backend (`tsconfig.json`): отключает `noUncheckedIndexedAccess`, включает `experimentalDecorators` и `emitDecoratorMetadata`, модуль CommonJS/Node

## Переменные окружения

| Файл | Назначение |
|------|-----------|
| `.env` | root — `docker-compose.yml` (PostgreSQL) |
| `apps/backend/.env` | `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `PORT` |
| `apps/frontend/.env.local` | `NEXT_PUBLIC_API_URL` |

## Docker Compose

PostgreSQL 16 доступен на `:5432`. Запуск: `pnpm db:up`.
