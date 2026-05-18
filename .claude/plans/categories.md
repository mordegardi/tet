# Categories: модель и CRUD-эндпоинты

## Контекст

В приложении уже есть аутентификация (JWT) и базовая инфраструктура (PrismaService, ValidationPipe, Swagger). Сейчас расходы не имеют категорий — нет ни модели `Category`, ни способа сгруппировать траты. Чтобы пользователь мог классифицировать свои расходы/доходы (еда, транспорт, зарплата и т.п.), нужна полноценная сущность категорий.

Каждая категория принадлежит конкретному пользователю (изолированные пространства имён), имеет визуальные атрибуты (цвет, эмодзи-иконка), тип (доход/расход) и набор служебных полей (`id`, `createdAt`, `updatedAt`). На уровне API — стандартный REST CRUD под `JwtAuthGuard`.

Реализация идиоматично продолжает паттерны `UsersModule` / `AuthModule`: трёхслойная архитектура (controller → service → repository), DTO с `class-validator` + `@ApiProperty`, общие контракты в `packages/shared`. Дополнительно вводится переиспользуемый `@CurrentUser()` декоратор — он понадобится и в будущих модулях (`expenses`).

## Технологический выбор

| Решение | Выбор | Причина |
|---|---|---|
| ID | `String @id @default(cuid())` | Согласовано с `User`, безопаснее autoincrement |
| Хранение цвета | `String` (HEX `#RRGGBB`) | Простой контракт, лёгкая валидация regex'ом |
| Хранение иконки | `String` (один эмодзи) | Регулирующая длину/`@IsString` валидация |
| Тип категории | Prisma `enum CategoryType { INCOME, EXPENSE }` | Типобезопасно на бэкенде и фронте через shared |
| Уникальность | `@@unique([userId, name, type])` | Одно имя в рамках юзера+типа; даёт возможность завести «Транспорт» и в доходах, и в расходах |
| Удаление | Hard delete | `Expense` ещё не связан — пока без `onDelete` каскадов. Каскад добавится при появлении `Expense.categoryId` отдельным планом |
| Извлечение userId | Новый `@CurrentUser()` декоратор | Чисто, переиспользуемо |

## Изменения в Prisma

`apps/backend/prisma/schema.prisma`:

```prisma
enum CategoryType {
  INCOME
  EXPENSE
}

model Category {
  id        String       @id @default(cuid())
  name      String
  color     String       // HEX, например "#FF6B6B"
  icon      String       // эмодзи, например "🍔"
  type      CategoryType

  userId    String
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@unique([userId, name, type])
  @@index([userId])
}
```

И в существующую модель `User` добавляется обратная связь:
```prisma
model User {
  // ... существующие поля
  categories Category[]
}
```

Миграция:
```bash
pnpm --filter @expense-tracker/backend prisma:generate
pnpm --filter @expense-tracker/backend prisma:migrate   # имя: add_category
```

## Общие контракты в `packages/shared`

**Новый файл `packages/shared/src/categories.ts`:**

```typescript
export type CategoryType = 'INCOME' | 'EXPENSE';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
}

export interface CreateCategoryRequest {
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
}

// PATCH-семантика: все поля опциональны.
export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;
```

**`packages/shared/src/index.ts`** — добавить:
```typescript
export * from './categories';
```

## Структура backend

```
apps/backend/src/
├── auth/
│   └── decorators/
│       └── current-user.decorator.ts   ← НОВЫЙ
├── categories/                          ← НОВЫЙ МОДУЛЬ
│   ├── categories.module.ts
│   ├── categories.controller.ts
│   ├── categories.service.ts
│   ├── categories.repository.ts
│   └── dto/
│       ├── create-category.dto.ts
│       └── update-category.dto.ts
└── app.module.ts                        ← подключить CategoriesModule
```

## `@CurrentUser()` декоратор

`apps/backend/src/auth/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PublicUser } from '@expense-tracker/shared';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as PublicUser;
  },
);
```

`req.user` уже наполняется `JwtStrategy.validate()` объектом `PublicUser` (см. `apps/backend/src/auth/strategies/jwt.strategy.ts`).

