# Implementation Plan: TransactionsModule

## Context

Бэкенд уже содержит `UsersModule`, `AuthModule` (JWT) и `CategoriesModule` с устоявшимся паттерном (controller / service / repository / dto, защита через `@UseGuards(JwtAuthGuard)` + `@CurrentUser()`, обработка ошибок Prisma). Нужно добавить центральный для приложения модуль **TransactionsModule** для учёта доходов/расходов с привязкой к пользователю и категории, с CRUD и агрегацией по периоду. Это закрывает основной use-case трекера и подготавливает данные для будущего фронтенд-дашборда.

Дополнительно: удалить из схемы legacy-модель `Expense` (placeholder из начального скаффолда без связей).

## Design Decisions (зафиксировано)

- **Тип транзакции** хранится только на `Category`. На `Transaction` поле `type` отсутствует — тип определяется через `category.type`. Это исключает рассинхрон.
- **Summary** возвращает только агрегаты: `totalIncome`, `totalExpense`, `balance`, `transactionCount`. Без разбивки по категориям.
- **Модель Expense удаляется** в той же миграции, что добавит Transaction.
- **`amount` = Prisma `Decimal(12, 2)`** — точный для денег, сериализуется в JSON как строка (поведение `Prisma.Decimal`). На входе DTO принимаем `number`, на выходе всегда `string`.

## Изменения схемы (`apps/backend/prisma/schema.prisma`)

1. **Удалить** модель `Expense` целиком.
2. **Добавить** в `User`: `transactions Transaction[]`.
3. **Добавить** в `Category`: `transactions Transaction[]`.
4. **Добавить** новую модель:

```prisma
model Transaction {
  id          String   @id @default(cuid())
  amount      Decimal  @db.Decimal(12, 2)
  description String?
  date        DateTime

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([userId, date])
  @@index([categoryId])
}
```

**Обоснование `onDelete: Restrict` на Category:** защита от случайной потери истории. Если у категории есть транзакции, удаление возвращает 409 (см. ниже про `categories.service`).

## Миграция

```bash
pnpm --filter @expense-tracker/backend prisma:migrate
# имя: add_transaction
```

Файл попадёт в `apps/backend/prisma/migrations/<timestamp>_add_transaction/` (одна миграция и для Transaction, и для удаления Expense).

## Shared-типы (`packages/shared/src/`)

Создать `transactions.ts`:

```typescript
import type { Category } from './categories';

export interface Transaction {
  id: string;
  amount: string;            // Decimal сериализуется как string
  description: string | null;
  date: string;              // ISO datetime
  categoryId: string;
  category: Category;        // всегда включена (Prisma include)
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRequest {
  amount: number;            // фронт шлёт число
  description?: string;
  date: string;              // ISO datetime
  categoryId: string;
}

export type UpdateTransactionRequest = Partial<CreateTransactionRequest>;

export interface TransactionSummary {
  year: number;
  month: number | null;
  totalIncome: string;
  totalExpense: string;
  balance: string;
  transactionCount: number;
}
```

Обновить `packages/shared/src/index.ts`: добавить `export * from './transactions';`.

## Структура модуля (`apps/backend/src/transactions/`)

```
transactions/
├── transactions.module.ts
├── transactions.controller.ts
├── transactions.service.ts
├── transactions.repository.ts
└── dto/
    ├── create-transaction.dto.ts
    ├── update-transaction.dto.ts
    └── transaction-summary-query.dto.ts
```

### `transactions.repository.ts`

- Регулярный `import { PrismaService } from '../prisma/prisma.service'` (НЕ `import type` — иначе DI ломается, см. недавний фикс).
- Интерфейс `CreateTransactionData` (включает `userId`, `categoryId`, `amount`, `description`, `date`).
- Тип `UpdateTransactionData = Partial<Omit<CreateTransactionData, 'userId'>>`.
- Методы:
  - `findAllByUser(userId)` — `include: { category: true }`, `orderBy: { date: 'desc' }`.
  - `findByIdForUser(id, userId)` — `findFirst` с `include: { category: true }`.
  - `create(data)` — `include: { category: true }`.
  - `update(id, data)` — `include: { category: true }`.
  - `delete(id)` → `Promise<void>` через `.then(() => undefined)`.
  - `aggregateByType(userId, gte, lt)` → возвращает `{ income: { sum, count }, expense: { sum, count } }`. Реализация: два параллельных `prisma.transaction.aggregate` (Promise.all) с фильтрами `category: { type: 'INCOME' | 'EXPENSE' }`.

### `transactions.service.ts`

