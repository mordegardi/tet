# Гайд для разработчиков

## Быстрый старт

### Требования

- Node.js >= 20
- pnpm 9.12.0 (зафиксирован в `package.json`)
- Docker Desktop (для PostgreSQL)

### Установка и запуск

```bash
# 1. Установить зависимости
pnpm install

# 2. Создать .env файлы из примеров
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.local.example apps/frontend/.env.local

# 3. Запустить PostgreSQL
pnpm db:up

# 4. Применить схему БД
pnpm --filter @expense-tracker/backend prisma:generate

# 5. Запустить оба приложения
pnpm dev
```

После запуска:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Swagger UI: `http://localhost:3001/api/docs`

---

## Структура команд

Все команды выполняются из **корня репозитория** через `pnpm --filter`.

```bash
# Запустить только backend
pnpm --filter @expense-tracker/backend dev

# Запустить только frontend
pnpm --filter @expense-tracker/frontend dev

# Сборка всего монорепо
pnpm build

# Линтинг + форматирование
pnpm lint
pnpm format   # biome format --write .

# Типизация
pnpm typecheck

# Тесты backend
pnpm --filter @expense-tracker/backend test
pnpm --filter @expense-tracker/backend test -- path/to/file.spec.ts
pnpm --filter @expense-tracker/backend test -- -t "имя теста"
pnpm --filter @expense-tracker/backend test:e2e
```

---

## Добавление нового эндпоинта

Строгий порядок шагов при добавлении любого нового API:

### 1. Описать типы в `packages/shared`

```typescript
// packages/shared/src/types.ts
export interface CreateWidgetRequest {
  name: string;
  value: number;
}

export interface WidgetResponse {
  id: string;
  name: string;
  value: number;
  userId: string;
  createdAt: string;
}
```

Экспортировать из `packages/shared/src/index.ts`.

### 2. Создать DTO на backend

```typescript
// apps/backend/src/widgets/dto/create-widget.dto.ts
import type { CreateWidgetRequest } from '@expense-tracker/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class CreateWidgetDto implements CreateWidgetRequest {
  @ApiProperty({ example: 'My Widget' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 42 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;
}
```

### 3. Создать Response DTO

```typescript
// apps/backend/src/widgets/dto/widget-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class WidgetResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() value!: string;   // Decimal → string
  @ApiProperty() userId!: string;
  @ApiProperty() createdAt!: string;
}
```

### 4. Repository → Service → Controller

Создать три файла в трёхуровневой архитектуре:
- `widgets.repository.ts` — только Prisma, фильтровать по `userId`
- `widgets.service.ts` — бизнес-логика, маппинг ошибок Prisma
- `widgets.controller.ts` — HTTP слой, `@UseGuards(JwtAuthGuard)`, `@ApiBearerAuth()`

### 5. Подключить модуль в AppModule

```typescript
// apps/backend/src/app.module.ts
imports: [..., WidgetsModule]
```

### 6. Использовать тип на frontend

```typescript
// apps/frontend/src/lib/api.ts
import type { WidgetResponse } from '@expense-tracker/shared';

export async function getWidgets(): Promise<WidgetResponse[]> {
  const res = await fetch(`${API_URL}/widgets`, { headers: authHeaders() });
  return res.json();
}
```

---

## Правила работы с кодом

### Backend

**Не делать:**
- Не создавать `new PrismaClient()` вручную — только инжектировать `PrismaService`
- Не обращаться к Prisma напрямую из Service — только через Repository
- Не возвращать `passwordHash` наружу — только `UsersService.toPublic(user)`
- Не использовать `findUnique` в Repository — использовать `findFirst({ where: { id, userId } })`

**Делать:**
- Маппить Prisma ошибки в HttpException в Service: `P2002 → ConflictException`, `P2003 → ConflictException('cannot delete ...')`
- Аннотировать DTO `@ApiProperty` / `@ApiPropertyOptional` для Swagger
- Валидировать денежные суммы через `@IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)`
- Валидировать даты через `@IsDateString()`, конвертировать через `new Date(...)` в Repository

### Shared пакет

API-контракты (request/response типы) **обязательно** объявляются в `packages/shared` перед имплементацией. DTO бэкенда `implements <RequestType>` — это compile-time страховка от дрейфа.

### Frontend

- `NEXT_PUBLIC_API_URL` из env для URL бэкенда
- Декораторы и decorator-heavy код держать на бэкенде (несовместимы с Next.js RSC)

---

## Кодстайл (Biome)

- 2 пробела для отступов
- Ширина строки: 100 символов
- Одинарные кавычки (в JSX — двойные)
- Точка с запятой обязательна
- Trailing commas везде
- `organizeImports` включён

Pre-commit хук автоматически запускает `biome check --write` через Husky + lint-staged.

Запустить форматирование вручную:
```bash
pnpm format
```

---

## Работа с Prisma

### Изменение схемы

1. Отредактировать `apps/backend/prisma/schema.prisma`
2. Регенерировать клиент: `pnpm --filter @expense-tracker/backend prisma:generate`
3. Применить изменения в dev: `pnpm --filter @expense-tracker/backend prisma:migrate`

### Просмотр данных

```bash
pnpm --filter @expense-tracker/backend prisma:studio
```

### Важно: импорт клиента

```typescript
// Правильно:
import { PrismaClient } from '../generated/prisma/client';

// Неправильно:
import { PrismaClient } from '@prisma/client';
```

---

## Переменные окружения Backend

Создать `apps/backend/.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/expense_tracker"
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:3000"
PORT=3001
```

`JWT_SECRET` обязателен — `getOrThrow` уронит старт, если переменной нет.

---

## Написание тестов

Тесты живут рядом с тестируемым файлом: `*.spec.ts`.

```bash
# Запустить все тесты
pnpm --filter @expense-tracker/backend test

# Запустить конкретный файл
pnpm --filter @expense-tracker/backend test -- src/transactions/transactions.service.spec.ts

# Запустить по имени теста
pnpm --filter @expense-tracker/backend test -- -t "should create transaction"

# E2E тесты
pnpm --filter @expense-tracker/backend test:e2e
```

Конфиг Jest находится в `apps/backend/package.json` (`jest` секция).

---

## Частые проблемы

### Backend не стартует

- Проверить, что `JWT_SECRET` задан в `apps/backend/.env`
- Проверить, что PostgreSQL запущен: `pnpm db:up`
- Проверить, что `DATABASE_URL` валиден

### Ошибка типов после изменения схемы Prisma

Регенерировать клиент: `pnpm --filter @expense-tracker/backend prisma:generate`

### `nest build` не находит entryFile

`nest-cli.json` использует `"entryFile": "apps/backend/src/main"` (путь от корня монорепо). Не «исправлять» на `src/main`.

### Tailwind стили не применяются

- Убедиться, что в `globals.css` есть `@import "tailwindcss"` (Tailwind v4)
- Нет `tailwind.config.ts` — это нормально, v4 использует CSS-first конфигурацию

### Ошибка 409 при удалении категории

Нельзя удалить категорию с существующими транзакциями. Сначала удалить или переназначить транзакции.
