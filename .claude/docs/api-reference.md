# Детальное описание API

Base URL: `http://localhost:3001`  
Swagger UI: `http://localhost:3001/api/docs`

Все эндпоинты (кроме `/auth/*`) требуют заголовок:
```
Authorization: Bearer <jwt_token>
```

---

## Auth

### POST /auth/register

Регистрация нового пользователя.

**Rate limit:** 10 req / 60s

**Request body:**
```json
{
  "email": "user@example.com",
  "name": "Alice",
  "password": "strongPassword1"
}
```

| Поле | Тип | Обязательное | Правила |
|------|-----|-------------|---------|
| `email` | string | да | валидный email |
| `name` | string | да | 2–64 символа |
| `password` | string | да | 8–128 символов |

**Responses:**
- `201` — `{ user: PublicUser, token: string }`
- `400` — ошибка валидации
- `409` — email уже зарегистрирован

---

### POST /auth/login

Вход по email и паролю.

**Rate limit:** 10 req / 60s

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "strongPassword1"
}
```

**Responses:**
- `200` — `{ user: PublicUser, token: string }`
- `401` — неверные учётные данные

---

## Categories

Все эндпоинты требуют JWT. Категории изолированы по пользователю — пользователь видит только свои.

### GET /categories

Список всех категорий текущего пользователя.

**Responses:**
- `200` — массив `Category[]`
- `401` — нет токена / невалидный токен

**Пример ответа:**
```json
[
  {
    "id": "cm9cat456def789",
    "name": "Еда",
    "color": "#FF6B6B",
    "icon": "🍔",
    "userId": "cm9user789ghi012",
    "createdAt": "2026-05-01T10:00:00.000Z",
    "updatedAt": "2026-05-01T10:00:00.000Z"
  }
]
```

---

### GET /categories/:id

Получить категорию по ID.

**Path params:** `id` — CUID категории

**Responses:**
- `200` — объект `Category`
- `401` — нет токена
- `404` — категория не найдена или не принадлежит пользователю

---

### POST /categories

Создать новую категорию.

**Request body:**
```json
{
  "name": "Еда",
  "color": "#FF6B6B",
  "icon": "🍔"
}
```

| Поле | Тип | Обязательное | Правила |
|------|-----|-------------|---------|
| `name` | string | да | 1–64 символа |
| `color` | string | да | HEX формат `#RRGGBB` |
| `icon` | string | да | 1–8 символов (emoji) |

**Responses:**
- `201` — созданная `Category`
- `400` — ошибка валидации
- `401` — нет токена
- `409` — категория с таким именем уже существует у пользователя

---

### PATCH /categories/:id

Частичное обновление категории (только переданные поля изменяются).

**Path params:** `id` — CUID категории

**Request body:** те же поля что в POST, все опциональны.

**Responses:**
- `200` — обновлённая `Category`
- `400` — ошибка валидации
- `401` — нет токена
- `404` — категория не найдена
- `409` — дублирующееся имя

---

### DELETE /categories/:id

Удалить категорию.

**Path params:** `id` — CUID категории

**Responses:**
- `204` — категория удалена (нет тела ответа)
- `401` — нет токена
- `404` — категория не найдена
- `409` — нельзя удалить категорию с существующими транзакциями

---

## Transactions

Все эндпоинты требуют JWT. Транзакции изолированы по пользователю.

### GET /transactions

Список всех транзакций текущего пользователя, упорядоченных по дате (убывание). Каждая транзакция включает вложенный объект категории.

**Responses:**
- `200` — массив `TransactionResponse[]`
- `401` — нет токена

**Пример ответа:**
```json
[
  {
    "id": "cm9abc123def456",
    "amount": "1500.50",
    "description": "Обед в кафе",
    "date": "2026-05-17T12:00:00.000Z",
    "type": "EXPENSE",
    "categoryId": "cm9cat456def789",
    "category": {
      "id": "cm9cat456def789",
      "name": "Еда",
      "color": "#FF6B6B",
      "icon": "🍔"
    },
    "userId": "cm9user789ghi012",
    "createdAt": "2026-05-17T12:05:00.000Z",
    "updatedAt": "2026-05-17T12:05:00.000Z"
  }
]
```

> **Важно:** `amount` возвращается как строка с фиксированными 2 десятичными знаками (`"1500.50"`), потому что Prisma сериализует тип `Decimal` как строку.

---

### GET /transactions/summary

Агрегированная сводка доходов/расходов за год или месяц.

**Query params:**

| Параметр | Тип | Обязательное | Описание |
|----------|-----|-------------|---------|
| `year` | number | да | Год (например, `2026`) |
| `month` | number | нет | Месяц 1–12. Если не указан, возвращается сводка за весь год |

**Пример запроса:** `GET /transactions/summary?year=2026&month=5`

**Пример ответа:**
```json
{
  "year": 2026,
  "month": 5,
  "totalIncome": "5000.00",
  "totalExpense": "3200.50",
  "balance": "1799.50",
  "transactionCount": 12
}
```

**Responses:**
- `200` — объект `TransactionSummaryResponse`
- `400` — невалидные параметры запроса
- `401` — нет токена

---

### GET /transactions/:id

Получить транзакцию по ID.

**Path params:** `id` — CUID транзакции

**Responses:**
- `200` — объект `TransactionResponse` с вложенной категорией
- `401` — нет токена
- `404` — транзакция не найдена или не принадлежит пользователю

---

### POST /transactions

Создать новую транзакцию.

**Request body:**
```json
{
  "amount": 1500.50,
  "description": "Обед в кафе",
  "date": "2026-05-17T12:00:00.000Z",
  "categoryId": "cm9cat456def789",
  "type": "EXPENSE"
}
```

| Поле | Тип | Обязательное | Правила |
|------|-----|-------------|---------|
| `amount` | number | да | > 0, макс. 2 знака после запятой |
| `description` | string | нет | макс. 500 символов |
| `date` | string | да | ISO 8601 дата |
| `categoryId` | string | да | CUID существующей категории пользователя |
| `type` | `"INCOME"` \| `"EXPENSE"` | да | enum |

**Responses:**
- `201` — созданная `TransactionResponse`
- `400` — ошибка валидации
- `401` — нет токена
- `404` — категория не найдена или не принадлежит пользователю

---

### PATCH /transactions/:id

Частичное обновление транзакции.

**Path params:** `id` — CUID транзакции

**Request body:** те же поля что в POST, все опциональны.

**Responses:**
- `200` — обновлённая `TransactionResponse`
- `400` — ошибка валидации
- `401` — нет токена
- `404` — транзакция или новая категория не найдена

---

### DELETE /transactions/:id

Удалить транзакцию.

**Path params:** `id` — CUID транзакции

**Responses:**
- `204` — транзакция удалена (нет тела ответа)
- `401` — нет токена
- `404` — транзакция не найдена

---

## Общие коды ошибок

| Код | Описание |
|-----|---------|
| `400` | Validation error — тело/параметры не прошли валидацию |
| `401` | Unauthorized — JWT отсутствует, невалиден или пользователь удалён |
| `404` | Not Found — ресурс не существует или не принадлежит текущему пользователю |
| `409` | Conflict — дублирование уникального ключа или FK-ограничение |
| `429` | Too Many Requests — превышен rate limit |

**Формат ошибки:**
```json
{
  "statusCode": 404,
  "message": "Transaction not found",
  "error": "Not Found"
}
```

**Формат ошибки валидации (400):**
```json
{
  "statusCode": 400,
  "message": ["amount must be a number conforming to the specified constraints"],
  "error": "Bad Request"
}
```
