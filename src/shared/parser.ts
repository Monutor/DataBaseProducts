import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ProductRow } from '../csv/types'

export const PRODUCT_ROW_KEYS: (keyof ProductRow)[] = [
  'Магазин', 'Зона', 'Ячейки хранения', 'ШК ячейки хранения', 'Код товара',
  'Наименование', 'Количество', 'Тип', 'Этикетка', 'Группа 5', 'Группа 4',
  'Группа 3', 'Группа 2', 'Группа 1', 'Бренд', 'ШК товара', 'Компонент',
  'STOPSALE', 'ONLINE-ONLY', 'Маркетплейс', 'Маркированный', 'Время создания МСК',
  'Последнее изменение МСК',
]

export function parseToProductRows(data: Record<string, string>[]): ProductRow[] {
  const sampleKeys = Object.keys(data[0] || {})
  const keyMap: Record<string, keyof ProductRow> = {}
  for (const k of PRODUCT_ROW_KEYS) {
    const match = sampleKeys.find(s => s.trim() === k.trim())
    if (match) keyMap[match] = k
  }
  return data.map(row => {
    const out: ProductRow = {} as ProductRow
    for (const destKey of PRODUCT_ROW_KEYS) {
      ;(out as any)[destKey] = ''
    }
    for (const [srcKey, destKey] of Object.entries(keyMap)) {
      const val = row[srcKey]
      ;(out as any)[destKey] = val != null ? String(val) : ''
    }
    return out
  })
}

export type ParseResult = {
  success: true
  rows: ProductRow[]
} | {
  success: false
  error: string
}

export async function parseCSV(text: string): Promise<ParseResult> {
  return new Promise(resolve => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        if (results.errors.length > 0) {
          resolve({ success: false, error: results.errors[0].message })
          return
        }
        const rows = parseToProductRows(results.data as Record<string, string>[])
        resolve({ success: true, rows })
      },
      error(err: Error) {
        resolve({ success: false, error: err.message })
      },
    })
  })
}

export async function parseXLSX(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellText: true, cellNF: false, WTF: false })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { success: false, error: 'Файл не содержит листов' }
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: true })
    if (data.length === 0) return { success: false, error: 'Файл не содержит данных' }
    const rows = parseToProductRows(data)
    return { success: true, rows }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Ошибка парсинга XLSX' }
  }
}

export async function fetchFromSEW(token: string): Promise<ParseResult> {
  try {
    const response = await fetch(
      'https://sew.mvideoeldorado.ru/v2/api/stockmanagement/report/stock-balance?objectId=S187',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Неверный токен авторизации (401)' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Доступ запрещён (403). Проверьте права SEW.' }
      }
      if (response.status >= 500) {
        return { success: false, error: `Ошибка сервера SEW (${response.status})` }
      }
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
    }

    const contentType = response.headers.get('content-type') || ''
    const arrayBuffer = await response.arrayBuffer()

    if (contentType.includes('json')) {
      return { success: false, error: `SEW вернул JSON. Content-Type: ${contentType}` }
    }

    // Try XLSX first, then CSV as fallback
    try {
      const result = await parseXLSX(arrayBuffer)
      if (result.success && result.rows.length > 0) return result
    } catch {
      // Fall through to CSV
    }

    // Try CSV parsing
    try {
      const text = new TextDecoder().decode(arrayBuffer)
      return await parseCSV(text)
    } catch {
      return { success: false, error: 'Не удалось распознать формат ответа. Ожидался XLSX или CSV.' }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return { success: false, error: `Ошибка сети. Возможно CORS: ${message}` }
    }
    return { success: false, error: message }
  }
}
