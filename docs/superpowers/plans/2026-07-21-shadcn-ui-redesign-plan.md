# shadcn/ui Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle pullse's single page onto shadcn/ui + Tailwind CSS — hero stats, an always-visible My PRs Card, tracked repos behind Tabs, a light/dark toggle — with zero changes to the GitHub data layer.

**Architecture:** Add Tailwind + shadcn/ui tooling, then incrementally rebuild `app/page.tsx` and its components on shadcn primitives (Card, Table, Badge, Tabs, Button, Alert), each step producing a page you can load in the browser against live data (a real `GITHUB_TOKEN` and a tracked repo are already configured in this project's `.env.local` / `repos.config.json`).

**Tech Stack:** Tailwind CSS, shadcn/ui, lucide-react (icons), next-themes (light/dark toggle). No new backend/data dependencies.

**Reference:** `docs/superpowers/specs/2026-07-21-shadcn-ui-redesign-design.md` (Approved)

## Global Constraints

- Presentation-only: `lib/github.ts`, `lib/repos-config.ts`, `lib/errors.ts` and their 34 existing Vitest tests must not change, and must still pass unmodified after every task.
- `GITHUB_TOKEN` handling is unchanged — still read server-side only, inside `lib/github.ts`.
- Base color theme: **Slate**, with CSS variables defined for both light and dark.
- Theme toggle is a single manual light/dark button (not a 3-way system/light/dark dropdown).
- Review-status badges use the traffic-light convention: `approved` → green + `CheckCircle2` icon, `changes_requested` → red + `XCircle` icon, `pending` → gray/slate + `Clock` icon.
- Hero stats row has exactly 4 tiles: Open, Unread, Approved, Changes Requested (Pending is not shown — it's derivable and was deliberately left out to keep the row to 4).
- My PRs is always visible as its own Card — never behind a tab. Tracked repos live behind Tabs, one trigger per `repos.config.json` entry, each trigger label includes that repo's open-PR count (e.g. "my-repo (2)").
- Error-handling text is unchanged from the current app — only the presentation changes (Card for the whole-page setup message, destructive-variant Alert with `role="alert"` preserved for per-section errors).
- No new automated tests — this project has no UI test convention (per the original design spec); verification is manual, in the browser, against the real GitHub data already configured in this project.

---

## File Structure

```
pullse/
├── tailwind.config.ts (or CSS-first config, depending on installed Tailwind version — see Task 1)
├── postcss.config.js (if Tailwind v3-style)
├── components.json                  (shadcn config, CLI-generated)
├── app/
│   ├── globals.css                  (Tailwind + shadcn CSS variables, Slate theme)
│   ├── layout.tsx                   (adds ThemeProvider)
│   ├── page.tsx                     (rebuilt incrementally across Tasks 2, 4, 5, 6)
│   └── components/
│       ├── ReviewStatusBadge.tsx    (new)
│       ├── HeroStats.tsx            (new, replaces StatsBanner.tsx)
│       ├── RepoTabs.tsx             (new)
│       ├── PRTable.tsx              (rewritten on shadcn Table)
│       ├── RefreshButton.tsx        (rewritten on shadcn Button)
│       └── StatsBanner.tsx          (deleted in Task 4)
├── components/
│   ├── ui/                          (shadcn-generated: card, table, badge, tabs, button, alert)
│   ├── theme-provider.tsx           (new)
│   └── mode-toggle.tsx              (new)
└── lib/                              (untouched — no changes in this plan)
```

- `components/ui/*` are shadcn-generated primitives — don't hand-edit their internals beyond what the CLI produces.
- `app/components/ReviewStatusBadge.tsx` is the single place that maps a `ReviewStatus` to a colored Badge + icon + label — both `PRTable`'s My-PRs and per-repo rows use it, so the mapping exists exactly once.
- `app/page.tsx` stays a thin Server Component doing composition only — no GitHub API or status-mapping logic is duplicated into it.

---

### Task 1: Tailwind CSS + shadcn/ui tooling setup

**Files:**
- Modify: `package.json` (new dependencies)
- Create: whatever `npx shadcn@latest init` generates — a Tailwind config (file name/format depends on the installed Tailwind major version, see below), `components.json`, `lib/utils.ts`
- Modify: `app/globals.css` (create if the CLI doesn't) — Tailwind directives + Slate CSS variables
- Modify: `app/layout.tsx` — import `./globals.css` if the CLI doesn't add it automatically
- Create: `components/ui/card.tsx`, `table.tsx`, `badge.tsx`, `tabs.tsx`, `button.tsx`, `alert.tsx`

**Interfaces:**
- Produces: `cn()` helper exported from `lib/utils.ts` (shadcn's standard class-merging helper, used by every `components/ui/*` file); the six shadcn primitives above, importable as `@/components/ui/<name>` exporting their standard sub-components (e.g. `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` from `card`; `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `table`; `Badge` from `badge`; `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `tabs`; `Button` from `button`; `Alert`, `AlertTitle`, `AlertDescription` from `alert`).

This task is CLI-driven rather than hand-written code, since shadcn/ui's `init`/`add` commands generate these files and their exact output depends on the currently-installed CLI and Tailwind versions. Follow the steps below, adapting to whatever the CLI actually presents, but hold to the stated targets (TypeScript, Slate base color, CSS variables on, `@/*` import alias matching this project's existing `tsconfig.json`).

- [ ] **Step 1: Run the shadcn/ui init command**

Run: `npx shadcn@latest init`

If it prompts interactively, answer: TypeScript — yes; base color — **Slate**; CSS variables — yes; import alias — `@/*` (this project's `tsconfig.json` already has `"paths": { "@/*": ["./*"] }`, so accept/confirm that alias rather than changing it). If the CLI supports non-interactive flags (check `npx shadcn@latest init --help` first — flag names have changed across CLI versions), prefer a non-interactive invocation with those same choices.

This command is expected to install Tailwind CSS as a dependency and generate its config, plus `components.json` and `lib/utils.ts`.

- [ ] **Step 2: Verify the Slate theme and confirm the CSS variable setup**

Read the generated `app/globals.css` (create it if the CLI didn't). It must define both a light and a dark set of CSS variables. If the CLI let you pick Slate in Step 1, confirm the values look like shadcn's standard Slate palette. If the CLI did not offer a color choice (defaulted to something else, e.g. Zinc), replace the `:root { ... }` and `.dark { ... }` variable blocks with these exact Slate values:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
}
```

Keep whatever `@tailwind base/components/utilities;` directives (Tailwind v3) or `@import "tailwindcss";` (Tailwind v4) the CLI generated above/around these blocks — only the variable values matter here, not the import mechanism.

- [ ] **Step 3: Confirm Tailwind scans this project's actual directories**

If a JS/TS Tailwind config file exists (Tailwind v3-style), open it and confirm its `content` array includes at least `./app/**/*.{ts,tsx}` and `./components/**/*.{ts,tsx}`. Add `./components/**/*.{ts,tsx}` if it's missing (the `components/` directory is new in this project and a generic Next.js template might not anticipate it). If there is no JS/TS config file (Tailwind v4 CSS-first setup), skip this step — v4 scans automatically.

- [ ] **Step 4: Confirm `app/globals.css` is imported**

Check `app/layout.tsx` imports `./globals.css` near the top. Add `import './globals.css';` above the existing imports if it's missing.

- [ ] **Step 5: Add the six shadcn components**

Run: `npx shadcn@latest add card table badge tabs button alert`

If prompted to overwrite or confirm anything, accept the defaults. Confirm afterward that `components/ui/card.tsx`, `table.tsx`, `badge.tsx`, `tabs.tsx`, `button.tsx`, and `alert.tsx` all exist.

- [ ] **Step 6: Install lucide-react and next-themes**

Run: `npm install lucide-react next-themes`

- [ ] **Step 7: Verify the project still compiles and boots**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run dev` in the background, then `curl http://localhost:3000` — expect the existing page to still render (its content hasn't changed yet this task, just new tooling installed alongside it). Stop the dev server afterward.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: add Tailwind CSS and shadcn/ui tooling"
```

In your task report, list every file this step created or modified (especially the exact Tailwind config file name/format and the final contents of `components.json`), since later tasks assume `lib/utils.ts` (`cn` helper) and `components/ui/*` exist at these paths.

---

### Task 2: Top bar — theme toggle and refreshed Refresh button

**Files:**
- Create: `components/theme-provider.tsx`
- Create: `components/mode-toggle.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/components/RefreshButton.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button` (Task 1).
- Produces: `ThemeProvider` (wraps `next-themes`), `ModeToggle` (client component, no props), both importable from `@/components/theme-provider` and `@/components/mode-toggle`.

- [ ] **Step 1: Create `components/theme-provider.tsx`**

```tsx
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 2: Create `components/mode-toggle.tsx`**

```tsx
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

- [ ] **Step 3: Wrap the app in `ThemeProvider` — replace `app/layout.tsx` entirely**

```tsx
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata = {
  title: 'pullse',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

(If Task 1 already added a different `globals.css` import path or additional font setup, keep that — just ensure `ThemeProvider` wraps `children` and `suppressHydrationWarning` is on `<html>`, which next-themes requires to avoid a hydration warning on the theme class.)

- [ ] **Step 4: Rewrite `app/components/RefreshButton.tsx` entirely**

```tsx
'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function RefreshButton() {
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" onClick={() => router.refresh()}>
      <RefreshCw className="mr-2 h-4 w-4" />
      Refresh
    </Button>
  );
}
```

- [ ] **Step 5: Wire `ModeToggle` into the top bar in `app/page.tsx`**

Find this block near the top of the returned JSX:

```tsx
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>pullse</h1>
        <RefreshButton />
      </div>
```

Replace it with:

```tsx
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">pullse</h1>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <RefreshButton />
        </div>
      </div>
```

Add the import `import { ModeToggle } from '@/components/mode-toggle';` alongside the other imports at the top of `app/page.tsx`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run dev` in the background, `curl http://localhost:3000` — confirm the response contains a button (the refresh button) and no server error. Stop the dev server afterward.
Manually confirm in a browser that clicking the new toggle button switches between light and dark (this one behavior needs a real browser — curl can't drive a click). If you don't have browser access in this environment, note that in your report; the controller will do a final manual pass in Task 7 regardless.

- [ ] **Step 7: Commit**

```bash
git add components/theme-provider.tsx components/mode-toggle.tsx app/layout.tsx app/components/RefreshButton.tsx app/page.tsx
git commit -m "feat: add light/dark theme toggle and restyle the refresh button"
```

---

### Task 3: ReviewStatusBadge and PRTable on shadcn Table

**Files:**
- Create: `app/components/ReviewStatusBadge.tsx`
- Modify: `app/components/PRTable.tsx`

**Interfaces:**
- Consumes: `Badge` from `@/components/ui/badge`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` from `@/components/ui/table` (Task 1); `ReviewStatus`, `PRRow` from `@/lib/github.types`.
- Produces: `function ReviewStatusBadge(props: { status: ReviewStatus }): JSX.Element`. `PRTable`'s external interface (`{ rows: PRRow[]; showUnread: boolean }`) is unchanged — no callers need updating.

- [ ] **Step 1: Create `app/components/ReviewStatusBadge.tsx`**

```tsx
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ReviewStatus } from '@/lib/github.types';

const REVIEW_STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  approved: {
    label: 'Approved',
    className:
      'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-900',
    icon: CheckCircle2,
  },
  changes_requested: {
    label: 'Changes requested',
    className:
      'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-900',
    icon: XCircle,
  },
  pending: {
    label: 'Pending',
    className:
      'bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800',
    icon: Clock,
  },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const { label, className, icon: Icon } = REVIEW_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}
```

- [ ] **Step 2: Replace `app/components/PRTable.tsx` entirely**

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import type { PRRow } from '@/lib/github.types';

interface PRTableProps {
  rows: PRRow[];
  showUnread: boolean;
}

export function PRTable({ rows, showUnread }: PRTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No open PRs.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>{showUnread ? 'Repo' : 'Author'}</TableHead>
          <TableHead>Review status</TableHead>
          <TableHead>{showUnread ? 'Unread' : 'Age'}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <a href={row.url} className="hover:underline">
                {row.title}
              </a>
            </TableCell>
            <TableCell>{showUnread ? `${row.owner}/${row.repo}` : row.author}</TableCell>
            <TableCell>
              <ReviewStatusBadge status={row.reviewStatus} />
            </TableCell>
            <TableCell>
              {showUnread ? (row.unread ? 'Unread' : '') : formatAge(row.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : `${days}d`;
}
```

- [ ] **Step 3: Verify against live data**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run dev` in the background, `curl http://localhost:3000` — this project already has a real `GITHUB_TOKEN` in `.env.local` and at least one tracked repo in `repos.config.json`, so the response should contain real PR rows. Confirm the response contains at least one of `Approved`, `Changes requested`, or `Pending`, and contains `<svg` (the lucide icon rendering inline). Stop the dev server afterward.

- [ ] **Step 4: Commit**

```bash
git add app/components/ReviewStatusBadge.tsx app/components/PRTable.tsx
git commit -m "feat: render review status as a colored badge with an icon"
```

---

### Task 4: HeroStats

**Files:**
- Create: `app/components/HeroStats.tsx`
- Delete: `app/components/StatsBanner.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `PRRow` from `@/lib/github.types`.
- Produces: `function HeroStats(props: { prs: PRRow[] }): JSX.Element` — computes Open/Unread/Approved/Changes-Requested counts internally from the given `PRRow[]`.

- [ ] **Step 1: Create `app/components/HeroStats.tsx`**

```tsx
import type { PRRow } from '@/lib/github.types';

interface HeroStatsProps {
  prs: PRRow[];
}

export function HeroStats({ prs }: HeroStatsProps) {
  const tiles = [
    { label: 'Open', value: prs.length },
    { label: 'Unread', value: prs.filter((pr) => pr.unread).length },
    { label: 'Approved', value: prs.filter((pr) => pr.reviewStatus === 'approved').length },
    {
      label: 'Changes Requested',
      value: prs.filter((pr) => pr.reviewStatus === 'changes_requested').length,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-semibold">{tile.value}</div>
          <div className="text-sm text-muted-foreground">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Delete `app/components/StatsBanner.tsx`**

- [ ] **Step 3: Wire `HeroStats` into `app/page.tsx`**

Replace the import line:

```tsx
import { StatsBanner } from './components/StatsBanner';
```

with:

```tsx
import { HeroStats } from './components/HeroStats';
```

Remove this now-unused line (HeroStats computes unread count internally):

```tsx
  const unreadCount = myPRs.filter((pr) => pr.unread).length;
```

Replace:

```tsx
      <StatsBanner totalOpen={myPRs.length} unread={unreadCount} />
```

with:

```tsx
      <HeroStats prs={myPRs} />
```

- [ ] **Step 4: Verify against live data**

Run: `npx tsc --noEmit` — expect no errors (confirms `StatsBanner`'s removal left no dangling references).
Run: `npm run dev` in the background, `curl http://localhost:3000` — confirm the response contains 4 numeric tiles with the labels `Open`, `Unread`, `Approved`, `Changes Requested`. Stop the dev server afterward.

- [ ] **Step 5: Commit**

```bash
git add app/components/HeroStats.tsx app/page.tsx
git rm app/components/StatsBanner.tsx
git commit -m "feat: add hero stats row, replacing the plain stats banner"
```

---

### Task 5: RepoTabs

**Files:**
- Create: `app/components/RepoTabs.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from `@/components/ui/tabs`, `Alert`/`AlertDescription` from `@/components/ui/alert` (Task 1); `PRTable` (Task 3); `PRRow`, `RepoConfig` from `@/lib/github.types`.
- Produces: `function RepoTabs(props: { repos: RepoConfig[]; rowsByRepo: (PRRow[] | null)[]; errorsByRepo: (string | null)[] }): JSX.Element | null` — `rowsByRepo`/`errorsByRepo` are parallel arrays indexed the same as `repos`.

- [ ] **Step 1: Create `app/components/RepoTabs.tsx`**

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PRTable } from './PRTable';
import type { PRRow, RepoConfig } from '@/lib/github.types';

interface RepoTabsProps {
  repos: RepoConfig[];
  rowsByRepo: (PRRow[] | null)[];
  errorsByRepo: (string | null)[];
}

export function RepoTabs({ repos, rowsByRepo, errorsByRepo }: RepoTabsProps) {
  if (repos.length === 0) {
    return null;
  }

  return (
    <Tabs defaultValue={`${repos[0].owner}/${repos[0].repo}`}>
      <TabsList>
        {repos.map((repo, i) => (
          <TabsTrigger key={`${repo.owner}/${repo.repo}`} value={`${repo.owner}/${repo.repo}`}>
            {repo.repo} ({rowsByRepo[i]?.length ?? 0})
          </TabsTrigger>
        ))}
      </TabsList>
      {repos.map((repo, i) => (
        <TabsContent key={`${repo.owner}/${repo.repo}`} value={`${repo.owner}/${repo.repo}`}>
          {errorsByRepo[i] && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>{errorsByRepo[i]}</AlertDescription>
            </Alert>
          )}
          <PRTable rows={rowsByRepo[i] ?? []} showUnread={false} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

- [ ] **Step 2: Wire `RepoTabs` into `app/page.tsx`**

Add the import: `import { RepoTabs } from './components/RepoTabs';`
Add the import: `import { Alert, AlertDescription } from '@/components/ui/alert';`

Find this block (the closing part of the returned JSX, after the My PRs `<section>`):

```tsx
      {reposError && <p role="alert">{reposError}</p>}
      {repos.map((r, i) => (
        <section key={`${r.owner}/${r.repo}`}>
          <h2>
            {r.owner}/{r.repo}
          </h2>
          {repoResults[i].error && <p role="alert">{repoResults[i].error}</p>}
          <PRTable rows={repoResults[i].data ?? []} showUnread={false} />
        </section>
      ))}
```

Replace it with:

```tsx
      {reposError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{reposError}</AlertDescription>
        </Alert>
      )}
      <RepoTabs
        repos={repos}
        rowsByRepo={repoResults.map((r) => r.data)}
        errorsByRepo={repoResults.map((r) => r.error)}
      />
```

- [ ] **Step 3: Verify against live data**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run dev` in the background, `curl http://localhost:3000` — confirm the response contains a tab trigger with the tracked repo's name and its PR count in parentheses (e.g. `my-repo (2)`), and a table of that repo's PRs. Stop the dev server afterward.
Manually confirm in a browser that clicking between tabs (if more than one repo is tracked) switches the visible table — curl only proves the initial server-rendered tab's content; note in your report if you can't verify the click behavior in this environment.

- [ ] **Step 4: Commit**

```bash
git add app/components/RepoTabs.tsx app/page.tsx
git commit -m "feat: move tracked repos behind tabs with per-repo PR counts"
```

---

### Task 6: My PRs Card and whole-page setup message Cards

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` from `@/components/ui/card` (Task 1).

- [ ] **Step 1: Add the Card import to `app/page.tsx`**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
```

- [ ] **Step 2: Wrap the whole-page setup messages in a Card**

Find:

```tsx
    if (error instanceof GithubTokenMissingError) {
      return (
        <main>
          <h1>pullse</h1>
          <p>Set GITHUB_TOKEN in .env.local to get started.</p>
        </main>
      );
    }
    if (error instanceof GithubTokenInvalidError) {
      return (
        <main>
          <h1>pullse</h1>
          <p>
            GITHUB_TOKEN in .env.local was rejected by GitHub. Check that it&apos;s valid and has
            repo/notifications read scopes.
          </p>
        </main>
      );
    }
    throw error;
```

Replace it with:

```tsx
    if (error instanceof GithubTokenMissingError) {
      return (
        <main className="mx-auto max-w-3xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>pullse</CardTitle>
              <CardDescription>Set GITHUB_TOKEN in .env.local to get started.</CardDescription>
            </CardHeader>
          </Card>
        </main>
      );
    }
    if (error instanceof GithubTokenInvalidError) {
      return (
        <main className="mx-auto max-w-3xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>pullse</CardTitle>
              <CardDescription>
                GITHUB_TOKEN in .env.local was rejected by GitHub. Check that it&apos;s valid and
                has repo/notifications read scopes.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      );
    }
    throw error;
```

- [ ] **Step 3: Wrap the My PRs section in a Card**

Find:

```tsx
      <section>
        <h2>My PRs</h2>
        {myPRsResult.error && <p role="alert">{myPRsResult.error}</p>}
        {unreadResult.error && <p role="alert">Unread status unavailable: {unreadResult.error}</p>}
        <PRTable rows={myPRs} showUnread />
      </section>
```

Replace it with:

```tsx
      <Card>
        <CardHeader>
          <CardTitle>My PRs</CardTitle>
        </CardHeader>
        <CardContent>
          {myPRsResult.error && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>{myPRsResult.error}</AlertDescription>
            </Alert>
          )}
          {unreadResult.error && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>Unread status unavailable: {unreadResult.error}</AlertDescription>
            </Alert>
          )}
          <PRTable rows={myPRs} showUnread />
        </CardContent>
      </Card>
```

(`Alert`/`AlertDescription` are already imported as of Task 5.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run dev` in the background, `curl http://localhost:3000` — confirm the response no longer contains any raw `<section>`/`<h2>My PRs</h2>` markup, and instead shows the My PRs content inside what renders as a bordered card. Stop the dev server afterward.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wrap My PRs and the setup messages in shadcn Cards"
```

---

### Task 7: Final manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full existing test suite**

Run: `npm test` — expect all 34 tests still passing, unchanged (this redesign must not have touched `lib/`).

- [ ] **Step 2: Full visual pass against live data**

Run: `npm run dev` and open `http://localhost:3000` in a browser (this project's `.env.local` already has a real `GITHUB_TOKEN`, and `repos.config.json` already tracks at least one repo). Confirm:
- Hero stats row shows 4 correct numbers (Open, Unread, Approved, Changes Requested)
- My PRs Card renders with colored, icon'd review-status badges
- The repo Tabs row shows each tracked repo with its PR count in the trigger label, and clicking between tabs switches the visible table
- The Refresh button reloads data
- The theme toggle switches the whole page between light and dark and the switch persists across a manual page reload (next-themes persists the choice in localStorage)

- [ ] **Step 3: Verify the invalid-token error path still renders correctly**

Back up the real token first, then restore it immediately after:

```bash
cp .env.local .env.local.bak
```

Edit `.env.local` to set `GITHUB_TOKEN=invalid-token-for-testing`, then run `npm run dev` in the background and `curl http://localhost:3000` — confirm the response contains "GITHUB_TOKEN in .env.local was rejected by GitHub" inside what renders as a card. Stop the dev server.

Restore the real token immediately:

```bash
mv .env.local.bak .env.local
```

Confirm `.env.local` contains the original real token again before finishing (`cat .env.local` and compare against what you backed up — do not leave the placeholder value in place).

- [ ] **Step 4: Update README if needed**

If `README.md`'s setup instructions reference anything that changed (they shouldn't — env var and config file setup is unchanged), update it. Otherwise, no change needed.

- [ ] **Step 5: Report**

Summarize what was verified, any visual issues found (and whether you fixed them or are flagging them for the controller), and confirm `.env.local` was correctly restored to the real token.
