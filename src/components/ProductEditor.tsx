import { useState } from 'react'
import type { ProductRow } from '../csv/types'
import './ProductEditor.css'

interface Props {
  row: ProductRow | null
  onSave: (row: ProductRow) => void
  onCancel: () => void
}

const FIELDS: (keyof ProductRow)[] = [
  'Магазин',
  'Зона',
  'Ячейки хранения',
  'ШК ячейки хранения',
  'Код товара',
  'Наименование',
  'Количество',
  'Тип',
  'Этикетка',
  'Группа 5',
  'Группа 4',
  'Группа 3',
  'Группа 2',
  'Группа 1',
  'Бренд',
  'ШК товара',
  'Компонент',
  'STOPSALE',
  'ONLINE-ONLY',
  'Маркетплейс',
  'Маркированный',
]

const TIMESTAMP_FIELDS: (keyof ProductRow)[] = [
  'Время создания МСК',
  'Последнее изменение МСК',
]

export default function ProductEditor({ row, onSave, onCancel }: Props) {
  const emptyRow = Object.fromEntries(
    [...FIELDS, ...TIMESTAMP_FIELDS].map(f => [f, ''])
  ) as unknown as ProductRow

  const [form, setForm] = useState<ProductRow>(() => {
    if (row) return { ...row }
    const now = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return { ...emptyRow, 'Время создания МСК': now, 'Последнее изменение МСК': now }
  })

  const set = (field: keyof ProductRow, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = () => {
    const now = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    onSave({ ...form, 'Последнее изменение МСК': now })
  }

  return (
    <div className="modal-overlay" onClick={onCancel} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCancel() }}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
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
        {row && (
          <div className="timestamps">
            <small>
              Создан: {form['Время создания МСК']} | Изменён:{' '}
              {form['Последнее изменение МСК']}
            </small>
          </div>
        )}
        <div className="modal-actions">
          <button onClick={onCancel} className="btn-cancel">
            Отмена
          </button>
          <button onClick={handleSave} className="btn-save">
            {row ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}
