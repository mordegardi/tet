# JWT-авторизация: модули Users и Auth

## Контекст

В backend-приложении сейчас нет авторизации — есть только заглушка `/health` и единственная Prisma-модель `Expense`. Чтобы можно было привязывать расходы к пользователям и защищать API, необходим базовый механизм аутентификации: регистрация, вход и выдача JWT.

Реализация делится на две части:
- **`UsersModule`** — хранение и работа с пользователями (`UsersRepository` + `UsersService`).
- **`AuthModule`** — регистрация/логин с выдачей JWT (passport-jwt стратегия + guard).

## Технологический выбор

| Решение | Выбор | Причина |
|---|---|---|
| JWT-библиотека | `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` | Нативная для NestJS, удобные guards |
| Хэширование пароля | `bcrypt` (cost = 10) | Стандарт Node.js, легко ставится под Windows |
| Стратегия токенов | Только access-token, TTL = 7 дней | Простота; refresh можно добавить позже |
| Транспорт токена | `Authorization: Bearer <token>` | Стандарт passport-jwt |
| ID пользователя | `String @id @default(cuid())` | Не угадывается, безопаснее autoincrement |

## Пакеты для установки

В `apps/backend/package.json`:

```json
"@nestjs/jwt": "^10.2.0",
"@nestjs/passport": "^10.1.2",
"passport": "^0.7.0",
"passport-jwt": "^4.0.1",
"bcrypt": "^5.1.1"
```

devDependencies:
```json
"@types/passport-jwt": "^4.0.1",
"@types/bcrypt": "^5.0.2"
```

## Изменения в Prisma

`apps/backend/prisma/schema.prisma` — добавить модель:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Затем:
```bash
pnpm --filter @expense-tracker/backend prisma:generate
pnpm --filter @expense-tracker/backend prisma:migrate    # назвать миграцию: add_user
```

## Общие контракты в `packages/shared`

**Новый файл `packages/shared/src/auth.ts`:**

```typescript
export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface JwtPayload {
  sub: string;     // user id
  email: string;
}
```

**`packages/shared/src/index.ts`:**
```typescript
export * from './auth';
```

## Структура backend

```
apps/backend/src/
├── users/
│   ├── users.module.ts
│   ├── users.service.ts
│   └── users.repository.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   │   ├── register.dto.ts
│   │   └── login.dto.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── guards/
│       └── jwt-auth.guard.ts
└── app.module.ts        ← подключить UsersModule, AuthModule
```

## UsersModule

### `users.repository.ts`
Тонкая обёртка над `PrismaService` — изолирует SQL-доступ от бизнес-логики.

Методы:
- `findById(id: string): Promise<User | null>`
- `findByEmail(email: string): Promise<User | null>`
- `create(data: { email: string; name: string; passwordHash: string }): Promise<User>`

Импорт типа `User` из `../generated/prisma/client` (не из `@prisma/client` — таково правило проекта).

### `users.service.ts`
Бизнес-логика над пользователями. На текущем этапе делегирует репозиторию:
- `findById(id)`
- `findByEmail(email)`
- `createUser({ email, name, passwordHash })` — пробрасывает в репозиторий; **не** занимается хэшированием (это ответственность `AuthService`).
- `toPublic(user: User): PublicUser` — маппинг в публичный тип без `passwordHash`.

### `users.module.ts`
```ts
@Module({
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
```

`PrismaModule` глобальный, отдельно импортировать не нужно.

## AuthModule

### `auth.module.ts`
```ts
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtAuthGuard],   // чтобы переиспользовать guard
})
export class AuthModule {}
```

### `auth.service.ts`
- `register(dto: RegisterDto): Promise<AuthResponse>` — проверяет, что email свободен (через `UsersService.findByEmail`), хэширует пароль (`bcrypt.hash(password, 10)`), создаёт пользователя, выдаёт токен. При занятом email — `ConflictException`.
- `login(dto: LoginDto): Promise<AuthResponse>` — находит пользователя по email, сверяет пароль (`bcrypt.compare`). При неуспехе — `UnauthorizedException` (одинаковый текст для несуществующего email и неверного пароля, чтобы не палить какие email зарегистрированы).
- `private issueToken(user: User): AuthResponse` — формирует `JwtPayload`, подписывает через `JwtService`, возвращает `{ accessToken, user: toPublic(user) }`.