- DI: `TransactionsRepository`, `CategoriesRepository` (для проверки владения категорией).
- Регулярный `import { CategoriesRepository }`; экспортировать его в `CategoriesModule` (см. ниже).
- Методы:
  - `findAll(userId)`
  - `findOne(id, userId)` → 404 если не найдено.
  - `create(userId, dto)`:
    1. Проверить, что `categoryId` принадлежит `userId` (через `CategoriesRepository.findByIdForUser`). Иначе `NotFoundException('Category not found')`.
    2. Создать транзакцию.
  - `update(id, userId, dto)`:
    1. Проверить, что транзакция существует и принадлежит пользователю.
    2. Если `dto.categoryId` задан — проверить, что новая категория принадлежит пользователю.
    3. Обновить.
  - `remove(id, userId)`:
    1. Проверить существование.
    2. `delete`.
  - `summary(userId, year, month?)`:
    1. Вычислить `gte` / `lt` (UTC: январь-01 текущего/следующего года или начало-конец месяца).
    2. `repository.aggregateByType(userId, gte, lt)`.
    3. Использовать `Prisma.Decimal` для арифметики: `balance = income.sum.minus(expense.sum)`.
    4. Вернуть `{ year, month: month ?? null, totalIncome, totalExpense, balance, transactionCount }`, где суммы — `.toFixed(2)` либо `.toString()`.

### `transactions.controller.ts`

- `@ApiTags('transactions') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('transactions')`.
- Endpoints (порядок важен — `summary` ПЕРЕД `:id`, чтобы не словить конфликт маршрутов):
  - `GET /transactions` → `findAll(@CurrentUser() user)`
  - `GET /transactions/summary` → `summary(@Query() query, @CurrentUser() user)` (использует `TransactionSummaryQueryDto`)
  - `GET /transactions/:id` → `findOne`
  - `POST /transactions` → `create(@Body() dto, @CurrentUser() user)` (201)
  - `PATCH /transactions/:id` → `update`
  - `DELETE /transactions/:id` → `remove`, `@HttpCode(NO_CONTENT)`, `Promise<void>`
- Каждый — с `@ApiOperation` и `@ApiResponse` (200/201/204, 400, 401, 404 где применимо).

### DTOs

`create-transaction.dto.ts`:
```typescript
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CreateTransactionRequest } from '@expense-tracker/shared';

export class CreateTransactionDto implements CreateTransactionRequest {
  @ApiProperty({ example: 1500.50, description: 'Сумма в рублях, до 2 знаков' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'Обед в кафе', maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'clxxx...', description: 'ID существующей категории пользователя' })
  @IsString()
  categoryId!: string;
}
```

`update-transaction.dto.ts`: всё то же, но все поля `@IsOptional()`, `implements UpdateTransactionRequest`.

`transaction-summary-query.dto.ts`:
```typescript
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionSummaryQueryDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number) @IsInt() @Min(1900) @Max(2100)
  year!: number;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 12 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  month?: number;
}
```

### `transactions.module.ts`

```typescript
@Module({
  imports: [AuthModule, CategoriesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsRepository],
})
export class TransactionsModule {}
```

## Обновление CategoriesModule

1. **`categories.module.ts`**: добавить `CategoriesRepository` в `exports` (сейчас экспортируется только `CategoriesService`). Это нужно, чтобы `TransactionsService` мог проверить принадлежность категории пользователю.

2. **`categories.service.ts`** — обновить `remove`:
   ```typescript
   async remove(id: string, userId: string): Promise<void> {
     await this.findOne(id, userId);
     try {
       await this.repository.delete(id);
     } catch (error) {
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
         throw new ConflictException('Cannot delete category with existing transactions');
       }
       throw error;
     }
   }
   ```
   Это последствие `onDelete: Restrict` на новой связи Category→Transaction. Аналог P2002-обработки уже есть в файле для create/update.

3. **`categories.controller.ts`**: добавить `@ApiResponse({ status: 409, description: '...' })` к `DELETE`.

## Регистрация в AppModule

`apps/backend/src/app.module.ts`:
- Добавить `import { TransactionsModule } from './transactions/transactions.module';`
- Добавить `TransactionsModule` в массив `imports`.

## Критические файлы (для модификации/создания)

**Создать:**
- `apps/backend/src/transactions/transactions.module.ts`
- `apps/backend/src/transactions/transactions.controller.ts`
- `apps/backend/src/transactions/transactions.service.ts`
- `apps/backend/src/transactions/transactions.repository.ts`
- `apps/backend/src/transactions/dto/create-transaction.dto.ts`
- `apps/backend/src/transactions/dto/update-transaction.dto.ts`
- `apps/backend/src/transactions/dto/transaction-summary-query.dto.ts`
- `packages/shared/src/transactions.ts`

