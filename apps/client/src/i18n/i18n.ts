// тип языка - только en или ru
export type Lang = 'en' | 'ru'

// ключ в localStorage для хранения выбранного языка
const STORAGE_KEY = 'alias_lang'

// определяем язык браузера автоматически
function detectBrowserLang(): Lang {
  const nav = navigator.language || (navigator as { userLanguage?: string }).userLanguage || ''
  return nav.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

// получаем текущий язык из localStorage или определяем по браузеру
export function getLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'ru') return stored
  const detected = detectBrowserLang()
  localStorage.setItem(STORAGE_KEY, detected)
  return detected
}

// переключаем язык и перезагружаем страницу
export function setLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang)
  window.location.reload()
}

// текущий язык, определяется один раз при загрузке модуля
export const currentLang: Lang = getLang()
