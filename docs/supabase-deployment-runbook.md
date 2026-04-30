# sandpaper_support — Supabase Database, Edge Function, and Deployment Runbook

## Purpose

This note records the correct working deployment process for `sandpaper_support`, so future work does not waste time debugging the wrong thing.

Project:

```text
sandpaper_support
```

Repository:

```text
VladChat/sandpaper_support
```

Main local repository:

```text
C:\Users\vladi\Documents\vcoding\projects\sandpaper_support
```

Active branch for normal work:

```text
main
```

Supabase project ref:

```text
cmaaykcxcfxrujkrqsbt
```

Live Edge Function:

```text
support-ai-chat
```

Function URL:

```text
https://cmaaykcxcfxrujkrqsbt.supabase.co/functions/v1/support-ai-chat
```

---

## Critical Rule

Do not assume Supabase is broken just because one CLI path fails.

This project has a known working deployment pattern:

1. Database migrations can be applied using `SUPABASE_DB_URL`.
2. Edge Function deployment is best completed through GitHub Actions using repository secrets.
3. `support-ai-chat` must be deployed with `--no-verify-jwt`.

Do not replace this with browser login assumptions.

---

## Public vs Private Values

Public values allowed in committed frontend files:

```text
SUPABASE_URL
SUPABASE_ANON_KEY / sb_publishable_*
TURNSTILE_SITE_KEY
```

Private values that must never be committed:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
TURNSTILE_SECRET_KEY
```

Expected storage:

```text
.env.local                         local only, never committed
GitHub Repository Secrets          used by GitHub Actions
Supabase Edge Function Secrets      runtime secrets for deployed functions
```

`env.example` may contain variable names only. It must not contain real secret values.

---

## Current AI Protection Deployment State

AI request protection is deployed and live.

Confirmed components:

```text
Database migration applied:
supabase/migrations/20260429_support_ai_request_limits.sql

Edge Function deployed:
support-ai-chat

GitHub Actions workflow:
.github/workflows/deploy-support-ai-chat.yml

Latest relevant commits:
d4dac7c  Add AI request protection with Turnstile gate
ddb48c5  Add GitHub Actions workflow to deploy support-ai-chat
```

The workflow deployment log confirmed:

```text
Finished supabase secrets set.
Deployed Functions on project cmaaykcxcfxrujkrqsbt: support-ai-chat
```

---

## Correct Workflow to Deploy support-ai-chat

Use this GitHub Actions workflow:

```text
Deploy Support AI Chat
```

Workflow file:

```text
.github/workflows/deploy-support-ai-chat.yml
```

Purpose:

```text
Set TURNSTILE_SECRET_KEY in Supabase project secrets
Deploy support-ai-chat with --no-verify-jwt
```

The workflow should use GitHub Repository Secrets:

```text
SUPABASE_ACCESS_TOKEN
TURNSTILE_SECRET_KEY
```

The workflow must deploy with:

```bash
supabase functions deploy support-ai-chat --project-ref "${SUPABASE_PROJECT_REF}" --no-verify-jwt
```

Never remove `--no-verify-jwt` from this function deployment. The frontend is public and calls this function directly.

---

## Correct Workflow File

```yaml
name: Deploy Support AI Chat

on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      TURNSTILE_SECRET_KEY: ${{ secrets.TURNSTILE_SECRET_KEY }}
      SUPABASE_PROJECT_REF: cmaaykcxcfxrujkrqsbt

    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Set Turnstile secret
        run: |
          supabase secrets set "TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY}" --project-ref "${SUPABASE_PROJECT_REF}"

      - name: Deploy support-ai-chat
        run: |
          supabase functions deploy support-ai-chat --project-ref "${SUPABASE_PROJECT_REF}" --no-verify-jwt
```

---

## How to Run the Workflow

Open:

```text
https://github.com/VladChat/sandpaper_support/actions/workflows/deploy-support-ai-chat.yml
```

Run:

```text
Run workflow
Branch: main
```

Expected successful log lines:

```text
Finished supabase secrets set.
Deployed Functions on project cmaaykcxcfxrujkrqsbt: support-ai-chat
```

A GitHub warning about Node.js 20 deprecation is not a deployment failure by itself.

---

## Database Migration Process

Preferred path for migrations in this project:

```powershell
cd "C:\Users\vladi\Documents\vcoding\projects\sandpaper_support"

$line = Get-Content ".\.env.local" | Where-Object { $_ -match "^\s*SUPABASE_DB_URL\s*=" } | Select-Object -First 1
$env:SUPABASE_DB_URL = ($line -replace "^\s*SUPABASE_DB_URL\s*=\s*", "").Trim().Trim('"').Trim("'")

npx supabase db push --db-url "$env:SUPABASE_DB_URL"
```

Use this when the migration must be pushed from local PowerShell.

Do not block on `npx supabase link` when the DB URL flow is available.

---

## Edge Function Local Deploy Command

The known direct local deploy command is:

```powershell
cd "C:\Users\vladi\Documents\vcoding\projects\sandpaper_support"

