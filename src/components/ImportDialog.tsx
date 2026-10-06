import { useState, useRef, useMemo, useEffect } from 'react'
import type { ProductRow } from '../csv/types'
import './ImportDialog.css'
import type { ParseResult } from '../shared/parser'
import { parseCSV, parseXLSX, filterNewRows, decodeCsvBuffer } from '../shared/parser'

interface Props {
  rows: ProductRow[]
  onConfirm: (newRows: ProductRow[]) => Promise<void>
  onCancel: () => void
}

const EXISTING_ARTICLE = 'Код товара'

function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

export default function ImportDialog({ rows, onConfirm, onCancel }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<ProductRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [parseError, setParseError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const existingArticles = useMemo(
    () => rows.map(r => (r[EXISTING_ARTICLE] ?? '').trim()).filter(Boolean),
    [rows]
  )

  const newRows = useMemo(
    () => (parsed ? filterNewRows(parsed, existingArticles) : []),
    [parsed, existingArticles]
  )

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const handleFile = async (file: File) => {
    setParseError('')
    setSaveError('')
    setParsed(null)
    setLoading(true)
    const ext = file.name.split('.').pop()?.toLowerCase()
    let result: ParseResult
    try {
      if (ext === 'csv') {
        const buffer = await readFileAsBuffer(file)
        result = await parseCSV(decodeCsvBuffer(buffer).text)
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await readFileAsBuffer(file)
        result = await parseXLSX(buffer)
      } else {
        setParseError('Поддерживаются только CSV и XLSX файлы')
        return
      }
      if (!result.success) {
        setParseError(result.error)
      } else {
        setParsed(result.rows)
      }
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : 'Не удалось прочитать файл')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!parsed || newRows.length === 0) return
    setSaveError('')
    setSaving(true)
    try {
      await onConfirm(newRows)
      setSaved(true)
      closeTimerRef.current = setTimeout(() => onCancel(), 1200)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Неизвестная ошибка')
    } finally {
      setSaving(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, saving])

  return (
    <div className="modal-overlay" onClick={saved || saving ? undefined : onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Импорт товаров</h2>
          {!saving && !saved && (
            <button type="button" className="modal-close" onClick={onCancel}>&times;</button>
          )}
        </div>

        {(!loading && !saving && !parsed) && (
          <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <p>Перетащите CSV или XLSX файл сюда</p>
            <p className="hint">или нажмите для выбора файла</p>
            <input
              ref={inputRef}
              id="import-file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              aria-label="Выбрать файл для импорта"
              onChange={onFileSelect}
            />
          </div>
        )}

        {loading && (
          <div className="progress-section">
            <p className="import-status">Парсинг файла…</p>
            <div className="progress-bar"><div className="progress-fill animating" /></div>
          </div>
        )}

        {parseError && <p className="import-error">{parseError}</p>}

        {parsed && !saving && (
          <>
            <div className="import-results">
              <p className="import-status ok">
                Загружено строк: {parsed.length}
              </p>
              <p className={`import-status ${newRows.length > 0 ? 'new' : 'ok'}`}>
                Из них новых товаров: {newRows.length}
              </p>

              {newRows.length > 0 && (
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
                        {newRows.slice(0, 200).map((r, i) => (
                          <tr key={`${r['Код товара'] || 'no-code'}-${i}`}>
                            <td>{r['Код товара']}</td>
                            <td>{r['Наименование']}</td>
                            <td>{r['Количество']}</td>
                            <td>{r['Бренд']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {newRows.length > 200 && (
                      <p className="hint">... и ещё {newRows.length - 200} товаров</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {saving && (
          <div className="progress-section">
            <p className="import-status">Сохранение в репозиторий…</p>
            <div className="progress-bar"><div className="progress-fill animating" /></div>
          </div>
        )}

        {saved && (
          <div className="progress-section">
            <p className="import-status ok">✓ Сохранено! ({newRows.length} товаров добавлено)</p>
          </div>
        )}

        {saveError && (
          <div className="progress-section">
            <p className="import-error">Ошибка сохранения: {saveError}</p>
          </div>
        )}

        {!saving && !saved && (
          <div className="modal-actions">
            <button className="btn-cancel" onClick={onCancel}>Отмена</button>
            <button
              className="btn-confirm"
              disabled={!parsed || newRows.length === 0}
              onClick={handleConfirm}
            >
              {newRows.length > 0
                ? `Добавить ${newRows.length} новых товаров`
                : parsed ? 'Новых товаров нет' : 'Импортировать'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
