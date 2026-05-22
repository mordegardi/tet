---
name: standup
description: Use when the user asks for a standup, daily summary, or what was done in the last 24 hours
model: sonnet
allowed-tools:
  - Bash(git *)
---

# Standup

## Overview

Collect all git activity from the last 24 hours and format it as a clean, readable standup report.

## Process

1. Run the git commands below to gather raw data
2. Analyse commits, changed files, and authors
3. Render the formatted report

## Git Commands

```bash
# Commits in the last 24 hours (with author and time)
git log --since="24 hours ago" --pretty=format:"%h|%an|%ar|%s" --no-merges

# File-level stats per commit
git log --since="24 hours ago" --stat --no-merges

# Overall diff stat (files changed summary)
git diff --stat HEAD "$(git log --since='24 hours ago' --format='%H' | tail -1)" 2>/dev/null || true
```

## Output Format

Render the report in this structure (use Markdown):

```
## Standup — <date, e.g. "21 мая 2026">

### ✅ Сделано

- **<scope или область>** — <одно предложение, что сделано>
  - `<файлы или модули>` (если важно)
- ...

### 📊 Статистика

| Метрика | Значение |
|---|---|
| Коммитов | N |
| Файлов изменено | N |
| Строк добавлено | +N |
| Строк удалено | -N |

### 🔍 Детали коммитов

| Хэш | Время | Автор | Сообщение |
|---|---|---|---|
| `abc1234` | 2 часа назад | Ivan | feat(backend): add X |
| ... | | | |
```

## Rules

- Group related commits into one bullet in "Сделано" — don't list every commit separately
- Use the commit scope (e.g. `backend`, `frontend`) to label each bullet
- If there are no commits in the last 24 hours, say so clearly
- Keep "Сделано" bullets short: one action verb + what changed + why (if obvious from message)
- Include the statistics table always
- Render in the same language the user used (default: Russian)
