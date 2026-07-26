# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React admin panel to view, add, edit product data in `db.csv` and commit changes to GitHub via API.

**Architecture:** React + Vite + TypeScript SPA deployed to GitHub Pages. Reads `db.csv` via GitHub Content API, edits in-memory, commits updated CSV back. Uses Octokit for GitHub API and Papaparse for CSV parsing/serialization.

**Tech Stack:** React 19, TypeScript, Vite, Octokit, Papaparse, GitHub Pages (via Actions)

---

### Task 1: GitHub API Client

**Files:**
- Create: `src/github/api.ts`

- [ ] **Step 1: Create Octokit client module**

```typescript
import { Octokit } from 'octokit'

const OWNER = import.meta.env.VITE_GITHUB_OWNER || ''
const REPO = import.meta.env.VITE_GITHUB_REPO || ''
const CSV_PATH = 'db.csv'

function createClient(token: string) {
  return new Octokit({ auth: token })
}

export async function fetchCSV(token: string): Promise<string> {
  const octokit = createClient(token)
  const response = await octokit.rest.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path: CSV_PATH,
  })
  const data = response.data as { content?: string; sha?: string }
  if (!data.content) throw new Error('No content found')
  return {
    content: atob(data.content.replace(/\n/g, '')),
    sha: data.sha,
  }
}

export async function commitCSV(token: string, content: string, sha: string, message: string): Promise<void> {
  const octokit = createClient(token)
  await octokit.rest.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path: CSV_PATH,
    message,
    content: btoa(content),
    sha,
  })
}

export { OWNER, REPO }
```

- [ ] **Step 2: Add `.env.example` to project root**

```
VITE_GITHUB_OWNER=your-username
VITE_GITHUB_REPO=your-repo-name
VITE_GITHUB_TOKEN=ghp_your_personal_access_token
```

- [ ] **Step 3: Configure Vite to expose env**

In `vite.config.ts`, add `envPrefix: 'VITE_'` (default, already works).

---

### Task 2: CSV Utilities

**Files:**
- Create: `src/csv/types.ts`
- Create: `src/csv/parse.ts`
- Create: `src/csv/serialize.ts`

- [ ] **Step 1: Define product type**

```typescript
export interface ProductRow {
  Магазин: string
  Зона: string
  'Ячейки хранения': string
  'ШК ячейки хранения': string
  'Код товара': string
  Наименование: string
  Количество: string
  Тип: string
  Этикетка: string
  'Группа 5': string
  'Группа 4': string
  'Группа 3': string
  'Группа 2': string
  'Группа 1': string
  Бренд: string
  'ШК товара': string
  Компонент: string
  STOPSALE: string
  'ONLINE-ONLY': string
  Маркетплейс: string
  Маркированный: string
  'Время создания МСК': string
  'Последнее изменение МСК': string
}
```

- [ ] **Step 2: CSV parser**

```typescript
import Papa from 'papaparse'
import type { ProductRow } from './types'

export function parseCSV(text: string): ProductRow[] {
  const result = Papa.parse<ProductRow>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';',
  })
  return result.data
}
```

- [ ] **Step 3: CSV serializer**

```typescript
import Papa from 'papaparse'
import type { ProductRow } from './types'

export function serializeCSV(rows: ProductRow[]): string {
  const header = 'Магазин;Зона;Ячейки хранения;ШК ячейки хранения;Код товара;Наименование;Количество;Тип;Этикетка;Группа 5;Группа 4;Группа 3;Группа 2;Группа 1;Бренд;ШК товара;Компонент;STOPSALE;ONLINE-ONLY;Маркетплейс;Маркированный;Время создания МСК;Последнее изменение МСК'
  const body = Papa.unparse(rows, {
    delimiter: ';',
    header: false,
  })
  return header + '\n' + body
}
```

---

### Task 3: Main Admin Table Component

**Files:**
- Create: `src/components/ProductTable.tsx`
- Create: `src/components/ProductTable.css`

- [ ] **Step 1: Create table component with search/filter**

