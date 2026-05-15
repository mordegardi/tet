# Expense Tracker

Монорепозиторий: **Next.js 16** (frontend) + **NestJS** (backend) + **Prisma** + **PostgreSQL**.

## Структура

```
apps/
  frontend/    # Next.js 16 (App Router, Tailwind CSS)
  backend/     # NestJS + Prisma + Swagger
packages/
  shared/      # Общие типы и DTO между frontend и backend
```

## Стек

- **pnpm** + **Turborepo** — управление монорепо
- **Next.js 16** (App Router) + TypeScript + **Tailwind CSS** — frontend
- **NestJS** + **Prisma** + **@nestjs/swagger** — backend
- **PostgreSQL 16** через **Docker Compose** — БД
- **Biome** — линтер + форматтер
- **Husky** + **lint-staged** — pre-commit хуки

## Быстрый старт

> Требуется Node.js >=20, pnpm, Docker.

```bash
# 1. Установить зависимости
pnpm install

# 2. Скопировать переменные окружения
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local

# 3. Поднять PostgreSQL
pnpm db:up

# 4. Сгенерировать Prisma client
pnpm --filter @expense-tracker/backend prisma:generate

# 5. Запустить dev-сервера
pnpm dev
```

После запуска:

- Frontend → http://localhost:3000
- Backend → http://localhost:3001
- Swagger UI → http://localhost:3001/api/docs

## Полезные команды

```bash
pnpm build          # сборка всех проектов
pnpm lint           # линт через Biome
pnpm format         # форматирование через Biome
pnpm typecheck      # проверка типов
pnpm db:down        # остановить PostgreSQL
```