Опционально экспортнуть из `auth.module.ts` — но декораторы импортируются напрямую по пути, ре-экспорт через модуль не нужен.

## CategoriesModule

### `categories.repository.ts`
Тонкая обёртка над `PrismaService`. Все методы фильтруют по `userId` для изоляции данных.

Импорт типа `Category` из `../generated/prisma/client` (правило проекта).

Методы:
- `findAllByUser(userId: string): Promise<Category[]>`
- `findByIdForUser(id: string, userId: string): Promise<Category | null>`
- `create(data: { userId: string; name: string; color: string; icon: string; type: CategoryType }): Promise<Category>`
- `update(id: string, userId: string, data: Partial<...>): Promise<Category>` — использует `prisma.category.update({ where: { id, userId } as any })` через `updateMany`-проверку или предварительный `findByIdForUser` (см. ниже)
- `delete(id: string, userId: string): Promise<void>`

> Prisma запрещает не-уникальные поля в `where` у `update`/`delete`. Поэтому делаем безопасно: в **service** сначала `findByIdForUser(id, userId)` → `NotFoundException`, затем `prisma.category.update({ where: { id }, data })`. Альтернатива — `updateMany` + проверка `count`. Подходит первый вариант.

### `categories.service.ts`
Бизнес-логика. Принимает `userId` параметром (не достаёт сам — это ответственность контроллера/декоратора).

Методы:
- `findAll(userId)` → `Category[]`
- `findOne(id, userId)` → `Category` (или `NotFoundException`)
- `create(userId, dto)` → ловит `P2002` (unique constraint) → `ConflictException` с сообщением `"Category with this name and type already exists"`
- `update(id, userId, dto)` → проверяет существование через `findOne`, потом `repository.update`; на `P2002` — `ConflictException`
- `remove(id, userId)` → проверяет существование, потом `repository.delete`

> `Prisma.PrismaClientKnownRequestError` импортируется из `../generated/prisma/client`. Код `P2002` — нарушение `@@unique`.

### `categories.controller.ts`

```typescript
@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: PublicUser): Promise<Category[]> { ... }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: PublicUser): Promise<Category> { ... }

  @Post()
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: PublicUser): Promise<Category> { ... }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: PublicUser,
  ): Promise<Category> { ... }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: PublicUser): Promise<void> { ... }
}
```

Каждому методу — `@ApiOperation`, `@ApiResponse` (200/201/204 + 401/404/409 где применимо). На контроллере — `@ApiBearerAuth()`, чтобы Swagger UI давал воткнуть JWT.

Для Swagger включить bearer в `main.ts` через `DocumentBuilder.addBearerAuth()` — если ещё не сделано, см. секцию ниже.

### DTO

`create-category.dto.ts`:
```typescript
export class CreateCategoryDto implements CreateCategoryRequest {
  @ApiProperty({ example: 'Еда' })
  @IsString() @MinLength(1) @MaxLength(64)
  name!: string;

  @ApiProperty({ example: '#FF6B6B' })
  @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be HEX like #RRGGBB' })
  color!: string;

  @ApiProperty({ example: '🍔' })
  @IsString() @MinLength(1) @MaxLength(8)
  icon!: string;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'] })
  @IsEnum({ INCOME: 'INCOME', EXPENSE: 'EXPENSE' })
  type!: CategoryType;
}
```

`update-category.dto.ts` — повторяет, но все поля помечены `@IsOptional()` (Nest рекомендует не использовать `PartialType` из-за смешения с DTO-наследованием в monorepo с типами, но это допустимо; для простоты — продублировать с `@IsOptional`).

### `categories.module.ts`
```typescript
@Module({
  imports: [AuthModule],   // нужен JwtAuthGuard
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesService],
})
export class CategoriesModule {}
```

`PrismaModule` глобальный — отдельно импортировать не нужно. `AuthModule` уже экспортирует `JwtAuthGuard` (см. `apps/backend/src/auth/auth.module.ts:exports`).

## Подключение в `AppModule`

