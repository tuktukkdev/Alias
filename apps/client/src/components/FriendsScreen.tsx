import { useEffect, useState } from 'react'
import { API_BASE } from '../config/client'
import type { AuthUser } from '../types/auth'
import { ts } from '../i18n'
import './FriendsScreen.css'

// запись о друге — id и имя
interface FriendEntry {
  id: number
  username: string
}

// все данные по друзьям: список, входящие и исходящие запросы
interface FriendsData {
  friends: FriendEntry[]
  pending: FriendEntry[]
  sent: FriendEntry[]
}

// пропсы экрана друзей — юзер, назад и колбэк на кол-во входящих
interface FriendsScreenProps {
  user: AuthUser
  onBack: () => void
  onPendingCountChange: (count: number) => void
}

// основной экран друзей — поиск, запросы, список
export function FriendsScreen({ user, onBack, onPendingCountChange }: FriendsScreenProps) {
  // стейты — данные друзей, загрузка, ввод, статусы отправки и джойна
  const [data, setData] = useState<FriendsData>({ friends: [], pending: [], sent: [] })
  const [loading, setLoading] = useState(true)
  const [sendInput, setSendInput] = useState('')
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [joinStatus, setJoinStatus] = useState<Record<number, 'loading' | 'not_in_lobby'>>({})

  // загрузка списка друзей и запросов с сервера
  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE}/friends/${user.id}`)
      if (!res.ok) return
      const json = (await res.json()) as FriendsData
      setData(json)
      onPendingCountChange(json.pending.length)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  // при монтировании грузим данные
  useEffect(() => {
    void loadData()
  }, [user.id])

  // отправка запроса в друзья по юзернейму
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
        setSendStatus({ type: 'error', text: ts('friends.userNotFound') })
        return
      }
      if (res.status === 409) {
        const body = (await res.json()) as { error: string }
        setSendStatus({ type: 'error', text: body.error })
        return
      }
      if (!res.ok) {
        const body = (await res.json()) as { error: string }
        setSendStatus({ type: 'error', text: body.error ?? ts('friends.sendFailed') })
        return
      }
      setSendStatus({ type: 'success', text: ts('friends.requestSent').replace('{name}', username) })
      setSendInput('')
      void loadData()
    } catch {
      setSendStatus({ type: 'error', text: ts('friends.serverError') })
    } finally {
      setSending(false)
    }
  }

  // принять входящий запрос
  const handleAccept = async (fromId: number) => {
    await fetch(`${API_BASE}/friends/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(user.id), fromId }),
    })
    void loadData()
  }

  // отклонить входящий запрос
  const handleDecline = async (fromId: number) => {
    await fetch(`${API_BASE}/friends/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(user.id), fromId }),
    })
    void loadData()
  }

  // отменить свой исходящий запрос
  const handleCancel = async (toId: number) => {
    await fetch(`${API_BASE}/friends/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(user.id), toId }),
    })
    void loadData()
  }

  // удалить друга из списка
  const handleRemove = async (friendId: number) => {
    await fetch(`${API_BASE}/friends/remove`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(user.id), friendId }),
    })
    void loadData()
  }

  // зайти в комнату к другу если он в лобби
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
            {ts('friends.back')}
          </button>
          <h1 className="title">{ts('friends.title')}</h1>
        </div>

        {loading ? (
          <p className="hintText">{ts('friends.loading')}</p>
        ) : (
          <>
            {/* входящие запросы */}
            <div className="friendsSection">
              <h2 className="sectionTitle">
                {ts('friends.pending')}
                {data.pending.length > 0 && (
                  <span className="friendsBadgeInline">{data.pending.length}</span>
                )}
              </h2>
              {data.pending.length === 0 ? (
                <p className="hintText">{ts('friends.noPending')}</p>
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
                          {ts('friends.accept')}
                        </button>
                        <button
                          type="button"
                          className="friendsDeclineBtn"
                          onClick={() => void handleDecline(p.id)}
                        >
                          {ts('friends.decline')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* список друзей */}
            <div className="friendsSection">
              <h2 className="sectionTitle">{ts('friends.friendsCount').replace('{count}', String(data.friends.length))}</h2>
              {data.friends.length === 0 ? (
                <p className="hintText">{ts('friends.noFriends')}</p>
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
                          {joinStatus[f.id] === 'loading' ? '…' : ts('friends.join')}
                        </button>
                        {joinStatus[f.id] === 'not_in_lobby' && (
                          <span className="friendsJoinHint">{ts('friends.notInLobby')}</span>
                        )}
                        <button
                          type="button"
                          className="friendsRemoveBtn"
                          onClick={() => void handleRemove(f.id)}
                        >
                          {ts('friends.remove')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* исходящие запросы */}
            <div className="friendsSection">
              <h2 className="sectionTitle">{ts('friends.sent')}</h2>
              {data.sent.length === 0 ? (
                <p className="hintText">{ts('friends.noSent')}</p>
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
                        {ts('friends.cancel')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* форма отправки запроса */}
        <form className="friendsSendForm" onSubmit={(e) => void handleSend(e)}>
          <input
            className="input"
            type="text"
            placeholder={ts('friends.usernamePlaceholder')}
            value={sendInput}
            maxLength={64}
            onChange={(e) => setSendInput(e.target.value)}
          />
          <button type="submit" className="playButton" disabled={sending || !sendInput.trim()}>
            {sending ? '…' : ts('friends.send')}
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
