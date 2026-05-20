# Схема базы данных

БД: **PostgreSQL 16**  
ORM: **Prisma v7**  
Схема: `apps/backend/prisma/schema.prisma`  
Конфиг: `apps/backend/prisma.config.ts` (содержит `DATABASE_URL`)

---

## Диаграмма связей

```
User
 ├─── Category[] (1:N)
 └─── Transaction[] (1:N)

Category
 └─── Transaction[] (1:N)

Transaction
 ├─── User (N:1)
 └─── Category (N:1)
```

Все данные изолированы по пользователю: каждая категория и транзакция имеют `userId`, запросы всегда фильтруются по нему.

---

## Модель User

Хранит учётные данные пользователя.

| Поле | Тип DB | Prisma тип | Назначение |
|------|--------|-----------|-----------|
| `id` | `TEXT` (CUID) | `String` | Первичный ключ, генерируется как CUID |
| `email` | `TEXT` | `String` | Уникальный email, используется для входа |
| `name` | `TEXT` | `String` | Отображаемое имя пользователя (2–64 символа) |
| `passwordHash` | `TEXT` | `String` | bcrypt-хэш пароля (cost=10), **никогда не возвращается наружу** |
| `createdAt` | `TIMESTAMP` | `DateTime` | Время создания записи, auto-set |
| `updatedAt` | `TIMESTAMP` | `DateTime` | Время последнего обновления, auto-update |

**Уникальные ограничения:**
- `email` — уникальный (один аккаунт на email)

**Связи:**
- `categories` — все категории пользователя (1:N)
- `transactions` — все транзакции пользователя (1:N)

**Примечание:** При регистрации `passwordHash` хешируется через `bcrypt.hash(password, 10)`. В API возвращается только `PublicUser` (`{ id, email, name, createdAt, updatedAt }`).

---

## Модель Category

Пользовательская категория для классификации транзакций.

| Поле | Тип DB | Prisma тип | Назначение |
|------|--------|-----------|-----------|
| `id` | `TEXT` (CUID) | `String` | Первичный ключ, CUID |
| `name` | `TEXT` | `String` | Название категории (1–64 символа) |
| `color` | `TEXT` | `String` | HEX-цвет для UI, формат `#RRGGBB` (например, `#FF6B6B`) |
| `icon` | `TEXT` | `String` | Emoji-иконка (1–8 символов, например `🍔`) |
| `userId` | `TEXT` | `String` | FK → `User.id` — владелец категории |
| `createdAt` | `TIMESTAMP` | `DateTime` | Время создания, auto-set |
| `updatedAt` | `TIMESTAMP` | `DateTime` | Время обновления, auto-update |

**Уникальные ограничения:**
- `(userId, name)` — составной уникальный ключ: у одного пользователя не может быть двух категорий с одинаковым именем

**Связи:**
- `user` — владелец (N:1)
- `transactions` — транзакции в этой категории (1:N)

**Бизнес-правила:**
- Нельзя удалить категорию, если у неё есть транзакции (`409 Conflict`)
- `color` валидируется регулярным выражением `/^#[0-9A-Fa-f]{6}$/`

---

## Модель Transaction

Финансовая операция пользователя.

| Поле | Тип DB | Prisma тип | Назначение |
|------|--------|-----------|-----------|
| `id` | `TEXT` (CUID) | `String` | Первичный ключ, CUID |
| `amount` | `DECIMAL(12,2)` | `Decimal` | Сумма операции (> 0, макс. 2 знака после запятой). В API сериализуется как строка |
| `description` | `TEXT` (nullable) | `String?` | Опциональный комментарий (макс. 500 символов). `null` если не указан |
| `date` | `TIMESTAMP` | `DateTime` | Дата совершения операции (ISO 8601 на входе, конвертируется в `Date`) |
| `type` | `ENUM` | `TransactionType` | Тип операции: `INCOME` или `EXPENSE` |
| `userId` | `TEXT` | `String` | FK → `User.id` — владелец транзакции |
| `categoryId` | `TEXT` | `String` | FK → `Category.id` — категория транзакции |
| `createdAt` | `TIMESTAMP` | `DateTime` | Время создания записи, auto-set |
| `updatedAt` | `TIMESTAMP` | `DateTime` | Время последнего обновления, auto-update |

**Enum `TransactionType`:**
- `INCOME` — доход
- `EXPENSE` — расход

**Связи:**
- `user` — владелец (N:1)
- `category` — категория (N:1, обязательная)

**Бизнес-правила:**
- `categoryId` должен указывать на категорию, принадлежащую тому же пользователю
- `amount` хранится в `DECIMAL(12,2)` для точного представления денежных сумм без погрешностей float
- `date` — бизнес-дата транзакции (когда произошла), не путать с `createdAt` (когда создана запись)

---

## Инварианты изоляции данных

Все репозитории используют `findFirst({ where: { id, userId } })` вместо `findUnique`, чтобы гарантировать принадлежность ресурса текущему пользователю. Это предотвращает утечку данных между аккаунтами.

---

## Настройка Prisma

```typescript
// apps/backend/prisma.config.ts
import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

```typescript
// PrismaService (упрощённо)
import { PrismaPg } from '@prisma/adapter-pg';

class PrismaService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }
}
```

**Команды:**
```bash
pnpm --filter @expense-tracker/backend prisma:generate   # регенерировать клиент
pnpm --filter @expense-tracker/backend prisma:migrate    # создать/применить миграции (dev)
pnpm --filter @expense-tracker/backend prisma:studio     # открыть Prisma Studio
```
