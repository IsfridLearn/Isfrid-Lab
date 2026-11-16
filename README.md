# ISFRID

**Your knowledge. Your progress. Your mastery.**

ISFRID is a PDF-based interactive learning and assessment platform. Students upload course PDFs, write their own
questions from the extracted text, and test themselves in three modes: Multiple Choice, Identification, and Fill in the
Code (a coding workspace for technology programs).

ISFRID is **not** an AI product. There are no AI APIs, no AI-generated questions and no chat. Everything is traditional
logic: PDF.js text extraction, questions the student writes, and deterministic answer checking.

```
UPLOAD PDF → EXTRACT CONTENT → CREATE STUDY MATERIALS → SELECT STUDY MODE → TAKE ASSESSMENT → VIEW RESULTS
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide icons |
| Backend | Supabase: PostgreSQL, Auth, Storage, Row Level Security |
| Documents | PDF.js (rendering and text extraction, in the browser) |
| Coding | Monaco Editor; in-browser runtimes for Python / JavaScript / SQL; optional remote sandbox for C / C++ / Java / PHP |
| Deploy | Vercel + Supabase |

## Setup

You need Node 20+ and a Supabase project (the free tier is enough to start).

1. **Install** — `npm install` (this also copies the PDF.js worker into `public/pdfjs`).
2. **Create the database** — in the Supabase dashboard open **SQL Editor**, paste all of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and run it once. It creates the 14 tables,
   indexes, constraints, triggers, RLS policies and the private `documents` storage bucket.
3. **Add keys** — copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API). Never commit `.env.local`.
4. **Allow the auth redirect** — Authentication → URL Configuration: set **Site URL** to your app address
   (`http://localhost:3000` in development) and add `<address>/auth/callback` to **Redirect URLs**.
   Confirmation and password-reset emails land on that route.
5. **Run** — `npm run dev`, open http://localhost:3000 and register.

Until step 3 is done the app says so on `/setup` instead of pretending to work.

Supabase sends confirmation emails by default. For quick local testing you can turn off
*Authentication → Sign In / Providers → Email → Confirm email*; registration then goes straight to onboarding.

### Deploying to Vercel

Import the repository, add the same environment variables (set `NEXT_PUBLIC_SITE_URL` to the production URL), deploy,
then add the production `/auth/callback` URL to Supabase's redirect list.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## How it is organised

```
supabase/migrations/0001_init.sql   schema, RLS, triggers, storage bucket
public/runners/                     Web Workers that run JS, Python (Pyodide) and SQL (sql.js)
src/proxy.ts                        session refresh + signed-out redirects
src/lib/
  grading.ts                        all answer checking (pure functions)
  execution.ts                      remote sandbox client (Piston / Judge0) — server only
  runner.ts                         "Run" from the browser: worker or /api/execute
  pdf.ts                            PDF.js helpers
  auth.ts, supabase/                session + data access
src/app/actions/                    Server Actions: auth, profile, library, content, attempts (grading)
src/app/(auth)/                     login, register, forgot / reset password
src/app/(app)/                      sidebar pages: dashboard, subjects, sets, library, codelab, history, results, profile, settings
src/app/(focus)/                    distraction-free pages: assessment runner, coding workspace, scratchpad
src/components/                     design system (ui.tsx, client-ui.tsx) and feature components
```

### Pages

Landing `/` · Register `/register` · Login `/login` · Onboarding `/onboarding` · Dashboard `/dashboard` ·
My Subjects `/subjects` · Subject details `/subjects/[id]` · PDF Library `/library` · PDF Upload `/library/upload` ·
PDF Viewer `/library/[id]` · Study Mode Selection `/sets/new` · Multiple Choice / Identification editor
`/sets/[id]/edit` · Coding Exercise Editor `/sets/[id]/exercises/[id|new]` · Assessments `/attempt/[id]` ·
Coding Workspace `/codelab/[exerciseId]` · Scratchpad `/codelab/scratch` · Results `/results/[id]` ·
History `/history` · Profile `/profile` · Settings `/settings`.

## Generating questions from a PDF

The Multiple Choice and Identification editors have a **Generate from a PDF** panel. It reads the PDF's extracted text
and finds definition sentences with plain pattern matching (no AI, no API, runs in the browser):

- `A stack is a linear data structure…`, `Recursion refers to…`, `… is defined as / known as / means …`
- `A node with no children is called a leaf.`
- Glossary lines such as `Array: a collection of elements…` or `Hash table – a structure that…`

Identification drafts blank out the term; multiple-choice drafts use other terms from the same PDF as wrong answers.
Students review the drafts, untick bad ones and add the rest; drafts already in the set are not offered again. The same
PDF always produces the same drafts. Text without definition-style sentences (narrative prose, essays) yields few or no
drafts, and scanned PDFs have no text to read. The logic is in [`src/lib/question-gen.ts`](src/lib/question-gen.ts).

The Fill in the Code editor has the same panel for code. It finds runs of three or more code-like lines, detects the
language (or uses the one picked), and blanks out up to three keywords, function names or variables/values per snippet.
The drafts are "Match the blanks" exercises, so nothing is executed. PDFs usually lose indentation; brace languages are
re-indented automatically, Python is not. Code shown as images has no text to read. The logic is in
[`src/lib/code-gen.ts`](src/lib/code-gen.ts).

