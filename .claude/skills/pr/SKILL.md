---
name: pr
description: Use when creating a pull request on GitHub from the current branch — takes a PR title and target (base) branch as arguments, pushes the branch if needed, and opens the PR via gh CLI
model: sonnet
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
---

# PR

## Overview

Create a GitHub pull request from the current branch into the specified target branch using the `gh` CLI. The skill accepts two arguments: PR title and target branch.

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `title` | yes | PR title (under 70 chars, follows [Conventional Commits](https://www.conventionalcommits.org/) style — same types/scopes as the `commit` skill) |
| `base` | yes | Target branch to merge into (e.g. `master`, `develop`) |

If either is missing, ask the user for it before doing anything else.

## Pre-flight Checks

Run these in parallel before creating the PR. **STOP and report to the user** if any fail.

```bash
# 1. Current branch — must NOT equal the target base
git rev-parse --abbrev-ref HEAD

# 2. Working tree must be clean (no uncommitted changes)
git status --porcelain

# 3. Target branch must exist on the remote
git ls-remote --exit-code --heads origin <base>

# 4. gh CLI must be authenticated
gh auth status
```

Failure handling:

| Check | If it fails |
|-------|-------------|
| Current branch == base | Abort — refuse to PR a branch into itself. Ask user to switch branches. |
| Dirty working tree | Abort — tell the user to commit (suggest the `commit` skill) or stash first. Do NOT auto-commit. |
| Base missing on remote | Abort — list available remote branches and ask the user to pick one. |
| `gh` not authenticated | Abort — tell the user to run `gh auth login` themselves. |

## Process

1. Run pre-flight checks (above).
2. Gather PR context in parallel:
   ```bash
   git log origin/<base>..HEAD --pretty=format:"%h %s" --no-merges
   git diff origin/<base>...HEAD --stat
   ```
3. Push the current branch to `origin` with upstream tracking if not already pushed:
   ```bash
   git push -u origin HEAD
   ```
4. Compose the PR body (see template below) — analyse **all** commits in the range, not just the latest.
5. Create the PR with `gh pr create` using a HEREDOC for the body (see example).
6. Return the PR URL to the user.

## PR Body Template

Match the language the user used in their request (default: Russian).

```markdown
## Summary

- <1–3 bullets describing what changed and why>

## Changes

- <bullet per logical change, grouped by scope: backend / frontend / shared / db>

## Test plan

- [ ] <checklist item — what to verify manually or which tests cover it>
- [ ] <...>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Creating the PR

Always pass the body via single-quoted HEREDOC to preserve formatting and prevent shell expansion:

```bash
gh pr create \
  --base "<base>" \
  --title "<title>" \
  --body "$(cat <<'EOF'
## Summary

- ...

## Changes

- ...

## Test plan

- [ ] ...

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Rules

- **Never** push with `--force` / `--force-with-lease` from this skill.
- **Never** create the PR as a draft unless the user explicitly asks (`--draft`).
- **Never** add reviewers, labels, milestones, or assignees unless the user asks.
- **Never** auto-commit pending changes — that's the `commit` skill's job.
- Keep the **title** under 70 chars; put details in the body.
- Analyse **all commits** in `origin/<base>..HEAD`, not just `HEAD`.
- If the current branch is already pushed and tracks `origin/<branch>`, skip `-u` and just `git push`.
- Return the PR URL on success so the user can open it.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting `--base` (defaults to repo default branch) | Always pass `--base "<base>"` explicitly |
| Body via `-b "..."` losing newlines | Use HEREDOC with `--body "$(cat <<'EOF' ... EOF)"` |
| Reading only the latest commit for the body | Iterate over `git log origin/<base>..HEAD` |
| Force-pushing to "fix" a diverged branch | Stop. Ask the user — never force-push silently. |
| Creating PR before pushing the branch | `git push -u origin HEAD` first |
