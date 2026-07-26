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

  const handleSort = (key: keyof ProductRow) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const headers = Object.keys(rows[0] || {})

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
        <button onClick={onAdd} className="btn-add">
          + Добавить товар
        </button>
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
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i}>
                {headers.map(h => (
                  <td key={h}>{row[h as keyof ProductRow]}</td>
                ))}
                <td>
                  <button
                    className="btn-edit"
                    onClick={() => onEdit(i, row)}
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-count">
        {rows.length} строк | Показано: {sorted.length}
        {sorted.length < rows.length && ` (отфильтровано ${rows.length - sorted.length})`}
      </div>
    </div>
  )
}
