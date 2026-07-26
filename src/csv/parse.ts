import Papa from 'papaparse'
import type { ProductRow } from './types'

export function parseCSV(text: string): ProductRow[] {
  const result = Papa.parse<ProductRow>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';',
  })
  return result.data
}
