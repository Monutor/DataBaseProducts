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

function buildKeyMap(data: Record<string, string>[]): Record<string, keyof ProductRow> {
  const sampleKeys = Object.keys(data[0] || {})
  const keyMap: Record<string, keyof ProductRow> = {}
  for (const k of PRODUCT_ROW_KEYS) {
    const match = sampleKeys.find(s => s.trim() === k.trim())
    if (match) keyMap[match] = k
  }
  return keyMap
}

export function mappedHeaderCount(data: Record<string, string>[]): number {
  return Object.keys(buildKeyMap(data)).length
}

export function validateHeaders(data: Record<string, string>[]): string | null {
  if (data.length === 0) return 'Файл не содержит данных (только заголовки или пустые строки)'
  const keys = Object.keys(data[0] || {})
  if (keys.length === 0) return null
  const mapped = new Set<keyof ProductRow>(Object.values(buildKeyMap(data)))
  if (mapped.size === 0) {
    return 'Не распознан ни один заголовок. Ожидаются названия колонок вида «Код товара», «Наименование», «Бренд». В файле: ' + keys.slice(0, 8).join(', ')
  }
  if (!mapped.has('Код товара')) {
    return 'В файле нет обязательной колонки «Код товара» — без неё товары невозможно распознать. Распознанные колонки: ' + [...mapped].slice(0, 10).join(', ')
  }
  return null
}

function formatDate(d: Date): string {
  const r = new Date(Math.round(d.getTime() / 1000) * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const hasTime = r.getHours() !== 0 || r.getMinutes() !== 0 || r.getSeconds() !== 0
  const time = hasTime ? ` ${pad(r.getHours())}:${pad(r.getMinutes())}:${pad(r.getSeconds())}` : ''
  return `${pad(r.getDate())}.${pad(r.getMonth() + 1)}.${r.getFullYear()}${time}`
}

function formatCellValue(val: unknown): string {
  if (val == null) return ''
  if (val instanceof Date) return formatDate(val)
  return String(val)
}

export function parseToProductRows(data: Record<string, string>[]): ProductRow[] {
  const keyMap = buildKeyMap(data)
  return data.map(row => {
    const out: ProductRow = {} as ProductRow
    for (const destKey of PRODUCT_ROW_KEYS) {
      ;(out as any)[destKey] = ''
    }
    for (const [srcKey, destKey] of Object.entries(keyMap)) {
      ;(out as any)[destKey] = formatCellValue(row[srcKey])
    }
    return out
  })
}

export function filterNewRows(parsed: ProductRow[], existingCodes: Iterable<string>): ProductRow[] {
  const seen = new Set<string>()
  for (const code of existingCodes) {
    const trimmed = (code ?? '').trim()
    if (trimmed) seen.add(trimmed)
  }
  const result: ProductRow[] = []
  for (const row of parsed) {
    const code = (row['Код товара'] ?? '').trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    result.push(row)
  }
  return result
}

export type ParseResult = {
  success: true
  rows: ProductRow[]
} | {
  success: false
  error: string
}

// Ошибки структуры CSV блокируют импорт; расхождения по числу колонок в отдельных
// строках — нет, они не мешают разбору и молча обрезаются движком.
const FATAL_CSV_ERROR_CODES = new Set([
  'UndetectableDelimiter',
  'Delimiter',
  'IncorrectQuotes',
  'MissingQuotes',
  'InvalidQuotes',
  'Quotes',
])

export function decodeCsvBuffer(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8 (BOM)' }
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16 LE' }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16 BE' }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' }
  } catch {
    return { text: new TextDecoder('windows-1251').decode(bytes), encoding: 'Windows-1251' }
  }
}

export async function parseCSV(text: string): Promise<ParseResult> {
  return new Promise(resolve => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const fatal = results.errors.find(e => FATAL_CSV_ERROR_CODES.has(e.code))
        if (fatal) {
          const where = fatal.row != null ? ` (строка ${fatal.row + 1})` : ''
          resolve({ success: false, error: fatal.message + where })
          return
        }
        const data = results.data as Record<string, string>[]
        const headerError = validateHeaders(data)
        if (headerError) {
          resolve({ success: false, error: headerError })
          return
        }
        resolve({ success: true, rows: parseToProductRows(data) })
      },
      error(err: Error) {
        resolve({ success: false, error: err.message })
      },
    })
  })
}

export async function parseXLSX(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellText: true, cellNF: false, WTF: false })
    if (workbook.SheetNames.length === 0) return { success: false, error: 'Файл не содержит листов' }

    const sheets = workbook.SheetNames
      .map(name => ({
        name,
        data: XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[name], { defval: '', raw: true }),
      }))
      .filter(s => s.data.length > 0)

    if (sheets.length === 0) return { success: false, error: 'Файл не содержит данных' }

    const chosen = sheets.find(s => mappedHeaderCount(s.data) > 0) ?? sheets[0]
    const headerError = validateHeaders(chosen.data)
    if (headerError) {
      return { success: false, error: `Лист «${chosen.name}»: ${headerError}` }
    }
    return { success: true, rows: parseToProductRows(chosen.data) }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Ошибка парсинга XLSX' }
  }
}

function isXlsxBuffer(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength))
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return true
  return bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
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
      const text = new TextDecoder().decode(arrayBuffer)
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        return { success: false, error: `SEW вернул ответ, который не является JSON: ${text.slice(0, 500)}` }
      }
      const fileData = (json as { responseBody?: { fileData?: unknown } })?.responseBody?.fileData
      if (typeof fileData !== 'string' || fileData.length === 0) {
        return { success: false, error: `SEW вернул JSON без fileData. Ответ: ${text.slice(0, 500)}` }
      }
      let bytes: Uint8Array
      try {
        const binary = atob(fileData)
        bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      } catch (e: unknown) {
        return { success: false, error: `Не удалось декодировать base64 из ответа SEW: ${e instanceof Error ? e.message : 'неизвестная ошибка'}` }
      }
      return parseXLSX(bytes.buffer as ArrayBuffer)
    }

    if (isXlsxBuffer(arrayBuffer)) return parseXLSX(arrayBuffer)

    const { text } = decodeCsvBuffer(arrayBuffer)
    return parseCSV(text)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return { success: false, error: `Ошибка сети. Возможно CORS: ${message}` }
    }
    return { success: false, error: message }
  }
}
