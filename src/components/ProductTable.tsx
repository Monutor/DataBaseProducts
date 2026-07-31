import { useState, useMemo } from 'react'
import type { ProductRow } from '../csv/types'
import './ProductTable.css'

interface Props {
  rows: ProductRow[]
  onEdit?: (index: number, row: ProductRow) => void
  onAdd?: () => void
}

const PAGE_SIZE = 100

export default function ProductTable({ rows, onEdit, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<keyof ProductRow>('Код товара')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const terms = search.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    if (terms.length === 0) return rows
    return rows.filter(r =>
      terms.some(term =>
        String(r['Код товара'] || '').toLowerCase().includes(term) ||
        String(r['ШК товара'] || '').toLowerCase().includes(term)
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

  const handleSort = (key: keyof ProductRow) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)))

  const headers = Object.keys(rows[0] || {})

  return (
    <div className="table-container">
      <div className="toolbar">
        <label className="sr-only" htmlFor="product-search">Поиск</label>
        <input
          id="product-search"
          type="text"
          placeholder="Поиск по всем полям..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="search-input"
          aria-label="Поиск товаров"
        />
        {onAdd && (
          <button onClick={onAdd} className="btn-add">
            + Добавить товар
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map(key => (
                <th
                  key={key}
                  onClick={() => handleSort(key as keyof ProductRow)}
                  className="sortable"
                >
                  {key}{' '}
                  {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
              {onEdit && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => {
              const realIndex = rows.indexOf(row)
              return (
              <tr key={`${row['Код товара'] || 'no-code'}-${i}`}>
                {headers.map(h => (
                  <td key={h}>{row[h as keyof ProductRow]}</td>
                ))}
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
      <div className="pagination">
        <span className="row-count">
          Строк: {rows.length}
          {sorted.length < rows.length && ` (найдено ${sorted.length})`}
        </span>
        <div className="page-controls">
          <button disabled={page <= 1} onClick={() => goToPage(page - 1)}>◀</button>
          {getPageNumbers(page, totalPages).map((p, idx) => (
            <button key={typeof p === 'number' ? p : `e${idx}`} className={p === page ? 'page-active' : ''} onClick={() => typeof p === 'number' && goToPage(p)} disabled={typeof p !== 'number'}>
              {p}
            </button>
          ))}
          <button disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>▶</button>
        </div>
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
