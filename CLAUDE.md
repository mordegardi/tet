# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **pnpm workspaces + Turborepo** for monorepo orchestration
- **Next.js 16** (App Router) + TypeScript + **Tailwind CSS** — `apps/frontend`
- **NestJS** + **Prisma** + **@nestjs/swagger** — `apps/backend`
- **PostgreSQL 16** via Docker Compose
- **Biome** (replaces ESLint + Prettier) + **Husky** + **lint-staged**
- Node `>=20`, package manager pinned to `pnpm@9.12.0` in root `package.json`

## Commands

All commands run from the repo root unless noted.

```bash
# Install / bootstrap
pnpm install

# Database (Docker)
pnpm db:up           # start PostgreSQL on :5432
pnpm db:down         # stop PostgreSQL

# Dev (runs both apps in parallel via Turbo)
pnpm dev             # frontend :3000, backend :3001

# Filter to a single app
pnpm --filter @expense-tracker/frontend dev
pnpm --filter @expense-tracker/backend dev

# Build / lint / typecheck (whole monorepo)
pnpm build
pnpm lint            # biome check via turbo
pnpm format          # biome format --write .
pnpm typecheck

# Prisma (backend only)
pnpm --filter @expense-tracker/backend prisma:generate
pnpm --filter @expense-tracker/backend prisma:migrate    # dev migration
pnpm --filter @expense-tracker/backend prisma:deploy     # prod migration
pnpm --filter @expense-tracker/backend prisma:studio

# Tests (backend Jest)
pnpm --filter @expense-tracker/backend test
pnpm --filter @expense-tracker/backend test -- path/to/file.spec.ts   # single file
pnpm --filter @expense-tracker/backend test -- -t "test name"         # single test
pnpm --filter @expense-tracker/backend test:e2e
```

After `pnpm dev`: frontend `http://localhost:3000`, backend `http://localhost:3001`, Swagger UI `http://localhost:3001/api/docs`.

## Architecture

### Workspace layout

- `apps/frontend` and `apps/backend` are deployable apps.
- `packages/shared` is consumed via `workspace:*` as `@expense-tracker/shared`. It exports TypeScript sources directly (no build step) — both apps import from `packages/shared/src/index.ts` through TS path aliases declared in `tsconfig.base.json` and re-declared in each app's `tsconfig.json`. Next.js also lists it in `transpilePackages` so RSC/SSR works correctly. **API contracts (DTOs, request/response types, validation schemas) belong here** so the frontend and backend cannot drift.

### Backend (NestJS)

- Bootstrap in `apps/backend/src/main.ts`: registers a global `ValidationPipe` (whitelist + transform + forbidNonWhitelisted) and mounts Swagger at `/api/docs`. `PORT` comes from `ConfigService` (default `3001`).
- `AppModule` imports `ConfigModule.forRoot({ isGlobal: true })` and a global `PrismaModule`.
- `PrismaService` extends `PrismaClient` and uses `OnModuleInit`/`OnModuleDestroy` to manage the connection lifecycle — inject it anywhere instead of instantiating a new client.
- **Prisma v7** — uses the new `prisma-client` generator (not `prisma-client-js`). The generated client is output to `apps/backend/src/generated/prisma`; import from `../generated/prisma/client` (not `@prisma/client`). The datasource `url` is no longer in `schema.prisma` — it lives in `apps/backend/prisma.config.ts` via `defineConfig`. Direct PostgreSQL connections require `@prisma/adapter-pg`: `PrismaService` instantiates a `PrismaPg` adapter and passes it to `super({ adapter })`. Migrations are not yet initialised.
- Validation uses `class-validator` + `class-transformer` decorators on DTOs. Swagger annotations (`@ApiTags`, `@ApiProperty`, etc.) drive the OpenAPI document.

### Frontend (Next.js 16, App Router)

- Routes live under `apps/frontend/src/app/`. `layout.tsx` is the root layout and imports `globals.css`.
- **Tailwind CSS v4** with CSS-first config: `globals.css` is just `@import "tailwindcss";`. There is no `tailwind.config.ts` — customise the design system via `@theme { ... }` in CSS instead. PostCSS uses the `@tailwindcss/postcss` plugin (not `tailwindcss` + `autoprefixer` like in v3).
- Content detection in v4 is automatic via the PostCSS plugin scanning the project; no `content:` glob to maintain.
- `next.config.ts` enables `reactStrictMode` and `transpilePackages: ['@expense-tracker/shared']`.
- Backend URL is read from `NEXT_PUBLIC_API_URL` (`.env.local`); default `http://localhost:3001`.

### TypeScript config

- `tsconfig.base.json` sets `strict: true` and `noUncheckedIndexedAccess: true` for the workspace. The backend's `tsconfig.json` overrides `noUncheckedIndexedAccess` to `false` (NestJS DI/decorator patterns clash with it) and switches `module`/`moduleResolution` to CommonJS/Node + enables `experimentalDecorators` and `emitDecoratorMetadata`. Keep decorator-heavy code on the backend side of that boundary.

### Turborepo pipeline (`turbo.json`)

- `dev` is `persistent` and uncached.
- `build`, `lint`, `typecheck` depend on `^build` so workspace deps build first when needed.
- Build outputs cached: `.next/**` (excluding `.next/cache`) and `dist/**`.

### Biome

- Single source of truth for lint + format — do not add ESLint or Prettier configs.
- Config: 2-space indent, 100-col width, single quotes (JSX double), semicolons always, trailing commas everywhere, `organizeImports` enabled.
- `lint-staged` runs `biome check --write` on staged `*.{ts,tsx,js,jsx,json,md}` via the Husky pre-commit hook.

## Conventions

- **Shared contracts go in `packages/shared`.** When adding a new endpoint, define the request/response types there first, then import them into both the Nest DTO/controller and the Next.js fetcher.
- **Filter, don't `cd`.** Run package-scoped commands with `pnpm --filter @expense-tracker/<name> <script>` from the repo root rather than changing directories.
- **Env files are per-app.** Root `.env` is consumed by `docker-compose.yml`. Backend reads `apps/backend/.env`. Frontend reads `apps/frontend/.env.local`. Each has a matching `.env.example`.
- **Don't bypass the validation pipe.** Backend controllers should accept DTO classes with `class-validator` decorators; the global `ValidationPipe` will reject anything not on the whitelist.
