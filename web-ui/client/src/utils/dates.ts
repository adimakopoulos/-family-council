import i18n from '../i18n'
import { enUS, el as elLocale } from 'date-fns/locale'

export function dfLocale() {
  return i18n.language.startsWith('el') ? elLocale : enUS
}

/** For <input type="datetime-local" /> */
export function toLocalInput(dt: Date) {
  const z = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:mm"
}