### `auth.controller.ts`
```ts
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> { ... }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> { ... }
}
```
Декораторы `@ApiOperation`, `@ApiResponse` для Swagger.

### DTO
`register.dto.ts` — реализует `RegisterRequest`:
```ts
export class RegisterDto implements RegisterRequest {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(64) name!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
```

`login.dto.ts` — реализует `LoginRequest` (`@IsEmail`, `@IsString @MinLength(1)`).

### `strategies/jwt.strategy.ts`
```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<PublicUser> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return this.users.toPublic(user);
  }
}
```
Возвращённое значение попадёт в `req.user`.

### `guards/jwt-auth.guard.ts`
```ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```
В текущей задаче не используется — создаётся как фундамент для защиты будущих эндпоинтов (`/expenses`).

## Подключение в `AppModule`

`apps/backend/src/app.module.ts`:
```ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

## Конфигурация окружения

`apps/backend/.env.example` (и `.env`):
```
JWT_SECRET=change-me-in-production-please
JWT_EXPIRES_IN=7d
```

## Файлы для модификации/создания

**Изменить:**
- `apps/backend/prisma/schema.prisma` — добавить модель `User`
- `apps/backend/package.json` — новые зависимости
- `apps/backend/src/app.module.ts` — подключить `UsersModule`, `AuthModule`
- `apps/backend/.env.example`, `apps/backend/.env` — `JWT_SECRET`, `JWT_EXPIRES_IN`
- `packages/shared/src/index.ts` — re-export `auth.ts`

**Создать:**
- `packages/shared/src/auth.ts`
- `apps/backend/src/users/users.module.ts`
- `apps/backend/src/users/users.service.ts`
- `apps/backend/src/users/users.repository.ts`
- `apps/backend/src/auth/auth.module.ts`
- `apps/backend/src/auth/auth.controller.ts`
- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/auth/dto/register.dto.ts`
- `apps/backend/src/auth/dto/login.dto.ts`
- `apps/backend/src/auth/strategies/jwt.strategy.ts`
- `apps/backend/src/auth/guards/jwt-auth.guard.ts`

**Миграция:** `apps/backend/prisma/migrations/<timestamp>_add_user/migration.sql` (генерируется автоматически).

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
Проверить, что в `apps/backend/prisma/migrations/` появилась миграция `add_user` и таблица `User` создана.

### 3. Запуск и Swagger
```bash
pnpm --filter @expense-tracker/backend dev
```
Открыть `http://localhost:3001/api/docs` — должны появиться `POST /auth/register` и `POST /auth/login` с корректными схемами тел запроса/ответа.

### 4. Ручные сценарии (через Swagger UI или curl)

**Регистрация:**
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","name":"Alice","password":"superSecret1"}'
```
Ожидание: 201, тело `{ accessToken: "...", user: { id, email, name } }`.

**Повторная регистрация с тем же email:** 409 Conflict.

**Логин с правильным паролем:** 200, тело как у регистрации.

**Логин с неправильным паролем / несуществующим email:** 401 Unauthorized (одинаковое сообщение).

**Валидация:** `password` короче 8 символов / невалидный `email` / отсутствие `name` → 400 от глобального `ValidationPipe`.

### 5. Проверка JWT
Раскодировать `accessToken` (jwt.io) — payload должен содержать `sub` (id юзера) и `email`, `exp` ≈ now + 7 дней.

### 6. Проверка БД
```bash
pnpm --filter @expense-tracker/backend prisma:studio
```
В таблице `User` — созданный пользователь, в поле `passwordHash` — bcrypt-хэш (`$2b$10$...`), не plain text.

## Что осталось за рамками этого плана

- `JwtAuthGuard` создаётся, но не применяется ни к одному эндпоинту (войдёт в задачу про модуль `expenses`).
- Refresh-токены — отложены.
- Роли/права (RBAC) — отложены.
- Подтверждение email, сброс пароля — отложены.
- Unit/e2e тесты — не входят в первичную реализацию (если потребуется — отдельный план).
