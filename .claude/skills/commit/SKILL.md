---
name: commit
description: Use when committing changes to the current branch — stages files, writes a conventional commit message, and creates the commit
model: sonnet
allowed-tools:
  - Bash(git *)
---

# Commit

## Overview

Commit changes following the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Conventional Commit Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Types

| Type | When to use |
|------|-------------|
| `feat` | New feature for the user |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code change that neither fixes nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Build process, tooling, dependency updates |
| `build` | Build system or external dependency changes |
| `ci` | CI configuration changes |
| `perf` | Performance improvements |

## Project Scopes

| Scope | Area |
|-------|------|
| `frontend` | `apps/frontend` |
| `backend` | `apps/backend` |
| `shared` | `packages/shared` |
| `db` | Database schema / migrations |
| `auth` | Authentication & authorization |
| `transactions` | Transactions feature |
| `categories` | Categories feature |
| `config` | Configuration / env |
| `deps` | Dependency updates |

## Process

1. `git status` — review what changed
2. `git diff` — understand the actual changes
3. Stage specific files (avoid `git add .` unless all changes belong to one commit)
4. Compose commit message following rules below
5. Commit with HEREDOC to preserve formatting

## Commit Message Rules

- Subject line: imperative mood, max 72 chars, no trailing period
- Body: explain WHY, not WHAT (the diff shows what)
- Breaking change: add `!` after type/scope and a `BREAKING CHANGE:` footer
- Always append Co-Authored-By footer

## Examples

```bash
# Minimal
git commit -m "feat(transactions): add expense filtering by date range"

# With body
git commit -m "$(cat <<'EOF'
fix(auth): handle expired JWT token on refresh

Token refresh was silently failing — users were logged out with no feedback.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"

# Breaking change
git commit -m "$(cat <<'EOF'
feat(api)!: wrap transaction responses in data/meta envelope

BREAKING CHANGE: response shape changed from array to { data, meta }

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## Always Include Footer

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Past tense subject ("added X") | Imperative: "add X" |
| Vague type (`chore` for a feature) | Pick the most specific type |
| `git add .` mixing unrelated changes | Stage by file; split into multiple commits if needed |
| Subject over 72 chars | Move details to body |
| No scope when scope is obvious | Always add scope for this project |

## Do NOT:
- **Do NOT** commit `.env`, `.env.local`, files which contain secrets
- **Do NOT** push automatically - commit only, if user hasn't ask for something else
- **Do NOT** add files without understanding it's contents
