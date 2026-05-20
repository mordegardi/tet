# Code Review Guidelines

## Процесс

- Ревью — диалог, а не приговор. Несогласие оформлять аргументом, а не директивой.
- Блокирующие замечания (Must fix) помечать явно; остальное — suggestions.
- Не комментировать стиль: Biome проверяет его автоматически в pre-commit.
- PR должен содержать одну связную единицу изменений — не смешивать фичу с рефактором.

---

## Общие правила

- [ ] Нет кода, который не делает ничего или не вызывается — удалять, не комментировать.
- [ ] Нет `console.log`, `debugger`, временных закомментированных блоков.
- [ ] Нет `any` — ни явного, ни неявного через `as unknown as T`.
- [ ] Нет обратной совместимости ради неё самой: если старое не используется — удалить.
- [ ] Коммиты следуют conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).

---

## Shared contracts (`packages/shared`)

- [ ] Новый эндпоинт — тип запроса и ответа описан в `packages/shared/src/*.ts` **до** реализации в backend и frontend.
- [ ] Backend DTO `implements <Request>` из shared. Frontend fetcher использует те же типы.
- [ ] Если тип изменился в shared — оба конца обновлены и собираются без ошибок (`pnpm typecheck`).
- [ ] Никаких типов из `apps/backend/...` во фронте и наоборот — только через shared.

---

## Backend (NestJS)

### Структура модуля

- [ ] Три слоя соблюдены: Controller → Service → Repository. Никаких PrismaService-вызовов в контроллере или сервисе напрямую.
- [ ] Новый ресурс оформлен отдельным модулем (`*.module.ts`) и подключён в `AppModule`.
- [ ] Controller только делегирует — никакой бизнес-логики, никакой работы с Prisma.

### Auth и доступ к данным

- [ ] Защищённые эндпоинты: `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()` на контроллере или хэндлере.
- [ ] `userId` берётся **только** из `@CurrentUser()`, не из `@Body()` / `@Param()`.
- [ ] Запросы в репозитории фильтруются по `userId` — `findFirst({ where: { id, userId } })`, не `findUnique({ where: { id } })`.
- [ ] `passwordHash` никогда не возвращается — только через `UsersService.toPublic(user)`.

### DTO и валидация

- [ ] Каждое поле DTO покрыто `class-validator` декоратором и `@ApiProperty`.
- [ ] Числовые поля из `@Query` имеют `@Type(() => Number)`.
- [ ] Денежные суммы: `@IsNumber({ maxDecimalPlaces: 2 })` + `@Min(0.01)`.
- [ ] Даты принимаются как ISO-строки (`@IsDateString()`); конвертация в `Date` — в репозитории.
- [ ] Нет DTO без whitelist — `ValidationPipe` с `forbidNonWhitelisted` уже глобальный, лишние поля будут отвергнуты.

### Prisma и ошибки

- [ ] Prisma-ошибки маппятся в HTTP-исключения: `P2002 → ConflictException`, `P2003 → ConflictException ("cannot delete with FK")`. Не пробрасывать Prisma-ошибки наружу.
- [ ] `PrismaService` инжектируется, не инстанцируется напрямую.
- [ ] Новые модели/поля добавлены через `prisma migrate dev`, не через прямые SQL-запросы.

### Rate limiting

- [ ] Чувствительные эндпоинты (auth, смена пароля и т.п.) переопределяют лимит через `@Throttle({ default: { ttl: 60_000, limit: 10 } })`.

### Swagger

- [ ] Все `@ApiResponse` описаны для каждого возможного статуса (включая `401`, `404`, `409`).
- [ ] Новый тег добавлен через `@ApiTags(...)` на контроллере.

---

## Frontend (Next.js)

### Роутинг и layout

- [ ] Защищённые страницы добавлены в `app/(authenticated)/` — отдельный `<RequireAuth>` не нужен.
- [ ] Публичные страницы (`/login`, `/register`) — вне group `(authenticated)`.
- [ ] Server Component по умолчанию; `'use client'` только там, где нужны хуки или браузерные API.

### Auth

- [ ] Токен и пользователь читаются только через `authStorage` или `useAuth()`, не через `localStorage` напрямую.
- [ ] После успешного логина/регистрации вызывается `setSession(res)` (обновляет контекст + storage).
- [ ] `isLoading` учитывается перед рендером защищённого контента — избегать флика.

### API клиент

- [ ] Новые вызовы добавлены в `src/lib/api.ts`; типы запроса/ответа из `@expense-tracker/shared`.
- [ ] Приватные эндпоинты используют `authenticatedRequest`, а не `request`.
- [ ] Ошибки API перехватываются через `instanceof ApiError`; `err.message` показывается в `toast.error(...)`.
- [ ] Никаких `fetch(...)` вне `api.ts`.

### UI и компоненты

- [ ] Формы строятся через `react-hook-form` + `zodResolver` + shadcn `<Form>`/`<FormField>` — не `<input>` напрямую.
- [ ] Уведомления — только через `sonner` (`toast.success` / `toast.error`). Не подключать другой `<Toaster>`.
- [ ] Иконки — только `lucide-react`. Не смешивать icon-пакеты.
- [ ] Нет `tailwind.config.ts` — кастомизация темы только через `@theme` в `globals.css`.
- [ ] Новые CSS-переменные shadcn добавляются в оба блока: `:root` и `.dark`.

---

## TypeScript

- [ ] `pnpm typecheck` проходит без ошибок.
- [ ] Нет `@ts-ignore` / `@ts-expect-error` без объяснения почему.
- [ ] Декораторный код (NestJS DI) остаётся в `apps/backend` — там отключён `noUncheckedIndexedAccess`.
- [ ] Frontend соблюдает `noUncheckedIndexedAccess: true` — обращения к массивам через опциональную цепочку или проверку.

---

## Безопасность

- [ ] Нет секретов, токенов или паролей в коде или логах.
- [ ] `JWT_SECRET` подключён через `configService.getOrThrow(...)` — отсутствие переменной роняет старт.
- [ ] Пароли хешируются через `bcrypt` перед сохранением. Никакого plain text.
- [ ] CORS ограничен `FRONTEND_URL` — не использовать `origin: '*'` в продакшне.
- [ ] Все данные от пользователей проходят через DTO + `ValidationPipe`, не используются напрямую в Prisma-запросах.

---

## Форматирование и линтинг

- [ ] `pnpm lint` (`biome check`) проходит без ошибок — это гарантирует pre-commit хук, но стоит проверить в CI.
- [ ] Нет ESLint/Prettier конфигов — Biome единственный linter/formatter.
- [ ] Стиль импортов выровнен: `organizeImports` включён в Biome и применяется автоматически.

---

## Пропускать

1. Сгенерированные файлы миграций
2. Изменения в *.lock файлах