## How answers are checked

All grading is deterministic and lives in [`src/lib/grading.ts`](src/lib/grading.ts); assessments are graded in Server
Actions, and the answer key is never sent to the browser during an attempt.

- **Multiple choice** — correct only when the selected options are exactly the correct options (supports "select all
  that apply"). Question and option order are shuffled per attempt.
- **Identification** — compared after trimming, collapsing spaces and lower-casing; any of the accepted answers counts.
- **Fill in the Code** — each exercise uses one of four checks:
  - *Match the blanks* (`__1__`, `__2__` …): the student's code is matched against the template, each blank is compared
    with the accepted answers (spacing around symbols ignored, case-sensitive). No code is executed.
  - *Match the output*: the student types the program's output. No code is executed and Run is disabled.
  - *Match the solution*: whole-program comparison with the reference solution. No code is executed.
  - *Run test cases*: the program is executed for each input and its output compared with the expected output.

## Code execution and security

Student code is **never executed on the application server**.

| Language | Where it runs | Cost |
|---|---|---|
| Python, JavaScript, SQL | A Web Worker in the student's own browser (Pyodide, a sandboxed JS worker with network APIs removed, sql.js). Killed after 8 seconds. | Free |
| C, C++, Java, PHP | Forwarded by `/api/execute` (signed-in users only, 64 KB limit) to an isolated sandbox service | Needs a service |

For C / C++ / Java / PHP set `CODE_EXECUTION_PROVIDER`, `CODE_EXECUTION_URL` and (if needed) `CODE_EXECUTION_API_KEY`:

- `judge0` — a [Judge0 CE](https://judge0.com) API. For trying things out, the public instance works with no key:
  `CODE_EXECUTION_PROVIDER=judge0` and `CODE_EXECUTION_URL=https://ce.judge0.com` (this was used to test C, C++, Java
  and PHP end to end). It is a shared community service with no uptime or quota guarantee and older compilers
  (GCC 9, OpenJDK 13, PHP 7.4), so use a self-hosted Judge0 or a paid plan for real users.
- `piston` — a [Piston](https://github.com/engineer-man/piston) API (`…/api/v2`). The public Piston API has been
  whitelist-only since 15 Feb 2026, so this means self-hosting (a small VPS with Docker).

If nothing is configured, those languages still work for exercises checked by blanks, output or solution; Run and
test-case exercises show a clear "no execution service configured" message.

Other security notes:

- Every table has Row Level Security: users can only read and write their own rows. Child rows must hang off a parent
  the user owns, and coding sets/exercises can only be created by users whose program is technical.
- PDFs live in a private bucket under a folder named after the user id, enforced by storage policies.
- `user_progress` is written only by database triggers.
- Remote code runs are limited to 30 per user per minute by a database function, so the limit holds across every
  server instance. `/api/execute` also requires a signed-in, same-origin request.
- Every response carries a Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, a referrer policy and (in
  production) HSTS. The code-runner workers have their own policy with no network access for student code.
- Changing a password in Settings requires the current password; the reset page only works straight after opening a
  reset link. Both sign out other devices.
- Server Actions validate every id and input shape before touching the database.

Recommended Supabase settings (Authentication): minimum password length 8 or more, leaked-password protection on,
"Confirm email" on, and the built-in rate limits left enabled. Add a custom SMTP provider before real users sign up.

### Keeping secrets out of git

`.gitignore` excludes env files, keys, credentials, database dumps, uploads, user data folders and logs. `npm install`
enables the hooks in `.githooks`:

- `pre-commit` blocks staged secrets and ignored paths (`npm run check:secrets` scans the whole tree).
- `commit-msg` blocks co-author and generated-with lines.
- `pre-push` re-scans every tracked file (`npm run check:push`).
- Test-case results for browser-run languages are reported by the browser. That is fine for a private self-study tool
  (students write their own answer keys), but it is not tamper-proof; anything competitive (leaderboards, graded
  coursework) should run all languages on the remote sandbox.

## Zero-cost-first: what is free and where the limits are

Free-tier limits change, so confirm current numbers on each provider's pricing page.

- **Supabase free tier** — limited database size and file storage, and projects pause after a period of inactivity.
  PDFs are capped at 20 MB each in this app; storage is the first limit a growing user base will hit.
- **Vercel Hobby** — fine for personal/non-commercial use.
- **Monaco, Pyodide, sql.js** — loaded from public CDNs (jsDelivr, cdnjs) at no cost. The first Python run downloads
  the runtime (~10 MB), then the browser caches it.
- **Likely first paid items** — a sandbox host for C / C++ / Java / PHP execution, then Supabase storage, then a custom
  SMTP provider (Supabase's built-in email sender is heavily rate-limited and meant for testing).

## Not included

- OCR: scanned PDFs with no text layer can be viewed but have no text to quote.
- Sharing study sets between users (all data is private by design).
- Account deletion from the UI (delete the user in the Supabase dashboard; all their rows cascade).