```typescript
import { useState, useMemo } from 'react'
import type { ProductRow } from '../csv/types'
import './ProductTable.css'

interface Props {
  rows: ProductRow[]
  onEdit: (index: number, row: ProductRow) => void
  onAdd: () => void
}

export default function ProductTable({ rows, onEdit, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<keyof ProductRow>('Код товара')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      Object.values(r).some(v => v?.toLowerCase().includes(q))
    )
  }, [rows, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] || ''
      const bv = b[sortKey] || ''
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [filtered, sortKey, sortDir])

  const toggleSort = (key: keyof ProductRow) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div className="table-container">
      <div className="toolbar">
        <input
          type="text"
          placeholder="Поиск по всем полям..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <button onClick={onAdd} className="btn-add">+ Добавить товар</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {Object.keys(rows[0] || {}).map(key => (
                <th key={key} onClick={() => toggleSort(key as keyof ProductRow)} className="sortable">
                  {key} {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i}>
                {Object.values(row).map((val, j) => (
                  <td key={j}>{val}</td>
                ))}
                <td>
                  <button onClick={() => onEdit(i, row)} className="btn-edit">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-count">Всего: {rows.length} | Показано: {sorted.length}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create styles**

```css
.table-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.search-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.btn-add {
  padding: 8px 16px;
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.table-scroll {
  overflow-x: auto;
  max-height: 70vh;
  overflow-y: auto;
}
table {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
  white-space: nowrap;
}
th, td {
  border: 1px solid #ddd;
  padding: 4px 8px;
  text-align: left;
}
th {
  background: #f5f5f5;
  position: sticky;
  top: 0;
}
.sortable {
  cursor: pointer;
  user-select: none;
}
.sortable:hover {
  background: #e8e8e8;
}
.btn-edit {
  cursor: pointer;
  background: none;
  border: none;
  font-size: 16px;
}
.row-count {
  font-size: 12px;
  color: #666;
}
```

---

### Task 4: Product Edit / Add Modal

**Files:**
- Create: `src/components/ProductEditor.tsx`
- Create: `src/components/ProductEditor.css`

- [ ] **Step 1: Create editor modal component**

```typescript
import { useState } from 'react'
import type { ProductRow } from '../csv/types'
import './ProductEditor.css'

interface Props {
  row: ProductRow | null
  onSave: (row: ProductRow) => void
  onCancel: () => void
}

const FIELDS: (keyof ProductRow)[] = [
  'Магазин', 'Зона', 'Ячейки хранения', 'ШК ячейки хранения',
  'Код товара', 'Наименование', 'Количество', 'Тип', 'Этикетка',
  'Группа 5', 'Группа 4', 'Группа 3', 'Группа 2', 'Группа 1',
  'Бренд', 'ШК товара', 'Компонент', 'STOPSALE', 'ONLINE-ONLY',
  'Маркетплейс', 'Маркированный',
]

export default function ProductEditor({ row, onSave, onCancel }: Props) {
  const [form, setForm] = useState<ProductRow>(
    row ?? Object.fromEntries(FIELDS.map(f => [f, ''])) as ProductRow
  )

  const set = (field: keyof ProductRow, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{row ? 'Редактировать товар' : 'Добавить товар'}</h2>
        <div className="form-grid">
          {FIELDS.map(f => (
            <label key={f}>
              <span>{f}:</span>
              <input
                type="text"
                value={form[f]}
                onChange={e => set(f, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onCancel} className="btn-cancel">Отмена</button>
          <button onClick={() => onSave(form)} className="btn-save">
            {row ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create editor styles**

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 16px 0;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #333;
}
.form-grid input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}
.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.btn-cancel {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}
.btn-save {
  padding: 8px 16px;
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

---

### Task 5: App Shell with Token Setup

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/main.tsx`
- Modify: `index.html`

- [ ] **Step 1: Rewrite App.tsx with full flow**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { fetchCSV, commitCSV, OWNER, REPO } from './github/api'
import { parseCSV } from './csv/parse'
import { serializeCSV } from './csv/serialize'
import type { ProductRow } from './csv/types'
import ProductTable from './components/ProductTable'
import ProductEditor from './components/ProductEditor'
import './App.css'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('gh_token') || '')
  const [tokenInput, setTokenInput] = useState(token)
  const [rows, setRows] = useState<ProductRow[]>([])
  const [sha, setSha] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editorRow, setEditorRow] = useState<ProductRow | null>(undefined)
  const [editIndex, setEditIndex] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true); setError('')
    try {
      const { content, sha: fileSha } = await fetchCSV(token)
      setRows(parseCSV(content))
      setSha(fileSha)
      setSuccess('Данные загружены')
    } catch (e: unknown) {
      setError('Ошибка загрузки: ' + (e instanceof Error ? e.message : 'неизвестная ошибка'))
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleSave = async (updated: ProductRow[]) => {
    if (!token) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const csv = serializeCSV(updated)
      await commitCSV(token, csv, sha, '[Admin] Обновление базы товаров')
      setSuccess('Изменения сохранены в GitHub!')
      await loadData()
    } catch (e: unknown) {
      setError('Ошибка сохранения: ' + (e instanceof Error ? e.message : 'неизвестная ошибка'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (index: number, row: ProductRow) => {
    setEditIndex(index)
    setEditorRow(row)
  }

  const handleAdd = () => {
    setEditIndex(null)
    setEditorRow({} as ProductRow)
  }

  const handleEditorSave = (row: ProductRow) => {
    const updated = [...rows]
    if (editIndex !== null) {
      updated[editIndex] = row
    } else {
      updated.push(row)
    }
    setRows(updated)
    setEditorRow(undefined)
  }

  const saveToGitHub = () => {
    if (!sha) {
      setError('Сначала загрузите данные из репозитория')
      return
    }
    handleSave(rows)
  }

  if (!token) {
    return (
      <div className="app">
        <div className="login">
          <h1>Admin Panel</h1>
          <p>Репозиторий: {OWNER}/{REPO}</p>
          <input
            type="password"
            placeholder="GitHub Personal Access Token"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
          />
          <button onClick={() => { setToken(tokenInput); localStorage.setItem('gh_token', tokenInput) }}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Admin Panel — {OWNER}/{REPO}</h1>
        <div className="header-actions">
          <span className={`status ${loading ? 'loading' : ''}`}>
            {loading ? 'Загрузка...' : success}
          </span>
          <button onClick={loadData} disabled={loading}>Обновить</button>
          <button onClick={saveToGitHub} disabled={saving || loading}>
            {saving ? 'Сохранение...' : '💾 Сохранить в GitHub'}
          </button>
          <button onClick={() => { setToken(''); localStorage.removeItem('gh_token') }}>
            Выйти
          </button>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      {rows.length > 0 ? (
        <ProductTable rows={rows} onEdit={handleEdit} onAdd={handleAdd} />
      ) : loading ? (
        <p>Загрузка данных...</p>
      ) : (
        <p>Нажмите "Обновить" для загрузки данных</p>
      )}
      {editorRow !== undefined && (
        <ProductEditor
          row={editorRow && Object.keys(editorRow).length > 0 ? editorRow : null}
          onSave={handleEditorSave}
          onCancel={() => setEditorRow(undefined)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update App.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; color: #333; }
.app { max-width: 1400px; margin: 0 auto; padding: 16px; }
header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ddd;
  flex-wrap: wrap; gap: 8px;
}
header h1 { font-size: 18px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.status { font-size: 12px; color: #666; }
.status.loading { color: #1a73e8; }
.error { background: #ffebee; color: #c62828; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 13px; }
.login {
  max-width: 400px; margin: 80px auto; text-align: center;
  display: flex; flex-direction: column; gap: 12px;
}
.login input { padding: 10px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; }
.login button { padding: 10px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer; }
```

- [ ] **Step 3: Update main.tsx to remove StrictMode (avoids double-render for dev)**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(<App />)
```

- [ ] **Step 4: Clear index.css body styles (handled in App.css)**

Leave `index.css` empty or minimal.

---

### Task 6: GitHub Actions Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create deploy workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
        working-directory: admin-panel
      - run: npm run build
        working-directory: admin-panel
        env:
          VITE_GITHUB_OWNER: ${{ vars.VITE_GITHUB_OWNER }}
          VITE_GITHUB_REPO: ${{ vars.VITE_GITHUB_REPO }}
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: admin-panel/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Update vite.config.ts for Pages base path**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin-panel/',
})
```

---

### Task 7: Consumer Apps (Readme Update)

**Files:**
- Modify: `../README.md` (or create if needed)

- [ ] **Step 1: Update consumer README with new data source URL**

```markdown
# Database Repository

Centralized product database shared across Web App and Android App.

## Data Source

`db.csv` — single source of truth.

### For Web App
Replace local CSV path with:
```
https://raw.githubusercontent.com/{owner}/{repo}/main/db.csv
```

### For Android App
Fetch CSV from the same raw URL on sync.
```
GET https://raw.githubusercontent.com/{owner}/{repo}/main/db.csv
```

## Admin Panel

Located in `admin-panel/`. Deployed at: `https://{owner}.github.io/{repo}/admin-panel/`

See `admin-panel/README.md` for local development.
```

- [ ] **Step 2: Create admin-panel/README.md**

```markdown
# Admin Panel

React SPA for editing db.csv via GitHub API.

## Setup

1. Copy `.env.example` to `.env`
2. Fill in GitHub owner, repo, and PAT
3. Run `npm install`
4. Run `npm run dev`

## Deploy

Push to `main` — GitHub Actions auto-deploys to Pages.
```
```
```

---

### Task 8: Self-Review

- [ ] **Spec coverage check:** Architecture (GitHub-as-backend, Admin panel, consumers), data flow, constraints — all covered.
- [ ] **Placeholder scan:** No TODOs, TBDs, or vague steps.
- [ ] **Type consistency:** `ProductRow` fields match CSV columns throughout.
