import { useState, useMemo, useEffect, useRef } from 'react'
import type { ProductRow } from '../csv/types'
import './ProductTable.css'

interface Props {
  rows: ProductRow[]
  onEdit?: (index: number, row: ProductRow) => void
  onAdd?: () => void
}

const PAGE_SIZE = 100
const COLUMN_ORDER_KEY = 'column_order'
const DEFAULT_COLUMN_ORDER: (keyof ProductRow)[] = [
  'Магазин', 'Зона', 'Ячейки хранения', 'ШК ячейки хранения', 'Код товара',
  'Наименование', 'Количество', 'Тип', 'Этикетка', 'Группа 5', 'Группа 4',
  'Группа 3', 'Группа 2', 'Группа 1', 'Бренд', 'ШК товара', 'Компонент',
  'STOPSALE', 'ONLINE-ONLY', 'Маркетплейс', 'Маркированный',
  'Время создания МСК', 'Последнее изменение МСК',
]

function loadColumnOrder(): (keyof ProductRow)[] | null {
  try {
    const raw = localStorage.getItem(COLUMN_ORDER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as (keyof ProductRow)[]
  } catch {
    return null
  }
}

function saveColumnOrder(order: (keyof ProductRow)[]) {
  localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order))
}

function highlight(text: string, query: string): string {
  if (!query.trim()) return escapeHtml(text)
  const escaped = escapeHtml(text)
  const qEscaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${qEscaped})`, 'gi')
  return escaped.replace(regex, '<mark class="search-hl">$1</mark>')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function ProductTable({ rows, onEdit, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLTextAreaElement>(null)
  const [sortKey, setSortKey] = useState<keyof ProductRow>('Код товара')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const [columnOrder, setColumnOrder] = useState<(keyof ProductRow)[]>([])

  useEffect(() => {
    const saved = loadColumnOrder()
    if (saved && saved.length > 0) {
      setColumnOrder(saved)
      return
    }
    if (rows.length === 0) return
    const existing = new Set(Object.keys(rows[0]!))
    const filtered = DEFAULT_COLUMN_ORDER.filter(k => existing.has(k)) as (keyof ProductRow)[]
    setColumnOrder(filtered)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length])

  useEffect(() => {
    const el = searchRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [search])

  const headers = columnOrder.filter(h => Object.keys(rows[0] || {}).includes(h))

  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null)

  const handleSort = (key: keyof ProductRow) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const addSearchTerm = (term: string) => {
    if (!term.trim()) return
    const currentTerms = search.split(',').map(t => t.trim()).filter(Boolean)
    const idx = currentTerms.indexOf(term)
    if (idx >= 0) {
      currentTerms.splice(idx, 1)
    } else {
      currentTerms.push(term)
    }
    setSearch(currentTerms.join(', '))
    setPage(1)
  }

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)))

  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, idx: number) => {
    e.dataTransfer.effectAllowed = 'move'
    ;(e.target as HTMLTableCellElement).style.opacity = '0.4'
    setDragSourceIndex(idx)
    setDragTargetIndex(null)
  }

  const handleDragEnd = (e: React.DragEvent<HTMLTableCellElement>) => {
    ;(e.target as HTMLTableCellElement).style.opacity = '1'
    setDragSourceIndex(null)
    setDragTargetIndex(null)
  }

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragTargetIndex(idx)
  }

  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault()
    const from = dragSourceIndex
    const to = dragTargetIndex
    if (from === null || to === null || from === to) return

    const next = [...columnOrder]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)

    for (const k of Object.keys(rows[0] || {}) as (keyof ProductRow)[]) {
      if (!next.includes(k) && !DEFAULT_COLUMN_ORDER.includes(k)) next.push(k)
    }

    setColumnOrder(next)
    saveColumnOrder(next)
    setDragSourceIndex(null)
    setDragTargetIndex(null)
  }

  const resetColumns = () => {
    const filtered = DEFAULT_COLUMN_ORDER.filter(k => Object.keys(rows[0] || {}).includes(k)) as (keyof ProductRow)[]
    setColumnOrder(filtered)
    saveColumnOrder(filtered)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const terms = search.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    if (terms.length === 0) return rows
    return rows.filter(r =>
      terms.every(term =>
        Object.values(r).some(v => String(v || '').toLowerCase().includes(term))
      )
    )
  }, [rows, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] || ''
      const bv = b[sortKey] || ''
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return sorted.slice(start, start + PAGE_SIZE)
  }, [sorted, page])

  const hasCustomOrder = columnOrder.some((h, i) => h !== DEFAULT_COLUMN_ORDER[i]) || columnOrder.length !== DEFAULT_COLUMN_ORDER.filter(k => Object.keys(rows[0] || {}).includes(k)).length

  return (
    <div className="table-container">
      <div className="toolbar">
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <textarea
            ref={searchRef}
            id="product-search"
            placeholder="Название, код или бренд… (через запятую для нескольких)"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="search-input"
            aria-label="Поиск товаров"
          />
          {search && <button className="btn-clear-search" onClick={() => { setSearch(''); setPage(1) }} title="Очистить поиск">✕</button>}
        </div>
        <div className="stats">
          <span className="stat-badge stat-badge-total">Всего: {rows.length.toLocaleString('ru-RU')}</span>
          {sorted.length < rows.length && (
            <span className="stat-badge stat-badge-found">Найдено: {sorted.length}</span>
          )}
        </div>
        {onAdd && (
          <button onClick={onAdd} className="btn-add">
            + Добавить товар
          </button>
        )}
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {headers.map((key, idx) => (
                  <th
                    key={key}
                    draggable
                    onClick={() => handleSort(key)}
                    onDragStart={e => handleDragStart(e as unknown as React.DragEvent<HTMLTableCellElement>, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => handleDragOver(e as unknown as React.DragEvent<HTMLTableCellElement>, idx)}
                    onDrop={handleDrop}
                    className={[
                      'sortable',
                      dragTargetIndex === idx ? 'drag-target' : '',
                      dragSourceIndex === idx ? 'dragging' : '',
                      sortKey === key ? 'sorted' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="col-handle" title="Перетащите для изменения порядка">⠿</span>
                    {key}{' '}
                    {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                ))}
                {onEdit && <th className="col-actions"></th>}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, i) => {
                const realIndex = rows.indexOf(row)
                return (
                  <tr key={`${row['Код товара'] || 'no-code'}-${i}`}>
                    {headers.map(h => {
                      const val = String(row[h as keyof ProductRow] ?? '')
                      const cellText = String(val ?? '')
                      if (h === 'STOPSALE') {
                        return (
                          <td key={h} onClick={() => addSearchTerm(cellText)} className="clickable-cell" title="Нажмите, чтобы добавить в поиск">
                            {cellText === 'Да'
                              ? <span className="badge-yes badge-stop">Да</span>
                              : cellText}
                          </td>
                        )
                      }
                      if (h === 'ONLINE-ONLY') {
                        return (
                          <td key={h} onClick={() => addSearchTerm(cellText)} className="clickable-cell" title="Нажмите, чтобы добавить в поиск">
                            {cellText === 'Да'
                              ? <span className="badge-yes badge-online">Да</span>
                              : cellText}
                          </td>
                        )
                      }
                      if (h === 'Код товара') {
                        return <td key={h} onClick={() => addSearchTerm(cellText)} className="clickable-cell" title="Нажмите, чтобы добавить в поиск" dangerouslySetInnerHTML={{ __html: highlight(val, search) }} />
                      }
                      if (search && !['STOPSALE', 'ONLINE-ONLY'].includes(h)) {
                        return <td key={h} onClick={() => addSearchTerm(cellText)} className="clickable-cell" title="Нажмите, чтобы добавить в поиск" dangerouslySetInnerHTML={{ __html: highlight(val, search) }} />
                      }
                      return <td key={h} onClick={() => addSearchTerm(cellText)} className="clickable-cell" title="Нажмите, чтобы добавить в поиск">{cellText}</td>
                    })}
                    {onEdit && (
                      <td>
                        <button
                          className="btn-edit"
                          onClick={() => onEdit(realIndex, row)}
                          title="Редактировать"
                        >
                          ✏️
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span className="row-count">
            Показано {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} из {sorted.length}
          </span>
          <div className="pagination">
            <button className="page-btn" disabled={page <= 1} onClick={() => goToPage(page - 1)}>‹</button>
            {getPageNumbers(page, totalPages).map((p, idx) => (
              <button key={typeof p === 'number' ? p : `e${idx}`} className={['page-btn', p === page ? 'page-active' : ''].filter(Boolean).join(' ')} onClick={() => typeof p === 'number' && goToPage(p)} disabled={typeof p !== 'number'}>
                {p}
              </button>
            ))}
            <button className="page-btn" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>›</button>
          </div>
        </div>

        {hasCustomOrder && (
          <div className="col-order-bar">
            <span>Нажмите на заголовок для сортировки · Перетаскивайте заголовки для изменения порядка колонок</span>
            <button onClick={resetColumns} className="btn-reset-cols" title="Сбросить порядок колонок">↺ Сбросить</button>
          </div>
        )}
      </div>
    </div>
  )
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | string)[] = []
  if (current <= 4) {
    for (let i = 1; i <= Math.min(5, total); i++) pages.push(i)
    if (total > 6) { pages.push('...'); pages.push(total) }
  } else if (current >= total - 3) {
    pages.push(1); pages.push('...')
    for (let i = Math.max(total - 4, 1); i <= total; i++) pages.push(i)
  } else {
    pages.push(1); pages.push('...')
    pages.push(current - 1); pages.push(current); pages.push(current + 1)
    pages.push('...'); pages.push(total)
  }
  return pages
}
