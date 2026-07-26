import { useState, useCallback, useEffect } from 'react'
import { fetchJSON, commitJSON, OWNER, REPO } from './github/api'
import type { ProductRow } from './csv/types'
import ProductTable from './components/ProductTable'
import ProductEditor from './components/ProductEditor'
import ImportDialog from './components/ImportDialog'
import './App.css'

const IS_DEV = import.meta.env.DEV
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || ''

const PASSWORD_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000 // 2 days

function getSavedPassword(): string | null {
  const saved = localStorage.getItem('admin_password')
  const expires = localStorage.getItem('admin_password_expires')
  if (saved && expires && Date.now() < Number(expires)) return saved
  localStorage.removeItem('admin_password')
  localStorage.removeItem('admin_password_expires')
  return null
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => IS_DEV ? true : (!ADMIN_PASSWORD || !!getSavedPassword()))
  const [passwordInput, setPasswordInput] = useState(getSavedPassword() || '')
  const [passwordError, setPasswordError] = useState(false)
  const [remember, setRemember] = useState(!!getSavedPassword())
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
  const [showImport, setShowImport] = useState(false)

  const loadData = useCallback(async () => {
    if (!IS_DEV && !token) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const { content, sha: fileSha } = await fetchJSON(token)
      setRows(JSON.parse(content))
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
  }, [token, IS_DEV])

  useEffect(() => {
    if (IS_DEV) loadData()
  }, [loadData, IS_DEV])

  const handleSaveToGitHub = async (updated: ProductRow[]) => {
    if (!IS_DEV && (!token || !sha)) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await commitJSON(token, JSON.stringify(updated, null, 2), sha, '[Admin] Обновление базы товаров')
      setSuccess('Изменения сохранены в GitHub!')
      const result = await fetchJSON(token)
      setRows(JSON.parse(result.content))
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

  const handleImport = (newRows: ProductRow[]) => {
    setRows(prev => [...prev, ...newRows])
    setShowImport(false)
    setSuccess(`Добавлено ${newRows.length} новых товаров`)
  }

  const doUnlock = () => {
    if (passwordInput !== ADMIN_PASSWORD) { setPasswordError(true); return }
    if (remember) {
      localStorage.setItem('admin_password', passwordInput)
      localStorage.setItem('admin_password_expires', String(Date.now() + PASSWORD_EXPIRY_MS))
    }
    setUnlocked(true)
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
            onKeyDown={e => { if (e.key === 'Enter') doUnlock() }}
          />
          {passwordError && <p className="hint" style={{ color: '#c62828' }}>Неверный пароль</p>}
          <label className="remember-row">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            Запомнить пароль на 2 дня
          </label>
          <button onClick={doUnlock}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  if (!IS_DEV && !token) {
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
            onClick={() => setShowImport(true)}
            disabled={loading}
            className="btn-import"
          >
            📥 Импорт
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

      {showImport && (
        <ImportDialog
          rows={rows}
          onConfirm={handleImport}
          onCancel={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
