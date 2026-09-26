# RegenMed Internal Document Reviewer — Frontend

React + Vite + TypeScript UI for the RegenMed hackathon challenge: upload one completed
processing form (PDF), detect its type (MP-F-023, QS-F-049, Lot Log), and list every
missing/inconsistent field with its location highlighted on the page.

## Run it

```bash
npm install
cp .env.example .env      # set VITE_API_URL, or leave empty to use the /api dev proxy (localhost:8000)
npm run dev               # http://localhost:5173
```

## Build / deploy

```bash
npm run build             # outputs dist/
```
Deploy `dist/` to Vercel, Netlify or Render (static site). Set `VITE_API_URL` to the
deployed backend URL (leave empty when the backend serves the app on the same origin).

## Structure

```
src/
  App.tsx               app shell + page state
  styles.css            design tokens & all styles
  components/           Sidebar, IssueList, HeroArt, online/ (Fill Online forms)
  pages/                Dashboard, Review (upload → processing → results), History, Rules
  lib/types.ts          ReviewResult / Issue + backend CheckResult
  lib/api.ts            checkPdf (/api/check), correctionNote (/api/note), wakeServer (/api/health)
  lib/formRules.ts      rules per form type (from the challenge writeup)
docs/design-reference.jpg   visual reference the UI is based on
```
