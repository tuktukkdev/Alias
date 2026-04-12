import { useEffect, useState } from 'react'
import { API_BASE } from '../config/client'
import type { AuthUser } from '../types/auth'

interface FriendEntry {
  id: number
  username: string
}

interface FriendsData {
  friends: FriendEntry[]
  pending: FriendEntry[]
  sent: FriendEntry[]
}

interface FriendsScreenProps {
  user: AuthUser
  onBack: () => void
  onPendingCountChange: (count: number) => void
}

export function FriendsScreen({ user, onBack, onPendingCountChange }: FriendsScreenProps) {
  const [data, setData] = useState<FriendsData>({ friends: [], pending: [], sent: [] })
  const [loading, setLoading] = useState(true)
  const [sendInput, setSendInput] = useState('')
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [joinStatus, setJoinStatus] = useState<Record<number, 'loading' | 'not_in_lobby'>>({})

  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE}/friends/${user.id}`)
      if (!res.ok) return
      const json = (await res.json()) as FriendsData
      setData(json)
      onPendingCountChange(json.pending.length)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [user.id])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const username = sendInput.trim()
    if (!username) return
    setSending(true)
    setSendStatus(null)
    try {
      const res = await fetch(`${API_BASE}/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(user.id), username }),
      })
      if (res.status === 404) {
        setSendStatus({ type: 'error', text: 'Username not found.' })
        return
      }
      if (res.status === 409) {
        const body = (await res.json()) as { error: string }
        setSendStatus({ type: 'error', text: body.error })
        return
      }
      if (!res.ok) {
        const body = (await res.json()) as { error: string }
        setSendStatus({ type: 'error', text: body.error ?? 'Failed to send request.' })
        return
      }
      setSendStatus({ type: 'success', text: `Friend request sent to ${username}.` })
      setSendInput('')
      void loadData()
    } catch {
      setSendStatus({ type: 'error', text: 'Could not reach the server.' })
    } finally {
      setSending(false)
    }
  }

  const handleAccept = async (fromId: number) => {
    await fetch(`${API_BASE}/friends/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(user.id), fromId }),
    })
    void loadData()
  }

  const handleDecline = async (fromId: number) => {
    await fetch(`${API_BASE}/friends/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(user.id), fromId }),
    })
    void loadData()
  }

  const handleCancel = async (toId: number) => {
    await fetch(`${API_BASE}/friends/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(user.id), toId }),
    })
    void loadData()
  }

  const handleRemove = async (friendId: number) => {
    await fetch(`${API_BASE}/friends/remove`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(user.id), friendId }),
    })
    void loadData()
  }

  const handleJoin = async (friendId: number) => {
    setJoinStatus((prev) => ({ ...prev, [friendId]: 'loading' }))
    try {
      const res = await fetch(`${API_BASE}/players/${friendId}/room`)
      if (res.status === 404) {
        setJoinStatus((prev) => ({ ...prev, [friendId]: 'not_in_lobby' }))
        setTimeout(() => setJoinStatus((prev) => { const next = { ...prev }; delete next[friendId]; return next }), 2500)
        return
      }
      const data = (await res.json()) as { roomId: string }
      window.location.href = `/room/${data.roomId}`
    } catch {
      setJoinStatus((prev) => ({ ...prev, [friendId]: 'not_in_lobby' }))
      setTimeout(() => setJoinStatus((prev) => { const next = { ...prev }; delete next[friendId]; return next }), 2500)
    }
  }

  return (
    <main className="screen">
      <section className="panel friendsPanel">
        <div className="profileHeader">
          <button type="button" className="backButton" onClick={onBack}>
            ← Back
          </button>
          <h1 className="title">Friends</h1>
        </div>

        {loading ? (
          <p className="hintText">Loading…</p>
        ) : (
          <>
            {/* Pending section */}
            <div className="friendsSection">
              <h2 className="sectionTitle">
                Pending
                {data.pending.length > 0 && (
                  <span className="friendsBadgeInline">{data.pending.length}</span>
                )}
              </h2>
              {data.pending.length === 0 ? (
                <p className="hintText">No pending requests.</p>
              ) : (
                <ul className="friendsList">
                  {data.pending.map((p) => (
                    <li key={p.id} className="friendsItem">
                      <span className="friendsName">{p.username}</span>
                      <div className="friendsActions">
                        <button
                          type="button"
                          className="friendsAcceptBtn"
                          onClick={() => void handleAccept(p.id)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="friendsDeclineBtn"
                          onClick={() => void handleDecline(p.id)}
                        >
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Friends section */}
            <div className="friendsSection">
              <h2 className="sectionTitle">Friends ({data.friends.length})</h2>
              {data.friends.length === 0 ? (
                <p className="hintText">No friends yet.</p>
              ) : (
                <ul className="friendsList">
                  {data.friends.map((f) => (
                    <li key={f.id} className="friendsItem">
                      <span className="friendsName">{f.username}</span>
                      <div className="friendsActions">
                        <button
                          type="button"
                          className="friendsJoinBtn"
                          disabled={joinStatus[f.id] === 'loading'}
                          onClick={() => void handleJoin(f.id)}
                        >
                          {joinStatus[f.id] === 'loading' ? '…' : 'Join'}
                        </button>
                        {joinStatus[f.id] === 'not_in_lobby' && (
                          <span className="friendsJoinHint">Not in a lobby</span>
                        )}
                        <button
                          type="button"
                          className="friendsRemoveBtn"
                          onClick={() => void handleRemove(f.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sent section */}
            <div className="friendsSection">
              <h2 className="sectionTitle">Sent</h2>
              {data.sent.length === 0 ? (
                <p className="hintText">No outgoing requests.</p>
              ) : (
                <ul className="friendsList">
                  {data.sent.map((s) => (
                    <li key={s.id} className="friendsItem">
                      <span className="friendsName">{s.username}</span>
                      <button
                        type="button"
                        className="friendsDeclineBtn"
                        onClick={() => void handleCancel(s.id)}
                      >
                        Cancel
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Send request */}
        <form className="friendsSendForm" onSubmit={(e) => void handleSend(e)}>
          <input
            className="input"
            type="text"
            placeholder="Username"
            value={sendInput}
            maxLength={64}
            onChange={(e) => setSendInput(e.target.value)}
          />
          <button type="submit" className="playButton" disabled={sending || !sendInput.trim()}>
            {sending ? '…' : 'Send'}
          </button>
        </form>
        {sendStatus && (
          <p className={sendStatus.type === 'success' ? 'formSuccess' : 'formError'}>
            {sendStatus.text}
          </p>
        )}
      </section>
    </main>
  )
}
