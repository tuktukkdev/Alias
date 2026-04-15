import { useState, useEffect, useRef } from 'react'
import { API_BASE } from '../config/client'
import type { AuthUser } from '../types/auth'
import { ts } from '../i18n'
import './CollectionsScreen.css'

interface CollectionEntry {
  id: number
  name: string
  description: string | null
  difficulty: number
  amountOfCards: number
}

interface WordEntry {
  id: number
  word: string
}

interface Props {
  user: AuthUser
  onBack: () => void
}

export default function CollectionsScreen({ user, onBack }: Props) {
  const userId = parseInt(user.id, 10)

  // ── List view state ────────────────────────────────────────────────────────
  const [collections, setCollections] = useState<CollectionEntry[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // ── Create form state ─────────────────────────────────────────────────────
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createDiff, setCreateDiff] = useState(1)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // ── Word editor state ─────────────────────────────────────────────────────
  const [openCollection, setOpenCollection] = useState<CollectionEntry | null>(null)
  const [, setWords] = useState<WordEntry[]>([])
  const [wordsLoading, setWordsLoading] = useState(false)
  const [wordsText, setWordsText] = useState('')
  const [wordsSaving, setWordsSaving] = useState(false)
  const [wordsSaveMsg, setWordsSaveMsg] = useState<string | null>(null)
  const saveMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load collections ───────────────────────────────────────────────────────
  useEffect(() => {
    void loadCollections()
  }, [])

  async function loadCollections() {
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetch(`${API_BASE}/collections/${userId}`)
      if (!res.ok) throw new Error('load_fail')
      const data = (await res.json()) as CollectionEntry[]
      setCollections(data)
    } catch {
      setListError(ts('collections.loadError'))
    } finally {
      setListLoading(false)
    }
  }

  // ── Create collection ─────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim()) { setCreateError(ts('collections.nameRequired')); return }
    setCreateError(null)
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: createName.trim(), description: createDesc.trim() || null, difficulty: createDiff }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        setCreateError(err.error ?? 'Failed to create collection')
        return
      }
      const col = (await res.json()) as CollectionEntry
      setCollections((prev) => [...prev, col])
      setCreateName('')
      setCreateDesc('')
      setCreateDiff(1)
    } catch {
      setCreateError(ts('collections.networkError'))
    } finally {
      setCreating(false)
    }
  }

  // ── Delete collection ─────────────────────────────────────────────────────
  async function handleDelete(colId: number) {
    try {
      const res = await fetch(`${API_BASE}/collections/${colId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) return
      setCollections((prev) => prev.filter((c) => c.id !== colId))
      if (openCollection?.id === colId) setOpenCollection(null)
    } catch {
      // ignore
    }
  }

  // ── Open word editor ──────────────────────────────────────────────────────
  async function handleOpenCollection(col: CollectionEntry) {
    setOpenCollection(col)
    setWordsLoading(true)
    setWordsSaveMsg(null)
    try {
      const res = await fetch(`${API_BASE}/collections/${col.id}/words?userId=${userId}`)
      if (!res.ok) throw new Error('load_words_fail')
      const data = (await res.json()) as WordEntry[]
      setWords(data)
      setWordsText(data.map((w) => w.word).join('\n'))
    } catch {
      setWords([])
      setWordsText('')
    } finally {
      setWordsLoading(false)
    }
  }

  // ── Save words ────────────────────────────────────────────────────────────
  async function handleSaveWords() {
    if (!openCollection) return
    setWordsSaving(true)
    setWordsSaveMsg(null)
    const wordList = wordsText
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
    try {
      const res = await fetch(`${API_BASE}/collections/${openCollection.id}/words`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, words: wordList }),
      })
      if (!res.ok) throw new Error('Failed to save words')
      const data = (await res.json()) as { count: number }
      // update local collection count
      setCollections((prev) =>
        prev.map((c) =>
          c.id === openCollection.id ? { ...c, amountOfCards: data.count } : c
        )
      )
      setOpenCollection((prev) => (prev ? { ...prev, amountOfCards: data.count } : prev))
      setWordsSaveMsg(`Saved ${data.count} word${data.count !== 1 ? 's' : ''}.`)
      if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current)
      saveMsgTimer.current = setTimeout(() => setWordsSaveMsg(null), 3000)
    } catch {
      setWordsSaveMsg(ts('collections.saveFailed'))
    } finally {
      setWordsSaving(false)
    }
  }

  // ── Word editor view ───────────────────────────────────────────────────────
  if (openCollection) {
    return (
      <main className="collectionsScreen">
        <div className="collectionsPanel">
          <div className="collectionsPanelHeader">
            <button className="collectionsBackBtn" onClick={() => setOpenCollection(null)}>
              {ts('collections.back')}
            </button>
            <h2 className="collectionsPanelTitle">{openCollection.name}</h2>
          </div>
          {openCollection.description && (
            <p className="collectionsWordEditorDesc">{openCollection.description}</p>
          )}
          <p className="collectionsWordEditorMeta">
            {ts('collections.difficulty')}: <strong>{openCollection.difficulty}</strong> &nbsp;·&nbsp;
            {ts('collections.words')}: <strong>{openCollection.amountOfCards}</strong>
          </p>

          {wordsLoading ? (
            <p className="collectionsMsg">{ts('collections.loadingWords')}</p>
          ) : (
            <>
              <label className="collectionsLabel" htmlFor="wordsTextarea">
                {ts('collections.wordsPerLine')} <span className="collectionsLabelHint">{ts('collections.wordsPerLineHint')}</span>
              </label>
              <textarea
                id="wordsTextarea"
                className="collectionsWordArea"
                value={wordsText}
                onChange={(e) => setWordsText(e.target.value)}
                placeholder="apple&#10;banana&#10;cherry"
                rows={16}
                spellCheck={false}
              />
              <div className="collectionsWordEditorActions">
                <button
                  className="collectionsBtn collectionsBtnPrimary"
                  onClick={() => { void handleSaveWords() }}
                  disabled={wordsSaving}
                >
                  {wordsSaving ? ts('collections.saving') : ts('collections.saveWords')}
                </button>
                {wordsSaveMsg && (
                  <span className={`collectionsWordsSaveMsg${wordsSaveMsg.startsWith('Failed') ? ' collectionsWordsSaveMsgError' : ''}`}>
                    {wordsSaveMsg}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <main className="collectionsScreen">
      <div className="collectionsPanel">
        <div className="collectionsPanelHeader">
          <button className="collectionsBackBtn" onClick={onBack}>
            ← Back
          </button>
          <h2 className="collectionsPanelTitle">Custom Collections</h2>
        </div>

        {listLoading ? (
          <p className="collectionsMsg">{ts('collections.loading')}</p>
        ) : listError ? (
          <p className="collectionsMsg collectionsError">{listError}</p>
        ) : collections.length === 0 ? (
          <p className="collectionsMsg collectionsEmpty">{ts('collections.empty')}</p>
        ) : (
          <div className="collectionsTableWrap">
            <table className="collectionsTable">
              <thead>
                <tr>
                  <th>{ts('collections.name')}</th>
                  <th>{ts('collections.description')}</th>
                  <th className="collectionsTableCenter">{ts('collections.difficulty')}</th>
                  <th className="collectionsTableCenter">{ts('collections.words')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {collections.map((col) => (
                  <tr
                    key={col.id}
                    className="collectionsTableRow"
                    onClick={() => { void handleOpenCollection(col) }}
                  >
                    <td className="collectionsTableName">{col.name}</td>
                    <td className="collectionsTableDesc">{col.description ?? '—'}</td>
                    <td className="collectionsTableCenter">{col.difficulty}</td>
                    <td className="collectionsTableCenter">{col.amountOfCards}</td>
                    <td className="collectionsTableActions">
                      <button
                        className="collectionsDeleteBtn"
                        onClick={(e) => { e.stopPropagation(); void handleDelete(col.id) }}
                        title={ts('collections.deleteTitle')}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create form */}
        <div className="collectionsCreateSection">
          <h3 className="collectionsCreateTitle">{ts('collections.newCollection')}</h3>
          <form className="collectionsCreateForm" onSubmit={(e) => { void handleCreate(e) }}>
            <div className="collectionsFormRow">
              <label className="collectionsLabel" htmlFor="colName">{ts('collections.name')}</label>
              <input
                id="colName"
                className="collectionsInput"
                type="text"
                maxLength={128}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={ts('collections.namePlaceholder')}
              />
            </div>
            <div className="collectionsFormRow">
              <label className="collectionsLabel" htmlFor="colDesc">{ts('collections.description')}</label>
              <input
                id="colDesc"
                className="collectionsInput"
                type="text"
                maxLength={500}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder={ts('collections.descPlaceholder')}
              />
            </div>
            <div className="collectionsFormRow collectionsFormRowInline">
              <label className="collectionsLabel" htmlFor="colDiff">{ts('collections.difficulty')}</label>
              <input
                id="colDiff"
                className="collectionsInputSmall"
                type="number"
                min={1}
                max={10}
                value={createDiff}
                onChange={(e) => setCreateDiff(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
              />
            </div>
            {createError && <p className="collectionsFormError">{createError}</p>}
            <button
              className="collectionsBtn collectionsBtnPrimary"
              type="submit"
              disabled={creating}
            >
              {creating ? ts('collections.creating') : ts('collections.createCollection')}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
