# Move `type` Field from Category to Transaction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `type` (INCOME/EXPENSE) from the `Category` model and add it to `Transaction`, then reset and recreate all Prisma migrations from scratch.

**Architecture:** The enum is renamed from `CategoryType` to `TransactionType`. The Prisma schema, shared types, backend DTOs/repositories, and frontend component all update in lockstep. No data migration is needed — the database is dropped and recreated clean. After schema changes, `aggregateByType` filters by `transaction.type` instead of `category.type`.

**Tech Stack:** Prisma v7, NestJS, class-validator, Next.js 16, TypeScript, pnpm workspaces, Docker (postgres)

**Spec:** `docs/superpowers/specs/2026-05-18-move-type-to-transaction-design.md`

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `apps/backend/prisma/schema.prisma` | Modify | Remove `type` + enum from Category; add `TransactionType` enum + `type` to Transaction; simplify unique constraint |
| `apps/backend/prisma/migrations/` | Delete all + recreate | Fresh single migration from new schema |
| `apps/backend/src/generated/prisma/` | Auto-regenerated | Output of `prisma migrate dev` |
| `packages/shared/src/categories.ts` | Modify | Remove `CategoryType`, remove `type` from `Category` and `CreateCategoryRequest` |
| `packages/shared/src/transactions.ts` | Modify | Add `TransactionType`, add `type` to `Transaction` and `CreateTransactionRequest` |
| `apps/backend/src/categories/dto/create-category.dto.ts` | Modify | Remove `type` field and its validators |
| `apps/backend/src/categories/dto/update-category.dto.ts` | Modify | Remove `type` field and its validators |
| `apps/backend/src/categories/categories.repository.ts` | Modify | Remove `type` from `CreateCategoryData`; remove `CategoryType` import |
| `apps/backend/src/categories/categories.service.ts` | Modify | Update duplicate error message (remove "and type") |
| `apps/backend/src/transactions/dto/create-transaction.dto.ts` | Modify | Add `type` field with `@IsEnum` |
| `apps/backend/src/transactions/dto/update-transaction.dto.ts` | Modify | Add optional `type` field with `@IsEnum` |
| `apps/backend/src/transactions/transactions.repository.ts` | Modify | Add `type` to `CreateTransactionData`; add `type` to `create`/`update`; fix `aggregateByType` |
| `apps/frontend/src/components/transaction-list.tsx` | Modify | `t.category.type` → `t.type` (2 occurrences) |

---

## Task 1: Update Prisma schema

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Open the schema and replace its content**

Replace the full content of `apps/backend/prisma/schema.prisma` with:

```prisma
// Prisma schema для expense-tracker backend.
// Документация: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  categories   Category[]
  transactions Transaction[]
}

enum TransactionType {
  INCOME
  EXPENSE
}

model Category {
  id    String @id @default(cuid())
  name  String
  color String
  icon  String

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  transactions Transaction[]

  @@unique([userId, name])
  @@index([userId])
}

model Transaction {
  id          String          @id @default(cuid())
  amount      Decimal         @db.Decimal(12, 2)
  description String?
  date        DateTime
  type        TransactionType

  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([userId, date])
  @@index([categoryId])
}
```

- [ ] **Step 2: Verify the file looks correct**

Check that `Category` has no `type` field, `Transaction` has `type TransactionType`, and the unique constraint is `@@unique([userId, name])`.

---

## Task 2: Reset database and create fresh migration

**Files:**
- Delete: `apps/backend/prisma/migrations/` (all contents)
- Recreate: via `prisma migrate dev`

- [ ] **Step 1: Stop the database and remove its volume**

```powershell
docker compose down -v
```

Expected output: containers stopped, volume removed.

- [ ] **Step 2: Delete all existing migration files**

```powershell
Remove-Item -Recurse -Force apps\backend\prisma\migrations
```

- [ ] **Step 3: Start a fresh database**

```powershell
pnpm db:up
```

Wait until postgres is ready (a few seconds). Expected output: container started.

- [ ] **Step 4: Create the new baseline migration**

```powershell
pnpm --filter @expense-tracker/backend prisma:migrate
```

When prompted for a migration name, enter: `init`

Expected outcome:
- A new `apps/backend/prisma/migrations/<timestamp>_init/migration.sql` is created
- The Prisma client is regenerated in `apps/backend/src/generated/prisma/`
- The terminal shows "Your database is now in sync with your schema."

- [ ] **Step 5: Verify the generated client has `TransactionType` and no `CategoryType`**

```powershell
Select-String -Path "apps\backend\src\generated\prisma\client.ts" -Pattern "TransactionType"
Select-String -Path "apps\backend\src\generated\prisma\client.ts" -Pattern "CategoryType"
```

Expected: first command finds matches, second finds nothing.

---