`apps/backend/src/app.module.ts` — добавить `CategoriesModule` в `imports`.

## Swagger bearer auth (если ещё не настроено)

В `apps/backend/src/main.ts` рядом с настройкой `SwaggerModule`:
```typescript
const config = new DocumentBuilder()
  // ... .setTitle(), .setDescription() ...
  .addBearerAuth()
  .build();
```
Это даёт кнопку «Authorize» в `/api/docs` для ручного тестирования защищённых эндпоинтов.

## Файлы для модификации/создания

**Изменить:**
- `apps/backend/prisma/schema.prisma` — `enum CategoryType`, модель `Category`, обратная связь в `User`
- `apps/backend/src/app.module.ts` — подключить `CategoriesModule`
- `apps/backend/src/main.ts` — `.addBearerAuth()` в DocumentBuilder, если ещё не добавлено
- `packages/shared/src/index.ts` — re-export `./categories`

**Создать:**
- `packages/shared/src/categories.ts`
- `apps/backend/src/auth/decorators/current-user.decorator.ts`
- `apps/backend/src/categories/categories.module.ts`
- `apps/backend/src/categories/categories.controller.ts`
- `apps/backend/src/categories/categories.service.ts`
- `apps/backend/src/categories/categories.repository.ts`
- `apps/backend/src/categories/dto/create-category.dto.ts`
- `apps/backend/src/categories/dto/update-category.dto.ts`

**Миграция:** `apps/backend/prisma/migrations/<timestamp>_add_category/migration.sql` (генерируется автоматически).

## Верификация

### 1. Сборка и типы
```bash
pnpm --filter @expense-tracker/backend prisma:generate
pnpm typecheck
pnpm lint
```

### 2. Миграция
```bash
pnpm db:up
pnpm --filter @expense-tracker/backend prisma:migrate
```
Появится миграция `add_category`, таблица `Category` и enum `CategoryType` в БД.

### 3. Запуск и Swagger
```bash
pnpm --filter @expense-tracker/backend dev
```
В `http://localhost:3001/api/docs`:
- появилась группа `categories` с пятью эндпоинтами
- кнопка «Authorize» принимает Bearer JWT

### 4. Ручные сценарии (через Swagger или curl)

Зарегистрировать/залогинить юзера → получить `accessToken` → передавать в `Authorization: Bearer <token>`.

**Создание:** `POST /categories` `{ "name": "Еда", "color": "#FF6B6B", "icon": "🍔", "type": "EXPENSE" }` → 201 + объект `Category`.

**Дубль:** повторный POST с теми же `name`+`type` → 409 Conflict.

**Валидация:** `color: "red"` → 400; пустой `name` → 400; неизвестный `type` → 400; лишнее поле → 400 (forbidNonWhitelisted).

**Список:** `GET /categories` → 200, массив только своих категорий.

**Изоляция:** под токеном другого юзера тот же `GET /categories` возвращает только его собственные — не видит чужие.

**Получение по id:** `GET /categories/{id}` → 200; чужой id → 404 (не 403, чтобы не палить существование).

**Изменение:** `PATCH /categories/{id}` `{ "color": "#00FF00" }` → 200 с обновлённым объектом. Чужой id → 404.

**Удаление:** `DELETE /categories/{id}` → 204 No Content. Повторное удаление → 404.

**Без токена:** любой запрос → 401 Unauthorized.

### 5. Проверка БД
```bash
pnpm --filter @expense-tracker/backend prisma:studio
```
В таблице `Category` — созданные записи с корректным `userId`, `type`, `color`, `icon`, временными метками.

## Что осталось за рамками этого плана

- Связь `Expense.categoryId` и каскадное удаление — войдёт в задачу про модуль `expenses` (там же решится семантика удаления категории, на которую ссылаются траты).
- Дефолтные/предустановленные категории при регистрации — отложено.
- Сортировка/пагинация в `GET /categories` — не нужно на текущем объёме.
- Unit/e2e тесты — отдельный план, как было решено по jwt-auth.
- Фронтенд-интеграция (страница управления категориями) — отдельная задача.
