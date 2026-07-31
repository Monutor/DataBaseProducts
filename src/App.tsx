import { useState, useCallback, useEffect } from 'react'
import { fetchPublicJSON, commitPublicJSON, fetchJSON, commitJSON } from './github/api'
import type { ProductRow } from './csv/types'
import ProductTable from './components/ProductTable'
import ProductEditor from './components/ProductEditor'
import ImportDialog from './components/ImportDialog'
import './App.css'

interface ImportHistoryEntry {
  id: string
  timestamp: number
  source: 'file' | 'sew'
  rowCount: number
}

const HISTORY_STORAGE_KEY = 'import_history'

function loadImportHistory(): ImportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ImportHistoryEntry[]
  } catch {
    return []
  }
}

function saveImportHistory(history: ImportHistoryEntry[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
}

function addImportEntry(source: 'file' | 'sew', rowCount: number) {
  const history = loadImportHistory()
  history.unshift({
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    source,
    rowCount,
  })
  saveImportHistory(history)
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

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
  const savedPw = getSavedPassword()
  const [adminMode, setAdminMode] = useState(() => IS_DEV)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [passwordInput, setPasswordInput] = useState(savedPw || '')
  const [passwordError, setPasswordError] = useState(false)
  const [remember, setRemember] = useState(!!savedPw)
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('gh_token') || '')
  const [ghTokenInput, setGhTokenInput] = useState('')
  const [sewToken, setSewTokenState] = useState(() => (localStorage.getItem('sew_token') || '').trim())
  const [sewTokenInput, setSewTokenInput] = useState('')
  const [rows, setRows] = useState<ProductRow[]>([])
  const [sha, setSha] = useState('')
  const [lastUpdatedDate, setLastUpdatedDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editorRow, setEditorRow] = useState<ProductRow | undefined>(undefined)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [sewLoading, setSewLoading] = useState(false)
  const [sewPreviewRows, setSewPreviewRows] = useState<ProductRow[]>([])
  const [showImportHistory, setShowImportHistory] = useState(false)
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>(loadImportHistory())

  const loadPublicData = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const content = await fetchPublicJSON()
      setRows(JSON.parse(content))
      setSuccess('Данные загружены')
    } catch (e: unknown) {
      setError('Ошибка загрузки: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAdminData = useCallback(async () => {
    if (!ghToken) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const { content, sha: fileSha, date } = await fetchJSON(ghToken)
      setRows(JSON.parse(content))
      setSha(fileSha)
      if (date) setLastUpdatedDate(date)
      setSuccess('Данные загружены')
    } catch (e: unknown) {
      setError('Ошибка загрузки: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'))
    } finally {
      setLoading(false)
    }
  }, [ghToken])

  useEffect(() => { loadPublicData() }, [loadPublicData])

  const handleSaveToGitHub = async (updated: ProductRow[]) => {
    if (!ghToken || !sha) {
      if (!sha) setError('Загрузите данные перед сохранением (нажмите Обновить в админ-режиме)')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await commitJSON(ghToken, JSON.stringify(updated, null, 2), sha, '[Admin] Обновление базы товаров')
      setSuccess('Изменения сохранены в GitHub!')
      const result = await fetchJSON(ghToken)
      setRows(JSON.parse(result.content))
      setSha(result.sha)
      if (result.date) setLastUpdatedDate(result.date)
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

  const handleImport = async (newRows: ProductRow[], source: 'file' | 'sew' = 'file') => {
    addImportEntry(source, newRows.length)
    setImportHistory(loadImportHistory())
    const updated = [...rows, ...newRows]
    setRows(updated)
    setShowImport(false)
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await commitPublicJSON(JSON.stringify(updated, null, 2), '[Import] Добавление товаров')
      setSuccess('Добавлено ' + newRows.length + ' ' + declension(newRows.length, ['товар', 'товара', 'товаров']))
    } catch (e: unknown) {
      setError('Ошибка сохранения: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'))
    } finally {
      setSaving(false)
    }
  }

  const handleSEWLoad = async () => {
    if (!sewToken.trim()) return
    
    setSewLoading(true)
    setSewPreviewRows([])

    const { fetchFromSEW } = await import('./shared/parser')
    const result = await fetchFromSEW(sewToken.trim())

    if (!result.success) {
      setError(result.error)
      setSewLoading(false)
      return
    }

    const existingArticles = new Set(rows.map(r => r['Код товара']?.trim()).filter(Boolean))
    const newRows = result.rows.filter((r: ProductRow) => {
      const code = r['Код товара']?.trim()
      return code && !existingArticles.has(code)
    })

    if (newRows.length === 0) {
      setError('Новых товаров не найдено. Все товары уже в базе.')
      setSewLoading(false)
      return
    }

    setSewPreviewRows(newRows)
    setSewLoading(false)
  }

  const doUnlock = () => {
    if (passwordInput !== ADMIN_PASSWORD) { setPasswordError(true); return }
    if (remember) {
      localStorage.setItem('admin_password', passwordInput)
      localStorage.setItem('admin_password_expires', String(Date.now() + PASSWORD_EXPIRY_MS))
    }
    setAdminMode(true)
    setShowAdminLogin(false)
    setPasswordInput('')
    if (ghToken) loadAdminData()
  }

  return (
    <div className="app">
      <header>
        <h1>База данных товаров магазина М.Видео</h1>
        <div className="header-actions">
          {success && <span className="status ok">{success}</span>}
          {loading && <span className="status loading">Загрузка...</span>}
          {saving && <span className="status loading">Сохранение...</span>}
          <button onClick={adminMode ? loadAdminData : loadPublicData} disabled={loading}>
            Обновить
          </button>
          <button onClick={() => setShowImport(true)} disabled={loading} className="btn-import">
            📥 Импорт
          </button>
          <button onClick={() => setShowImportHistory(true)} className="btn-history" title="История импортов">
            📋 История
          </button>
          <button className="btn-admin-toggle" onClick={() => { if (adminMode) { setAdminMode(false) } else if (IS_DEV) { setAdminMode(true) } else { setShowAdminLogin(true) } }}>
            ⚙️
          </button>
          {adminMode && (
            <>
              <button onClick={() => handleSaveToGitHub(rows)} disabled={saving || loading || rows.length === 0 || !ghToken || !sha} className="btn-save-github">
                💾 Сохранить в GitHub
              </button>
              <button onClick={handleSEWLoad} disabled={sewLoading || !sewToken.trim()} className="btn-sew-load" title="Загрузить данные с SEW API">
                {sewLoading ? '⏳' : '📥'} Загрузить с SEW
              </button>
              <div className="admin-token-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {ghToken ? (<><span style={{ fontSize:'12px', color:'#4caf50' }}>GH OK</span><button onClick={() => { setGhToken(''); localStorage.removeItem('gh_token'); setSha('') }} className="btn-clear-token">✕</button></>) : (<><input type="password" placeholder="GH Token" value={ghTokenInput} onChange={e => setGhTokenInput(e.target.value)} className="admin-token-input" autoComplete="new-password" /><button className="btn-token-save" onClick={() => { setGhToken(ghTokenInput); localStorage.setItem('gh_token', ghTokenInput); loadAdminData() }}>OK</button></>)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {sewToken ? (<><span style={{ fontSize:'12px', color:'#4caf50' }}>SEW OK</span><button onClick={() => { setSewTokenState(''); localStorage.removeItem('sew_token') }} className="btn-clear-token">✕</button></>) : (<><input type="password" placeholder="SEW Token" value={sewTokenInput} onChange={e => setSewTokenInput(e.target.value)} className="admin-token-input" autoComplete="new-password" style={{ width:'120px' }} /><button className="btn-token-save" onClick={() => { if (sewTokenInput.trim()) { localStorage.setItem('sew_token', sewTokenInput.trim()); setSewTokenState(sewTokenInput.trim()) } }}>OK</button></>)}
                </div>
              </div>
              <button className="btn-logout" onClick={() => { setAdminMode(false); setGhToken(''); setSewTokenState(''); localStorage.removeItem('gh_token'); localStorage.removeItem('sew_token') }}>
                Выйти
              </button>
            </>
          )}
        </div>
      </header>

      {error && sewPreviewRows.length === 0 && <div className="error">{error}</div>}

      {rows.length > 0 ? (
        <ProductTable rows={rows} onEdit={adminMode ? handleEdit : undefined} onAdd={adminMode ? handleAdd : undefined} />
      ) : loading ? (
        <p className="status-msg">Загрузка данных...</p>
      ) : (
        <div className="empty-state">
          <p>Нажмите «Обновить» для загрузки данных.</p>
          <button onClick={loadPublicData}>Обновить</button>
        </div>
      )}

      {adminMode && editorRow !== undefined && (
        <ProductEditor row={editorRow && Object.keys(editorRow).length > 0 ? editorRow : null} onSave={handleEditorSave} onCancel={() => setEditorRow(undefined)} />
      )}

      {showImport && <ImportDialog rows={rows} onConfirm={handleImport} onCancel={() => setShowImport(false)} />}

       {sewPreviewRows.length > 0 && (
        <div className="modal-overlay" onClick={() => setSewPreviewRows([])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSewPreviewRows([]) }}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Новые товары из SEW</h2>
              <button className="modal-close" onClick={() => setSewPreviewRows([])}>&times;</button>
            </div>
            <div className="import-results">
              <p className="import-status new">Найдено новых товаров: {sewPreviewRows.length}</p>
              <div className="new-products-section">
                <h3>Новые товары</h3>
                <div className="new-products-scroll">
                  <table className="new-products-table">
                    <thead>
                      <tr>
                        <th>Код товара</th>
                        <th>Наименование</th>
                        <th>Количество</th>
                        <th>Бренд</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sewPreviewRows.slice(0,200).map((r,i) => (
                        <tr key={`${r['Код товара'] || 'no-code'}-${i}`}>
                          <td>{r['Код товара']}</td>
                          <td>{r['Наименование']}</td>
                          <td>{r['Количество']}</td>
                          <td>{r['Бренд']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sewPreviewRows.length > 200 && <p className="hint">... и ещё {sewPreviewRows.length - 200} товаров</p>}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSewPreviewRows([])}>Отмена</button>
              <button className="btn-confirm" onClick={async () => {
                addImportEntry('sew', sewPreviewRows.length)
                setImportHistory(loadImportHistory())
                const updated = [...rows, ...sewPreviewRows]
                setRows(updated)
                setSewPreviewRows([])
                try {
                  setSaving(true); setError(''); setSuccess('')
                  await commitPublicJSON(JSON.stringify(updated, null, 2), '[Import] Добавление товаров из SEW')
                  setSuccess('Добавлено ' + sewPreviewRows.length + ' ' + declension(sewPreviewRows.length, ['товар', 'товара', 'товаров']))
                } catch (e: unknown) { setError('Ошибка сохранения: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'))
                } finally { setSaving(false) }
              }}>Добавить {sewPreviewRows.length} новых товаров</button>
            </div>
          </div>
        </div>
      )}

      {showImportHistory && (
        <div className="modal-overlay" onClick={() => setShowImportHistory(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowImportHistory(false) }}>
          <div className="modal import-history-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>История импортов</h2>
              <button className="modal-close" onClick={() => setShowImportHistory(false)}>&times;</button>
            </div>
            <div className="import-history-content">
              {importHistory.length === 0 ? (
                <p className="hint" style={{textAlign:'center',padding:'20px'}}>История пуста</p>
              ) : (
                <>
                  <p className="hint" style={{marginBottom:'12px'}}>Всего записей: {importHistory.length}</p>
                  <div className="import-history-list">
                    {importHistory.map(entry => (
                      <div key={entry.id} className="import-history-item">
                        <div className="history-source">
                          <span className={`source-badge source-${entry.source}`}>{entry.source === 'file' ? '📁 Файл' : '🌐 SEW'}</span>
                        </div>
                        <div className="history-details">
                          <span className="history-row-count">{entry.rowCount} {declension(entry.rowCount, ['товар','товара','товаров'])}</span>
                          <span className="history-time">{formatTimestamp(entry.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-danger" onClick={() => { if(window.confirm('Очистить всю историю импортов?')) { localStorage.removeItem(HISTORY_STORAGE_KEY); setImportHistory([]) }}}>Очистить</button>
              <button className="btn-cancel" onClick={() => setShowImportHistory(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="modal-overlay" onClick={() => { setShowAdminLogin(false); setPasswordError(false) }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowAdminLogin(false); setPasswordError(false) } }}>
          <div className="modal admin-login-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Вход в админ-панель</h2>
              <button className="modal-close" onClick={() => { setShowAdminLogin(false); setPasswordError(false) }}>&times;</button>
            </div>
            <div className="admin-login-content">
              <input type="password" placeholder="Пароль администратора" value={passwordInput} onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }} onKeyDown={e => { if(e.key === 'Enter') doUnlock() }} autoFocus aria-label="Пароль администратора" />
              {passwordError && <p className="hint" style={{ color:'#c62828', textAlign:'center' }}>Неверный пароль</p>}
              <label className="remember-row"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Запомнить пароль на 2 дня</label>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setShowAdminLogin(false); setPasswordError(false) }}>Отмена</button>
              <button className="btn-confirm" onClick={doUnlock}>Войти</button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        {lastUpdatedDate && <span>База обновлена: {formatISODate(lastUpdatedDate)}</span>}
      </footer>
    </div>
  )
}

function declension(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const lastDigit = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (lastDigit === 1) return forms[0]
  if (lastDigit >= 2 && lastDigit <= 4) return forms[1]
  return forms[2]
}

function formatISODate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