## Task 3: Update shared types

**Files:**
- Modify: `packages/shared/src/categories.ts`
- Modify: `packages/shared/src/transactions.ts`

- [ ] **Step 1: Update `categories.ts` — remove `CategoryType` and `type` field**

Replace the full content of `packages/shared/src/categories.ts` with:

```typescript
export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  color: string;
  icon: string;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;
```

- [ ] **Step 2: Update `transactions.ts` — add `TransactionType` and `type` field**

Replace the full content of `packages/shared/src/transactions.ts` with:

```typescript
import type { Category } from './categories';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  amount: string; // Decimal serializes as string
  description: string | null;
  date: string; // ISO datetime
  type: TransactionType;
  categoryId: string;
  category: Category; // always included (Prisma include)
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRequest {
  amount: number; // frontend sends number
  description?: string;
  date: string; // ISO datetime
  categoryId: string;
  type: TransactionType;
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

- [ ] **Step 3: Typecheck the shared package**

```powershell
pnpm typecheck
```

Expected: errors in backend/frontend files (they haven't been updated yet) — that's fine. What matters is `packages/shared` itself has no internal errors.

---

## Task 4: Update Category backend — DTOs and repository

**Files:**
- Modify: `apps/backend/src/categories/dto/create-category.dto.ts`
- Modify: `apps/backend/src/categories/dto/update-category.dto.ts`
- Modify: `apps/backend/src/categories/categories.repository.ts`
- Modify: `apps/backend/src/categories/categories.service.ts`

- [ ] **Step 1: Update `create-category.dto.ts` — remove `type`**

Replace the full content:

```typescript
import type { CreateCategoryRequest } from '@expense-tracker/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto implements CreateCategoryRequest {
  @ApiProperty({ example: 'Еда', minLength: 1, maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: '#FF6B6B', description: 'HEX color, e.g. #RRGGBB' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be HEX like #RRGGBB' })
  color!: string;

  @ApiProperty({ example: '🍔', minLength: 1, maxLength: 8 })
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  icon!: string;
}
```

- [ ] **Step 2: Update `update-category.dto.ts` — remove `type`**

Replace the full content:

```typescript
import type { UpdateCategoryRequest } from '@expense-tracker/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateCategoryDto implements UpdateCategoryRequest {
  @ApiPropertyOptional({ example: 'Еда', minLength: 1, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({ example: '#FF6B6B', description: 'HEX color, e.g. #RRGGBB' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be HEX like #RRGGBB' })
  color?: string;

  @ApiPropertyOptional({ example: '🍔', minLength: 1, maxLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  icon?: string;
}
```

- [ ] **Step 3: Update `categories.repository.ts` — remove `type` from data interfaces**

Replace the full content:

```typescript
import { Injectable } from '@nestjs/common';
import type { Category } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCategoryData {
  userId: string;
  name: string;
  color: string;
  icon: string;
}

export type UpdateCategoryData = Partial<Omit<CreateCategoryData, 'userId'>>;

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findByIdForUser(id: string, userId: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, userId } });
  }

  create(data: CreateCategoryData): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: UpdateCategoryData): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  delete(id: string): Promise<void> {
    return this.prisma.category.delete({ where: { id } }).then(() => undefined);
  }
}
```

- [ ] **Step 4: Update `categories.service.ts` — fix duplicate error message**

Change line 8 only (the `DUPLICATE_MESSAGE` constant):

```typescript
const DUPLICATE_MESSAGE = 'Category with this name already exists';
```

- [ ] **Step 5: Typecheck backend**

```powershell
pnpm --filter @expense-tracker/backend typecheck
```

Expected: only transaction-related errors remain (those files haven't been updated yet).

- [ ] **Step 6: Commit category changes**

```powershell
git add apps/backend/prisma/ packages/shared/src/ apps/backend/src/categories/
git commit -m "refactor: move type from Category to Transaction - schema and category side"
```

---

## Task 5: Update Transaction backend — DTOs and repository

**Files:**
- Modify: `apps/backend/src/transactions/dto/create-transaction.dto.ts`
- Modify: `apps/backend/src/transactions/dto/update-transaction.dto.ts`
- Modify: `apps/backend/src/transactions/transactions.repository.ts`

- [ ] **Step 1: Update `create-transaction.dto.ts` — add `type`**

Replace the full content:

```typescript
import type { CreateTransactionRequest, TransactionType } from '@expense-tracker/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTransactionDto implements CreateTransactionRequest {
  @ApiProperty({ example: 1500.5, description: 'Amount, up to 2 decimal places' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'Lunch at cafe', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  @IsDateString()
  date!: string;

  @ApiProperty({
    example: 'clxxx...',
    description: 'ID of an existing category belonging to this user',
  })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'] })
  @IsEnum({ INCOME: 'INCOME', EXPENSE: 'EXPENSE' })
  type!: TransactionType;
}
```

- [ ] **Step 2: Update `update-transaction.dto.ts` — add optional `type`**

Replace the full content:

```typescript
import type { TransactionType, UpdateTransactionRequest } from '@expense-tracker/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTransactionDto implements UpdateTransactionRequest {
  @ApiPropertyOptional({ example: 2000.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: 'Updated description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '2026-05-17T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 'clyyy...', description: 'New category ID' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['INCOME', 'EXPENSE'] })
  @IsOptional()
  @IsEnum({ INCOME: 'INCOME', EXPENSE: 'EXPENSE' })
  type?: TransactionType;
}
```

- [ ] **Step 3: Update `transactions.repository.ts` — add `type` throughout, fix `aggregateByType`**

Replace the full content:

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateTransactionData {
  userId: string;
  categoryId: string;
  amount: number;
  description?: string;
  date: string;
  type: TransactionType;
}

type UpdateTransactionData = Partial<Omit<CreateTransactionData, 'userId'>>;

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
    });
  }

  findByIdForUser(id: string, userId: string) {
    return this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });
  }

  create(data: CreateTransactionData) {
    return this.prisma.transaction.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId,
        amount: data.amount,
        description: data.description,
        date: new Date(data.date),
        type: data.type,
      },
      include: { category: true },
    });
  }

  update(id: string, data: UpdateTransactionData) {
    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.type !== undefined && { type: data.type }),
      },
      include: { category: true },
    });
  }

  delete(id: string): Promise<void> {
    return this.prisma.transaction.delete({ where: { id } }).then(() => undefined);
  }

  async aggregateByType(userId: string, gte: Date, lt: Date) {
    const [income, expense] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, date: { gte, lt }, type: 'INCOME' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, date: { gte, lt }, type: 'EXPENSE' },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);
    return {
      income: { sum: income._sum.amount ?? new Prisma.Decimal(0), count: income._count.id },
      expense: { sum: expense._sum.amount ?? new Prisma.Decimal(0), count: expense._count.id },
    };
  }
}
```

- [ ] **Step 4: Typecheck backend**

```powershell
pnpm --filter @expense-tracker/backend typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit transaction backend changes**

```powershell
git add apps/backend/src/transactions/
git commit -m "refactor: add type field to Transaction DTOs and repository"
```

---

## Task 6: Update frontend

**Files:**
- Modify: `apps/frontend/src/components/transaction-list.tsx`

- [ ] **Step 1: Replace `t.category.type` with `t.type` (2 occurrences)**

In `apps/frontend/src/components/transaction-list.tsx`:

Change line 7-10 (`formatAmount` call site and signature stay the same, but usages change):

Line 55 — change:
```tsx
t.category.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
```
to:
```tsx
t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
```

Line 58 — change:
```tsx
{formatAmount(t.amount, t.category.type)}
```
to:
```tsx
{formatAmount(t.amount, t.type)}
```

- [ ] **Step 2: Typecheck frontend**

```powershell
pnpm --filter @expense-tracker/frontend typecheck
```

Expected: no errors.

- [ ] **Step 3: Run full monorepo typecheck**

```powershell
pnpm typecheck
```

Expected: no errors across all packages.

- [ ] **Step 4: Commit frontend change**

```powershell
git add apps/frontend/src/components/transaction-list.tsx
git commit -m "refactor: read transaction type from transaction, not category"
```

---

## Task 7: Final verification

- [ ] **Step 1: Start the full dev stack**

```powershell
pnpm dev
```

Wait for both `frontend :3000` and `backend :3001` to be ready.

- [ ] **Step 2: Verify Swagger reflects the new schema**

Open `http://localhost:3001/api/docs` and confirm:
- `POST /categories` body has `name`, `color`, `icon` — **no `type`**
- `POST /transactions` body has `amount`, `date`, `categoryId`, `type` (INCOME/EXPENSE)

- [ ] **Step 3: Smoke test via Swagger**

1. POST `/auth/register` → create a user, copy the JWT token
2. Click "Authorize" in Swagger and paste the token
3. POST `/categories` with `{ "name": "Food", "color": "#FF6B6B", "icon": "🍔" }` → should return 201 with no `type` field
4. POST `/transactions` with `{ "amount": 500, "date": "2026-05-18T12:00:00.000Z", "categoryId": "<id from step 3>", "type": "EXPENSE" }` → should return 201 with `type: "EXPENSE"`
5. GET `/transactions` → verify the returned transaction has `type` at the top level, and `category` has no `type`

- [ ] **Step 4: Check transaction-list on the dashboard**

Open `http://localhost:3000`, log in, and verify the dashboard transaction list renders correctly (green/red color and +/- sign based on transaction type).
