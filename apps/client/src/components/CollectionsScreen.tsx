import { useState, useEffect, useRef } from 'react'
import { API_BASE } from '../config/client'
import type { AuthUser } from '../types/auth'

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
      if (!res.ok) throw new Error('Failed to load collections')
      const data = (await res.json()) as CollectionEntry[]
      setCollections(data)
    } catch {
      setListError('Could not load collections.')
    } finally {
      setListLoading(false)
    }
  }

  // ── Create collection ─────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim()) { setCreateError('Name is required.'); return }
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
      setCreateError('Network error.')
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
      if (!res.ok) throw new Error('Failed to load words')
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
      setWordsSaveMsg('Failed to save.')
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
              ← Back
            </button>
            <h2 className="collectionsPanelTitle">{openCollection.name}</h2>
          </div>
          {openCollection.description && (
            <p className="collectionsWordEditorDesc">{openCollection.description}</p>
          )}
          <p className="collectionsWordEditorMeta">
            Difficulty: <strong>{openCollection.difficulty}</strong> &nbsp;·&nbsp;
            Words: <strong>{openCollection.amountOfCards}</strong>
          </p>

          {wordsLoading ? (
            <p className="collectionsMsg">Loading words…</p>
          ) : (
            <>
              <label className="collectionsLabel" htmlFor="wordsTextarea">
                Words <span className="collectionsLabelHint">(one per line)</span>
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
                  {wordsSaving ? 'Saving…' : 'Save words'}
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
          <p className="collectionsMsg">Loading…</p>
        ) : listError ? (
          <p className="collectionsMsg collectionsError">{listError}</p>
        ) : collections.length === 0 ? (
          <p className="collectionsMsg collectionsEmpty">No collections yet. Create one below.</p>
        ) : (
          <div className="collectionsTableWrap">
            <table className="collectionsTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="collectionsTableCenter">Difficulty</th>
                  <th className="collectionsTableCenter">Words</th>
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
                        title="Delete collection"
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
          <h3 className="collectionsCreateTitle">New collection</h3>
          <form className="collectionsCreateForm" onSubmit={(e) => { void handleCreate(e) }}>
            <div className="collectionsFormRow">
              <label className="collectionsLabel" htmlFor="colName">Name</label>
              <input
                id="colName"
                className="collectionsInput"
                type="text"
                maxLength={128}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="My collection"
              />
            </div>
            <div className="collectionsFormRow">
              <label className="collectionsLabel" htmlFor="colDesc">Description</label>
              <input
                id="colDesc"
                className="collectionsInput"
                type="text"
                maxLength={500}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="collectionsFormRow collectionsFormRowInline">
              <label className="collectionsLabel" htmlFor="colDiff">Difficulty</label>
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
              {creating ? 'Creating…' : 'Create collection'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
