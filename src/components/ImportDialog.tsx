import { useState, useRef, useMemo } from 'react'
import type { ProductRow } from '../csv/types'
import './ImportDialog.css'
import type { ParseResult } from '../shared/parser'

interface Props {
  rows: ProductRow[]
  onConfirm: (newRows: ProductRow[]) => void
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
  const inputRef = useRef<HTMLInputElement>(null)

  const existingArticles = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const code = r[EXISTING_ARTICLE]
      if (code) set.add(code.trim())
    }
    return set
  }, [rows])

  const newRows = useMemo(() => {
    if (!parsed) return []
    return parsed.filter(r => {
      const code = r[EXISTING_ARTICLE]
      return code && !existingArticles.has(code.trim())
    })
  }, [parsed, existingArticles])

  const handleFile = async (file: File) => {
    setParseError('')
    setParsed(null)
    setLoading(true)
    const ext = file.name.split('.').pop()?.toLowerCase()
    let result: ParseResult
    if (ext === 'csv') {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsText(file, 'utf-8')
      })
      result = await (await import('../shared/parser')).parseCSV(text)
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await readFileAsBuffer(file)
      result = await (await import('../shared/parser')).parseXLSX(buffer)
    } else {
      setParseError('Поддерживаются только CSV и XLSX файлы')
      setLoading(false)
      return
    }
    if (!result.success) {
      setParseError(result.error)
    } else {
      setParsed(result.rows)
    }
    setLoading(false)
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

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Импорт товаров</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>

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
            type="file"
            accept=".csv,.xlsx,.xls"
            hidden
            onChange={onFileSelect}
          />
        </div>

        {loading && <p className="import-status">Парсинг файла...</p>}
        {parseError && <p className="import-error">{parseError}</p>}

        {parsed && (
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
                        <tr key={i}>
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
        )}

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>Отмена</button>
          <button
            className="btn-confirm"
            disabled={!parsed || newRows.length === 0}
            onClick={() => onConfirm(newRows)}
          >
            {newRows.length > 0
              ? `Добавить ${newRows.length} новых товаров`
              : parsed ? 'Новых товаров нет' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  )
}
