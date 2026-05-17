# Move `type` field from Category to Transaction

**Date:** 2026-05-18  
**Branch:** feat/jwt-auth  
**Status:** Approved

## Problem

The `type` field (`INCOME` / `EXPENSE`) currently lives on `Category`. This is semantically wrong: a category is a label (e.g. "Food"), and the income/expense nature belongs to the transaction itself. A transaction like "Food" can be either an expense or a refund.

## Decision

Move `type` from `Category` to `Transaction`. Reset and recreate all Prisma migrations from scratch.

## Schema changes

**Before:**
```
model Category {
  type  CategoryType        // ← here
  @@unique([userId, name, type])
}

model Transaction {
  // no type
}
```

**After:**
```
model Transaction {
  type  TransactionType    // ← moved here
}

model Category {
  @@unique([userId, name]) // simpler constraint
}
```

- Rename enum `CategoryType` → `TransactionType` (reflects its new owner).
- `@@unique([userId, name, type])` on Category becomes `@@unique([userId, name])`. A user cannot have two categories with the same name (regardless of type).

## Files to change

| File | Change |
|------|--------|
| `apps/backend/prisma/schema.prisma` | Remove `type` from Category; add `type TransactionType` to Transaction; rename enum |
| `apps/backend/prisma/migrations/` | Delete all migrations, run fresh `prisma migrate dev` |
| `packages/shared/src/categories.ts` | Remove `CategoryType`, remove `type` from `Category` and `CreateCategoryRequest` |
| `packages/shared/src/transactions.ts` | Add `TransactionType`, add `type` to `Transaction` and `CreateTransactionRequest` |
| `apps/backend/src/categories/dto/create-category.dto.ts` | Remove `type` field |
| `apps/backend/src/categories/dto/update-category.dto.ts` | Remove `type` field (explicit field, not derived from Create) |
| `apps/backend/src/categories/categories.repository.ts` | Remove `type` from `CreateCategoryData` |
| `apps/backend/src/categories/categories.service.ts` | Update duplicate message (remove "and type") |
| `apps/backend/src/transactions/dto/create-transaction.dto.ts` | Add `type` field with `@IsEnum` |
| `apps/backend/src/transactions/dto/update-transaction.dto.ts` | Add `type` to `UpdateTransactionRequest` |
| `apps/backend/src/transactions/transactions.repository.ts` | Add `type` to `CreateTransactionData`; update `aggregateByType` to filter by `transaction.type` instead of `category.type` |
| `apps/frontend/src/components/transaction-list.tsx` | Change `t.category.type` → `t.type` |

## `aggregateByType` query change

**Before:** filters via `category: { type: 'INCOME' }`  
**After:** filters via `type: 'INCOME'` directly on the transaction

## Out of scope

- Seeding / data migration (no production data; fresh DB reset)
- UI for creating/editing transactions (not built yet)
