# Expense Tracker

Приложение для учёта личных финансов. Позволяет регистрировать доходы и расходы по категориям, смотреть историю транзакций и получать сводку по периоду.

Монорепозиторий: **Next.js 16** (frontend) + **NestJS** (backend) + **Prisma v7** + **PostgreSQL 16**.

---

## Стек

| Слой | Технологии |
|---|---|
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui v4, React Hook Form, Zod, Sonner |
| **Backend** | NestJS, Prisma v7, PostgreSQL 16, Passport JWT, `@nestjs/swagger`, Throttler |
| **Shared** | `@expense-tracker/shared` — общие DTO и типы запросов/ответов |
| **Tooling** | pnpm workspaces, Turborepo, Biome (lint + format), Husky + lint-staged, Docker Compose |

---

## Структура репозитория

```
apps/
  frontend/          # Next.js 16 (App Router, Tailwind CSS v4, shadcn/ui)
  backend/           # NestJS + Prisma + Swagger
packages/
  shared/            # Общие типы и контракты API (без шага сборки)
```

### Backend — модули

| Модуль | Маршруты |
|---|---|
| **Auth** | `POST /auth/register`, `POST /auth/login` |
| **Categories** | `GET/POST /categories`, `GET/PATCH/DELETE /categories/:id` |
| **Transactions** | `GET/POST /transactions`, `GET/PATCH/DELETE /transactions/:id`, `GET /transactions/summary` |
| **Users** | внутренний — используется Auth-модулем |

### Frontend — страницы

| Маршрут | Доступ |
|---|---|
| `/login` | публичный |
| `/register` | публичный |
| `/` | защищённый — список транзакций |

### База данных — модели

- **User** — учётная запись (email уникален)
- **Category** — категория транзакций (`name` уникален в рамках пользователя), имеет цвет и иконку
- **Transaction** — доходы (`INCOME`) и расходы (`EXPENSE`), привязаны к категории и пользователю, сумма `Decimal(12, 2)`

---

## Быстрый старт

> Требуется: Node.js ≥ 20, pnpm, Docker.

```bash
# 1. Установить зависимости
pnpm install

# 2. Скопировать переменные окружения
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local

# 3. Поднять PostgreSQL (Docker)
pnpm db:up

# 4. Сгенерировать Prisma client
pnpm --filter @expense-tracker/backend prisma:generate

# 5. Применить схему к БД
pnpm --filter @expense-tracker/backend prisma:migrate

# 6. Запустить оба сервера
pnpm dev
```

После запуска:

| Сервис | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Swagger UI | http://localhost:3001/api/docs |

---

## Переменные окружения

**`apps/backend/.env`** (пример в `.env.example`):

| Переменная | Описание | По умолчанию |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/expense_tracker` |
| `JWT_SECRET` | Секрет для подписи JWT — **обязателен**, старт упадёт без него | — |
| `JWT_EXPIRES_IN` | Срок жизни токена | `7d` |
| `PORT` | Порт backend-сервера | `3001` |
| `FRONTEND_URL` | Origin для CORS | `http://localhost:3000` |

**`apps/frontend/.env.local`** (пример в `.env.example`):

| Переменная | Описание | По умолчанию |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL backend API | `http://localhost:3001` |

---

## Команды

Все команды выполняются из корня репозитория.

```bash
# Разработка
pnpm dev               # запустить frontend (:3000) и backend (:3001) параллельно
pnpm db:up             # поднять PostgreSQL в Docker
pnpm db:down           # остановить PostgreSQL

# Сборка и качество кода
pnpm build             # сборка всего монорепо
pnpm typecheck         # проверка типов
pnpm lint              # линт через Biome
pnpm format            # форматирование через Biome

# Prisma (только backend)
pnpm --filter @expense-tracker/backend prisma:generate   # сгенерировать client
pnpm --filter @expense-tracker/backend prisma:migrate    # создать и применить миграцию
pnpm --filter @expense-tracker/backend prisma:deploy     # применить миграции (prod)
pnpm --filter @expense-tracker/backend prisma:studio     # открыть Prisma Studio

# Тесты (только backend)
pnpm --filter @expense-tracker/backend test              # unit-тесты (Jest)
pnpm --filter @expense-tracker/backend test:e2e          # e2e-тесты
```

---

## Архитектура backend

Каждый ресурс следует трёхуровневой схеме **Controller → Service → Repository**:

- **Controller** — HTTP-слой: маршрут, guard, Swagger-декораторы, DTO.
- **Service** — бизнес-логика, проверка прав, маппинг ошибок Prisma в HTTP-исключения.
- **Repository** — единственный слой, знающий о Prisma. Все запросы скоупятся по `userId`.

Новые контракты API описываются сначала в `packages/shared/src/`, затем используются одновременно в backend-DTO и в `apps/frontend/src/lib/api.ts`.

---

## Авторизация

Аутентификация — JWT Bearer. Для работы с защищёнными эндпоинтами:

1. Зарегистрируйся: `POST /auth/register`
2. Войди: `POST /auth/login` — получи `accessToken`
3. Передавай заголовок `Authorization: Bearer <accessToken>` в каждом запросе

В Swagger UI нажми **Authorize** и вставь токен — все последующие запросы будут подписаны автоматически.
