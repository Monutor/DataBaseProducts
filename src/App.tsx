import { useState, useCallback } from 'react'
import { fetchCSV, commitCSV, OWNER, REPO } from './github/api'
import { parseCSV } from './csv/parse'
import { serializeCSV } from './csv/serialize'
import type { ProductRow } from './csv/types'
import ProductTable from './components/ProductTable'
import ProductEditor from './components/ProductEditor'
import './App.css'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || ''

export default function App() {
  const [unlocked, setUnlocked] = useState(!ADMIN_PASSWORD)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [token, setToken] = useState(() => localStorage.getItem('gh_token') || '')
  const [tokenInput, setTokenInput] = useState(token)
  const [rows, setRows] = useState<ProductRow[]>([])
  const [sha, setSha] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editorRow, setEditorRow] = useState<ProductRow | undefined>(undefined)
  const [editIndex, setEditIndex] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const { content, sha: fileSha } = await fetchCSV(token)
      setRows(parseCSV(content))
      setSha(fileSha)
      setSuccess('Данные загружены')
    } catch (e: unknown) {
      setError(
        'Ошибка загрузки: ' +
          (e instanceof Error ? e.message : 'Неизвестная ошибка')
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleSaveToGitHub = async (updated: ProductRow[]) => {
    if (!token || !sha) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const csv = serializeCSV(updated)
      await commitCSV(token, csv, sha, '[Admin] Обновление базы товаров')
      setSuccess('Изменения сохранены в GitHub!')
      const result = await fetchCSV(token)
      setRows(parseCSV(result.content))
      setSha(result.sha)
    } catch (e: unknown) {
      setError(
        'Ошибка сохранения: ' +
          (e instanceof Error ? e.message : 'Неизвестная ошибка')
      )
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

  if (!unlocked) {
    return (
      <div className="app">
        <div className="login">
          <h1>Admin Panel</h1>
          <input
            type="password"
            placeholder="Пароль администратора"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
            onKeyDown={e => { if (e.key === 'Enter' && passwordInput === ADMIN_PASSWORD) setUnlocked(true); else if (e.key === 'Enter') setPasswordError(true) }}
          />
          {passwordError && <p className="hint" style={{ color: '#c62828' }}>Неверный пароль</p>}
          <button onClick={() => { if (passwordInput === ADMIN_PASSWORD) setUnlocked(true); else setPasswordError(true) }}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="app">
        <div className="login">
          <h1>Admin Panel</h1>
          <p className="repo-label">
            Репозиторий: {OWNER}/{REPO}
          </p>
          <input
            type="password"
            placeholder="GitHub Personal Access Token"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
          />
          <button
            onClick={() => {
              setToken(tokenInput)
              localStorage.setItem('gh_token', tokenInput)
            }}
          >
            Войти
          </button>
          <p className="hint">
            Токен хранится только в localStorage вашего браузера
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>
          {OWNER}/{REPO}
        </h1>
        <div className="header-actions">
          {success && <span className="status ok">{success}</span>}
          {loading && <span className="status loading">Загрузка...</span>}
          {saving && <span className="status loading">Сохранение...</span>}
          <button onClick={loadData} disabled={loading}>
            Обновить
          </button>
          <button
            onClick={() => handleSaveToGitHub(rows)}
            disabled={saving || loading || rows.length === 0}
            className="btn-save-github"
          >
            💾 Сохранить в GitHub
          </button>
          <button
            className="btn-logout"
            onClick={() => {
              setToken('')
              localStorage.removeItem('gh_token')
            }}
          >
            Выйти
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {rows.length > 0 ? (
        <ProductTable rows={rows} onEdit={handleEdit} onAdd={handleAdd} />
      ) : loading ? (
        <p className="status-msg">Загрузка данных...</p>
      ) : (
        <div className="empty-state">
          <p>Нажмите «Обновить» для загрузки данных из репозитория.</p>
          <button onClick={loadData}>Обновить</button>
        </div>
      )}

      {editorRow !== undefined && (
        <ProductEditor
          row={
            editorRow && Object.keys(editorRow).length > 0 ? editorRow : null
          }
          onSave={handleEditorSave}
          onCancel={() => setEditorRow(undefined)}
        />
      )}
    </div>
  )
}