$line = Get-Content ".\.env.local" | Where-Object { $_ -match "^\s*SUPABASE_ACCESS_TOKEN\s*=" } | Select-Object -First 1
$env:SUPABASE_ACCESS_TOKEN = ($line -replace "^\s*SUPABASE_ACCESS_TOKEN\s*=\s*", "").Trim().Trim('"').Trim("'")

npx supabase functions deploy support-ai-chat --project-ref cmaaykcxcfxrujkrqsbt --no-verify-jwt
```

However, for this project, the preferred final deployment path is now the GitHub Actions workflow above because it uses GitHub Repository Secrets and avoids local token confusion.

---

## Setting Supabase Function Secrets

Local PowerShell method:

```powershell
cd "C:\Users\vladi\Documents\vcoding\projects\sandpaper_support"

$line = Get-Content ".\.env.local" | Where-Object { $_ -match "^\s*SUPABASE_ACCESS_TOKEN\s*=" } | Select-Object -First 1
$env:SUPABASE_ACCESS_TOKEN = ($line -replace "^\s*SUPABASE_ACCESS_TOKEN\s*=\s*", "").Trim().Trim('"').Trim("'")

$line = Get-Content ".\.env.local" | Where-Object { $_ -match "^\s*TURNSTILE_SECRET_KEY\s*=" } | Select-Object -First 1
$turnstileSecret = ($line -replace "^\s*TURNSTILE_SECRET_KEY\s*=\s*", "").Trim().Trim('"').Trim("'")

npx supabase secrets set "TURNSTILE_SECRET_KEY=$turnstileSecret" --project-ref cmaaykcxcfxrujkrqsbt
```

GitHub Actions method is preferred for online deployment:

```bash
supabase secrets set "TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY}" --project-ref "${SUPABASE_PROJECT_REF}"
```

Never print secret values in logs.

---

## Post-Deployment Verification

Safe verification without paid OpenAI request:

```powershell
$functionUrl = "https://cmaaykcxcfxrujkrqsbt.supabase.co/functions/v1/support-ai-chat"

Invoke-WebRequest -Method OPTIONS -Uri $functionUrl

Invoke-WebRequest -Method POST -Uri $functionUrl -ContentType "application/json" -Body "{}"
```

Expected:

```text
OPTIONS returns 204 No Content
POST returns 400 Bad Request with validation error such as:
{"error":"sessionToken is required."}
No 401 Unauthorized
```

This confirms:

```text
Function is reachable
CORS is working
--no-verify-jwt is active
JWT verification is not blocking the public frontend
```

A real AI request should be performed only when UX behavior must be tested.

---

## AI Protection UX Test

Expected live behavior:

```text
1st question:
AI answer

2nd question / follow-up:
AI answer + Turnstile challenge appears for the next question

After Turnstile:
3 additional AI requests are allowed

After those 3:
login_required
```

The frontend should preserve:

```text
First answer on /ask/?q=... -> structured support card
Manual follow-up answers -> compact chat messages
```

Do not break this behavior.

---

## Secret Leak Check Before Commit

Run before committing deployment-related changes:

```powershell
git status --short
git diff --cached
git grep -n "TURNSTILE_SECRET_KEY"
git grep -n "SUPABASE_ACCESS_TOKEN"
git grep -n "OPENAI_API_KEY"
git grep -n "SUPABASE_SERVICE_ROLE_KEY"
git grep -n "SUPABASE_DB_URL"
```

Expected:

```text
env.example may contain variable names only
assets/config.js may contain public TURNSTILE_SITE_KEY
No private secret values appear in tracked files
.env.local is not staged
```

---

## Common Mistakes to Avoid

Do not:

```text
Ask for new keys when existing keys are already known to work
Treat public TURNSTILE_SITE_KEY as private
Commit TURNSTILE_SECRET_KEY
Commit .env.local
Deploy support-ai-chat without --no-verify-jwt
Assume browser login is enough for Supabase CLI
Block deployment on supabase link when SUPABASE_DB_URL migration flow works
Send paid OpenAI test calls when safe validation calls are enough
```

---

## One-Prompt Agent Instruction Template

Use this when asking the local VS Code agent to verify or deploy:

```text
Project: sandpaper_support
Repo: VladChat/sandpaper_support
Local path: C:\Users\vladi\Documents\vcoding\projects\sandpaper_support
Branch: main

Use the project runbook:
docs/supabase-deployment-runbook.md

Do not ask for new keys unless the exact current command fails.

Verify:
1. .env.local is not staged or committed.
2. Private secret values do not appear in tracked files.
3. Public frontend config is allowed:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY / sb_publishable
   - TURNSTILE_SITE_KEY

For migrations:
- Prefer SUPABASE_DB_URL:
  npx supabase db push --db-url "$env:SUPABASE_DB_URL"

For Edge Function deployment:
- Prefer GitHub Actions workflow:
  .github/workflows/deploy-support-ai-chat.yml
  Workflow name: Deploy Support AI Chat

The function must deploy with:
--no-verify-jwt

Post-deployment verification:
- OPTIONS request should return 204.
- POST with empty JSON should return validation error, not 401.
- Do not send paid AI request unless explicitly asked.

Final report:
- migration status
- secret leak check
- function deploy status
- 401 status
- git status
```

---

## File Placement

Recommended project file path for this runbook:

```text
docs/supabase-deployment-runbook.md
```
