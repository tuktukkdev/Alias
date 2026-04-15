export type Lang = 'en' | 'ru'

const STORAGE_KEY = 'alias_lang'

function detectBrowserLang(): Lang {
  const nav = navigator.language || (navigator as { userLanguage?: string }).userLanguage || ''
  return nav.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function getLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'ru') return stored
  const detected = detectBrowserLang()
  localStorage.setItem(STORAGE_KEY, detected)
  return detected
}

export function setLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang)
  window.location.reload()
}

/** Current language, resolved once on module load */
export const currentLang: Lang = getLang()
