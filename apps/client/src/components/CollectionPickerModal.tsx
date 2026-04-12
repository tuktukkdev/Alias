import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../config/client'
import { fetchDefaultCollectionsRequest } from '../services/roomApi'
import type { SelectedCollection } from '../types/game'
import './CollectionPickerModal.css'

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

export function CollectionPickerModal({ userId, selected, onConfirm, onCancel }: Props) {
  const [defaultCollections, setDefaultCollections] = useState<CollectionEntry[]>([])
  const [customCollections, setCustomCollections] = useState<CollectionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<SelectedCollection[]>(selected ?? [])
  const [search, setSearch] = useState('')

  useEffect(() => {
    void loadAll()
  }, [])

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

  function isSelected(id: number, type: 'default' | 'custom') {
    return draft.some((c) => c.id === id && c.type === type)
  }

  function toggle(id: number, type: 'default' | 'custom') {
    setDraft((prev) =>
      isSelected(id, type) ? prev.filter((c) => !(c.id === id && c.type === type)) : [...prev, { id, type }],
    )
  }

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
        <h2 className="pickerTitle">Choose Collections</h2>

        <input
          className="pickerSearch"
          type="text"
          placeholder="Search by name, description, difficulty (1–3), or tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {loading ? (
          <p className="pickerEmpty">Loading...</p>
        ) : (
          <>
            <div className="pickerSection">
              <h3 className="pickerSectionTitle">Default Collections</h3>
              {defaultCollections.length === 0 ? (
                <p className="pickerEmpty">No default collections available.</p>
              ) : filteredDefault.length === 0 ? (
                <p className="pickerEmpty">No matches.</p>
              ) : (
                <ul className="pickerList">
                  {filteredDefault.map((c) => (
                    <li key={`d-${c.id}`} className="pickerItem" onClick={() => toggle(c.id, 'default')}>
                      <input type="checkbox" checked={isSelected(c.id, 'default')} readOnly />
                      <div className="pickerItemInfo">
                        <span className="pickerItemName">{c.name}</span>
                        <span className="pickerItemMeta">
                          Difficulty {c.difficulty} · {c.amountOfCards} words
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
                <h3 className="pickerSectionTitle">Your Collections</h3>
                {customCollections.length === 0 ? (
                  <p className="pickerEmpty">No custom collections yet.</p>
                ) : filteredCustom.length === 0 ? (
                  <p className="pickerEmpty">No matches.</p>
                ) : (
                  <ul className="pickerList">
                    {filteredCustom.map((c) => (
                      <li key={`c-${c.id}`} className="pickerItem" onClick={() => toggle(c.id, 'custom')}>
                        <input type="checkbox" checked={isSelected(c.id, 'custom')} readOnly />
                        <div className="pickerItemInfo">
                          <span className="pickerItemName">{c.name}</span>
                          <span className="pickerItemMeta">
                            Difficulty {c.difficulty} · {c.amountOfCards} words
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
                Selected collections have only {totalWords} words (less than 100). The game may reuse words or fall back to default cards.
              </p>
            )}
          </>
        )}

        <div className="pickerActions">
          <button type="button" className="pickerBtn pickerBtnCancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="pickerBtn pickerBtnConfirm" onClick={() => onConfirm(draft)}>
            Confirm {draft.length > 0 ? `(${draft.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
