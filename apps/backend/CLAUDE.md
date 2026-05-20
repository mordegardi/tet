# Backend (NestJS)

## Bootstrap

- `apps/backend/src/main.ts`: глобальный `ValidationPipe` (`whitelist + transform + forbidNonWhitelisted`), Swagger смонтирован на `/api/docs`, CORS пускает `FRONTEND_URL` (default `http://localhost:3000`) с `credentials: true`. `PORT` берётся через `ConfigService` (default `3001`).
- `AppModule` подключает `ConfigModule.forRoot({ isGlobal: true })`, глобальный `PrismaModule`, `ThrottlerModule` (`60s / 120 req` по умолчанию, регистрирует `ThrottlerGuard` через `APP_GUARD`), а также фич-модули `Users`, `Auth`, `Categories`, `Transactions`.
- `nest-cli.json` использует `entryFile: "apps/backend/src/main"` — путь относителен корню монорепо, а не папке бэкенда. Не «исправлять» на `src/main`, иначе `nest build` сломается.

## Prisma v7

- Новый генератор `prisma-client` (не `prisma-client-js`). Клиент генерируется в `apps/backend/src/generated/prisma`; импортировать из `../generated/prisma/client` (НЕ из `@prisma/client`). Дополнительно есть зеркало в `apps/backend/generated/prisma` — игнорируется в рантайме, но коммитится.
- В `schema.prisma` нет `url` у datasource — он живёт в `apps/backend/prisma.config.ts` через `defineConfig` и читает `DATABASE_URL` из `.env`.
- Прямые подключения к Postgres требуют адаптер: `PrismaService` создаёт `new PrismaPg({ connectionString: process.env.DATABASE_URL })` и передаёт его в `super({ adapter })`.
- `PrismaService` управляет соединением через `OnModuleInit`/`OnModuleDestroy` — **не создавать `new PrismaClient()` руками**, инжектить сервис.
- Миграции пока не инициализированы; для разработки достаточно `prisma:generate` + `db push` (если потребуется) — добавлять `prisma:migrate` через root-команду.

## Структура модуля (Controller → Service → Repository)

Каждый ресурс следует трёхуровневой схеме:

- **Controller** — только HTTP-слой: декораторы `@ApiTags`, `@ApiBearerAuth`, `@UseGuards(JwtAuthGuard)`, DTO в `@Body`/`@Query`, извлечение пользователя через `@CurrentUser()`. Возвращать результат сервиса напрямую (`return this.service.findAll(user.id)`).
- **Service** — бизнес-логика, проверка прав (всё, что относится к пользователю, должно фильтроваться по `userId`), маппинг Prisma-ошибок в `HttpException` (`P2002 → ConflictException`, `P2003 → ConflictException 'cannot delete with FK'`). Не работать с `PrismaService` напрямую.
- **Repository** — единственный слой, который знает про Prisma. Возвращает «сырые» сущности из `generated/prisma/client`. Все запросы скоупятся по `userId` (`findFirst({ where: { id, userId } })`, не `findUnique`).

## DTO и валидация

- DTO лежат в `<module>/dto/*.dto.ts`, имплементируют типы из `@expense-tracker/shared` (`implements RegisterRequest`, `implements CreateTransactionRequest` и т.п.) — это страхует от дрейфа контракта.
- Декораторы: `class-validator` для правил + `@ApiProperty`/`@ApiPropertyOptional` для Swagger. Глобальный `ValidationPipe` режет неизвестные поля (`forbidNonWhitelisted`) и трансформирует примитивы (`@Type(() => Number)` для `query`/`body`).
- Денежные суммы — `Decimal(12, 2)` на стороне БД; на входе валидировать через `@IsNumber({ maxDecimalPlaces: 2 })` + `@Min(0.01)`.
- Даты приходят как ISO-строки (`@IsDateString()`), в репозитории конвертировать через `new Date(...)`.

## Auth (JWT + Passport)

- `AuthModule`: `JwtModule.registerAsync` тянет `JWT_SECRET` и `JWT_EXPIRES_IN` (default `7d`) из `ConfigService`. `getOrThrow` для секрета — старт упадёт, если переменной нет.
- Пароли хешируются `bcrypt.hash(pw, 10)` в `AuthService`. Никогда не возвращать `passwordHash` наружу — использовать `UsersService.toPublic(user)` для маппинга в `PublicUser`.
- `JwtStrategy.validate` принимает `JwtPayload` (`{ sub, email }` из `@expense-tracker/shared`), резолвит юзера в БД (если удалён → `UnauthorizedException`) и кладёт `PublicUser` в `req.user`.
- `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()` ставится на контроллерах ресурсов (не глобально, чтобы `/auth/*` оставались открытыми).
- Параметр-декоратор `@CurrentUser()` возвращает `PublicUser` из `req.user` — единственный санкционированный способ достать текущего пользователя в хэндлере.

## Rate limiting

- `ThrottlerGuard` подключён глобально (`APP_GUARD`). Дефолт: `120 req / 60s` на IP.
- На чувствительных эндпоинтах (`/auth/*`) перекрывать через `@Throttle({ default: { ttl: 60_000, limit: 10 } })` на уровне контроллера.

## Shared contracts

- DTO-классы бэкенда `implements <Request>` из `@expense-tracker/shared`. Возвращаемые типы (`AuthResponse`, `PublicUser`, `Transaction`, `Category` и т.п.) тоже импортятся оттуда — фронт получает ровно те же типы.
- При добавлении нового эндпоинта: сначала описать request/response в `packages/shared/src/*.ts`, потом подключить в DTO/Controller бэкенда и в `apps/frontend/src/lib/api.ts` на фронте.

## TypeScript

- В `apps/backend/tsconfig.json` отключён `noUncheckedIndexedAccess` (декораторы NestJS с ним конфликтуют) и включены `experimentalDecorators` + `emitDecoratorMetadata`. `module/moduleResolution` — CommonJS/Node. Держать декораторный код на бэкенде.

## ENV

`apps/backend/.env` (есть `.env.example`):

- `DATABASE_URL` — Postgres connection string (Docker Compose поднимает на `:5432`).
- `JWT_SECRET` — обязателен, иначе `getOrThrow` уронит старт.
- `JWT_EXPIRES_IN` — default `7d`.
- `FRONTEND_URL` — для CORS, default `http://localhost:3000`.
- `PORT` — default `3001`.

## Тесты

- Jest конфиг в `package.json`, `rootDir: src`, паттерн `*.spec.ts`. e2e: `test:e2e` с `test/jest-e2e.json`. Тесты пока минимальны — при добавлении следовать паттерну `*.spec.ts` рядом с тестируемым файлом.

## Актуализация документации

После изменения любых методов надо актуализировать или добавить JSDoc. А для DTO и контроллеров добавить соответствующие декораторы Swagger.
