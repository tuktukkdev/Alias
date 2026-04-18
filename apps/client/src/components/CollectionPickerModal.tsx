import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../config/client'
import { fetchDefaultCollectionsRequest } from '../services/roomApi'
import type { SelectedCollection } from '../types/game'
import { ts } from '../i18n'
import './CollectionPickerModal.css'

// запись коллекции для отображения
interface CollectionEntry {
  id: number
  name: string
  description: string | null
  difficulty: number
  amountOfCards: number
  tags?: string[]
}

interface Props {
  userId: number | null
  selected: SelectedCollection[]
  onConfirm: (collections: SelectedCollection[]) => void
  onCancel: () => void
}

// проверка совпадения коллекции с поисковым запросом
function matchesSearch(c: CollectionEntry, query: string): boolean {
  if (!query.trim()) return true
  const terms = query.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
  return terms.every((term) => {
    // difficulty: "1", "2", "3"
    if (/^[123]$/.test(term) && c.difficulty === Number(term)) return true
    if (c.name.toLowerCase().includes(term)) return true
    if (c.description?.toLowerCase().includes(term)) return true
    if (c.tags?.some((tag) => tag.toLowerCase().includes(term))) return true
    return false
  })
}

// модалка выбора коллекций слов
export function CollectionPickerModal({ userId, selected, onConfirm, onCancel }: Props) {
  // списки дефолтных и пользовательских коллекций
  const [defaultCollections, setDefaultCollections] = useState<CollectionEntry[]>([])
  const [customCollections, setCustomCollections] = useState<CollectionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<SelectedCollection[]>(selected ?? [])
  const [search, setSearch] = useState('')

  useEffect(() => {
    void loadAll()
  }, [])

  // загрузка всех коллекций с сервера
  async function loadAll() {
    setLoading(true)
    try {
      const [defRes, custRes] = await Promise.all([
        fetchDefaultCollectionsRequest(),
        userId ? fetch(`${API_BASE}/collections/${userId}`) : Promise.resolve(null),
      ])
      if (defRes.ok) setDefaultCollections((await defRes.json()) as CollectionEntry[])
      if (custRes && custRes.ok) setCustomCollections((await custRes.json()) as CollectionEntry[])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  // проверяем выбрана ли коллекция
  function isSelected(id: number, type: 'default' | 'custom') {
    return draft.some((c) => c.id === id && c.type === type)
  }

  // переключаем выбор коллекции
  function toggle(id: number, type: 'default' | 'custom') {
    setDraft((prev) =>
      isSelected(id, type) ? prev.filter((c) => !(c.id === id && c.type === type)) : [...prev, { id, type }],
    )
  }

  // фильтрация по поиску
  const filteredDefault = useMemo(() => defaultCollections.filter((c) => matchesSearch(c, search)), [defaultCollections, search])
  const filteredCustom = useMemo(() => customCollections.filter((c) => matchesSearch(c, search)), [customCollections, search])

  const totalWords = [...defaultCollections, ...customCollections]
    .filter((c) => {
      const type = defaultCollections.includes(c) ? 'default' : 'custom'
      return draft.some((s) => s.id === c.id && s.type === type)
    })
    .reduce((sum, c) => sum + c.amountOfCards, 0)

  return (
    <div className="pickerOverlay" onClick={onCancel}>
      <div className="pickerPanel" onClick={(e) => e.stopPropagation()}>
        <h2 className="pickerTitle">{ts('picker.title')}</h2>

        <input
          className="pickerSearch"
          type="text"
          placeholder={ts('picker.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {loading ? (
          <p className="pickerEmpty">{ts('picker.loading')}</p>
        ) : (
          <>
            <div className="pickerSection">
              <h3 className="pickerSectionTitle">{ts('picker.defaultCollections')}</h3>
              {defaultCollections.length === 0 ? (
                <p className="pickerEmpty">{ts('picker.noDefault')}</p>
              ) : filteredDefault.length === 0 ? (
                <p className="pickerEmpty">{ts('picker.noMatches')}</p>
              ) : (
                <ul className="pickerList">
                  {filteredDefault.map((c) => (
                    <li key={`d-${c.id}`} className="pickerItem" onClick={() => toggle(c.id, 'default')}>
                      <input type="checkbox" checked={isSelected(c.id, 'default')} readOnly />
                      <div className="pickerItemInfo">
                        <span className="pickerItemName">{c.name}</span>
                        <span className="pickerItemMeta">
                          {ts('collections.difficulty')} {c.difficulty} · {c.amountOfCards} {ts('collections.words').toLowerCase()}
                          {c.tags && c.tags.length > 0 && ` · ${c.tags.join(', ')}`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {userId && (
              <div className="pickerSection">
                <h3 className="pickerSectionTitle">{ts('picker.yourCollections')}</h3>
                {customCollections.length === 0 ? (
                  <p className="pickerEmpty">{ts('picker.noCustom')}</p>
                ) : filteredCustom.length === 0 ? (
                  <p className="pickerEmpty">{ts('picker.noMatches')}</p>
                ) : (
                  <ul className="pickerList">
                    {filteredCustom.map((c) => (
                      <li key={`c-${c.id}`} className="pickerItem" onClick={() => toggle(c.id, 'custom')}>
                        <input type="checkbox" checked={isSelected(c.id, 'custom')} readOnly />
                        <div className="pickerItemInfo">
                          <span className="pickerItemName">{c.name}</span>
                          <span className="pickerItemMeta">
                            {ts('collections.difficulty')} {c.difficulty} · {c.amountOfCards} {ts('collections.words').toLowerCase()}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {draft.length > 0 && totalWords < 100 && (
              <p className="pickerWarning">
                {ts('picker.warning').replace('{count}', String(totalWords))}
              </p>
            )}
          </>
        )}

        <div className="pickerActions">
          <button type="button" className="pickerBtn pickerBtnCancel" onClick={onCancel}>
            {ts('picker.cancel')}
          </button>
          <button type="button" className="pickerBtn pickerBtnConfirm" onClick={() => onConfirm(draft)}>
            {ts('picker.confirm')} {draft.length > 0 ? `(${draft.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