**Модифицировать:**
- `apps/backend/prisma/schema.prisma` — удалить Expense, добавить Transaction, обновить User/Category
- `apps/backend/src/app.module.ts` — зарегистрировать TransactionsModule
- `apps/backend/src/categories/categories.module.ts` — экспортировать CategoriesRepository
- `apps/backend/src/categories/categories.service.ts` — обработать P2003 в `remove`
- `apps/backend/src/categories/categories.controller.ts` — `@ApiResponse(409)` на DELETE
- `packages/shared/src/index.ts` — `export * from './transactions';`

## Используем существующее (НЕ создавать заново)

- `PrismaService` — `apps/backend/src/prisma/prisma.service.ts` (DI через регулярный импорт).
- `JwtAuthGuard` — `apps/backend/src/auth/guards/jwt-auth.guard.ts`.
- `CurrentUser` декоратор — `apps/backend/src/auth/decorators/current-user.decorator.ts`.
- `CategoriesRepository.findByIdForUser` — `apps/backend/src/categories/categories.repository.ts` (для проверки владения категорией).
- `Prisma` (для `PrismaClientKnownRequestError` и `Decimal`) — `import { Prisma } from '../generated/prisma/client'`.
- Класс `class-validator` + `class-transformer` декораторов (уже в зависимостях).
- `AuthModule` — импортировать в `TransactionsModule`, как делает `CategoriesModule`.

## Соглашения, которым следовать (важно)

- **`import` vs `import type`**: сервисы/репозитории/контроллеры в DI — регулярный `import`. Типы (interfaces, model types из Prisma `client`) — `import type`. Иначе сломается NestJS DI (см. недавний инцидент).
- Структура файлов и нейминг (`<feature>.<role>.ts`, `dto/<action>-<feature>.dto.ts`) — как в `categories/`.
- Каждый сервис-метод принимает `userId` и фильтрует по нему. Repository никогда не доверяет вызвавшему — фильтр в WHERE.
- Ошибки: `NotFoundException` (нет/не принадлежит), `ConflictException` (P2002/P2003), `BadRequestException` (валидация — обычно ловит pipe сам).

## Verification

Последовательность ровно такая:

```bash
# 1. Сгенерировать клиент после правки схемы
pnpm --filter @expense-tracker/backend prisma:generate

# 2. Создать и применить миграцию (база уже запущена через pnpm db:up)
pnpm --filter @expense-tracker/backend prisma:migrate
# → имя: add_transaction

# 3. Сборка (TS)
pnpm --filter @expense-tracker/backend build

# 4. Typecheck по всему монорепо (shared types подхватятся)
pnpm typecheck

# 5. Lint
pnpm --filter @expense-tracker/backend lint
```

**End-to-end в Swagger UI** (`http://localhost:3001/api/docs`):

1. `POST /auth/register` → получить токен, авторизоваться (Bearer).
2. `POST /categories` → создать категорию `type: INCOME`.
3. `POST /categories` → создать категорию `type: EXPENSE`.
4. `POST /transactions` с категорией дохода → 201, в ответе amount как string, category включена.
5. `POST /transactions` с категорией расхода → 201.
6. `GET /transactions` → массив из двух, отсортирован по `date` desc, у каждого `category` внутри.
7. `GET /transactions/summary?year=2026&month=5` → `totalIncome` = доход, `totalExpense` = расход, `balance` = разница, `transactionCount: 2`.
8. `GET /transactions/summary?year=2026` (без month) → агрегаты за весь год.
9. `PATCH /transactions/:id` с новой суммой → 200, amount изменился.
10. `POST /transactions` с `categoryId` от чужого пользователя (зарегистрировать второго юзера, его категорию подставить) → 404.
11. `DELETE /categories/:id` для категории с транзакциями → 409 «Cannot delete category with existing transactions».
12. `DELETE /transactions/:id` → 204, далее `DELETE /categories/:id` той же категории → 204.

**Code review после реализации** (per prompt requirements):
- Прогнать `pnpm lint` и `pnpm typecheck` ещё раз — нет ошибок.
- Проверить, что нигде в новых файлах нет `import type { *Service|*Repository|*Module }` для DI-зависимостей.
- Проверить, что во всех новых controller-методах есть `@CurrentUser()` и `userId` доходит до сервиса.
- Проверить, что в репозитории все запросы фильтруют по `userId`.
- Прогнать `pnpm --filter @expense-tracker/backend build` — финальная сборка.
