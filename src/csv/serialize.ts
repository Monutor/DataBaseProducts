import Papa from 'papaparse'
import type { ProductRow } from './types'

const HEADER =
  'Магазин;Зона;Ячейки хранения;ШК ячейки хранения;Код товара;Наименование;Количество;Тип;Этикетка;Группа 5;Группа 4;Группа 3;Группа 2;Группа 1;Бренд;ШК товара;Компонент;STOPSALE;ONLINE-ONLY;Маркетплейс;Маркированный;Время создания МСК;Последнее изменение МСК'

export function serializeCSV(rows: ProductRow[]): string {
  const body = Papa.unparse(rows, {
    delimiter: ';',
    header: false,
  })
  return HEADER + '\r\n' + body
}

export { HEADER }
