# Centralized Shared Database via GitHub

**Date:** 2026-07-26
**Status:** Draft

## Overview

Centralize the product database (currently `db.csv`) used by a Web App and an Android App into a single Git repository. All changes go through an Admin Panel (React) that commits to GitHub; apps read from `raw.githubusercontent.com`.

## Architecture

```
┌─────────────────────────────────────┐
│         GitHub Repository           │
│  (single source of truth: db.csv)  │
└──┬──────────────┬──────────────────┘
   │              │
   │ read         │ write (GitHub Content API)
   │              │
┌──▼─────────┐  ┌─▼──────────────────┐
│ Web App    │  │ Admin Panel (React) │
│ Android App│  │ deploys to Pages    │
│ (raw URL)  │  │ via GH CLI / CI     │
└────────────┘  └────────────────────┘
```

## Components

### 1. GitHub Repository

- Contains `db.csv` as the single source of truth
- CSV structure: existing columns preserved (Магазин, Зона, Ячейки хранения, ШК, Код товара, Наименование, Количество, Тип, Этикетка, Группы 1-5, Бренд, ШК товара, Компонент, STOPSALE, ONLINE-ONLY, Маркетплейс, Маркированный, Время создания МСК, Последнее изменение МСК)
- `main` branch — production data

### 2. Admin Panel (React)

- **Stack:** React + Vite + TypeScript, deployed to GitHub Pages
- **Auth:** GitHub Personal Access Token (stored in env or prompted on startup)
- **API Client:** Octokit (GitHub REST API)
- **Features:**
  - Read `db.csv` from repo via Content API
  - Parse CSV → table with search/filter
  - Add new product rows
  - Edit existing rows
  - Save: commit updated CSV via `PUT /repos/{owner}/{repo}/contents/db.csv`
- **Deployment:** `npm run deploy` → `gh-pages` branch

### 3. Consumer Apps (Web + Android)

- Change: replace local file path with URL
  ```
  https://raw.githubusercontent.com/{owner}/{repo}/main/db.csv
  ```
- No other changes required — apps already parse CSV/XLSX
- Android: HTTP client fetches CSV from raw URL at app start

## Data Flow

1. Admin edits data in React panel → commits to GitHub via API
2. GitHub receives commit → file updated on `main`
3. Web App reads from raw URL (or caches locally)
4. Android App reads from raw URL on sync

## Constraints

- No server/VPS — fully serverless
- GitHub API rate limit: 5000 req/hr (authenticated), 60 req/hr (unauthenticated)
- CSV file size: manageable for GitHub Content API (max 1 MB for free tier — if larger, switch to GitHub Releases)
- Personal Access Token scopes: `repo` (private repos) or `public_repo` (public repos)

## Security

- PAT stored as GitHub Actions secret if auto-deploy, or user-managed
- Admin panel only — consumers are read-only, no token needed
- Commit messages: `[Admin] update db.csv — {summary of changes}`

## Future Considerations

- CSRF / commit signing if more admins join
- Convert CSV to SQLite for better querying if volume grows
- GitHub Actions to validate CSV format on every commit
