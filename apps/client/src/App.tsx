import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

interface Player {
  id: string
  name: string
  score: number
}

interface GameRoomSettings {
  timer: number
  winScore: number
}

interface GameRoom {
  players: Player[]
  hostId: string
  settings: GameRoomSettings
}

interface RoomState {
  roomId: string
  room: GameRoom
  started?: boolean
}

interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  text: string
  createdAt: string
}

interface StoredRoomSession {
  roomId: string
  playerId: string
  name: string
}

const API_BASE = 'http://localhost:3000'
const ROOM_PATH_PREFIX = '/room/'
const SESSION_STORAGE_KEY = 'alias-room-session'

const getRoomCodeFromPath = (pathName: string): string => {
  if (!pathName.startsWith(ROOM_PATH_PREFIX)) {
    return ''
  }

  const rawCode = pathName.slice(ROOM_PATH_PREFIX.length)
  return decodeURIComponent(rawCode).trim()
}

const getStoredRoomSession = (): StoredRoomSession | null => {
  try {
    const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredRoomSession>
    if (!parsed.roomId || !parsed.playerId || !parsed.name) {
      return null
    }

    return {
      roomId: parsed.roomId,
      playerId: parsed.playerId,
      name: parsed.name,
    }
  } catch {
    return null
  }
}

const setStoredRoomSession = (session: StoredRoomSession): void => {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

const clearStoredRoomSession = (): void => {
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

const pushRoomPath = (roomId: string): void => {
  const targetPath = `${ROOM_PATH_PREFIX}${encodeURIComponent(roomId)}`
  if (window.location.pathname !== targetPath) {
    window.history.pushState({}, '', targetPath)
  }
}

function App() {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState(() => getRoomCodeFromPath(window.location.pathname))
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const chatSocketRef = useRef<WebSocket | null>(null)
  const chatListRef = useRef<HTMLUListElement | null>(null)

  const isHost = useMemo(() => {
    if (!roomState || !playerId) {
      return false
    }
    return roomState.room.hostId === playerId
  }, [playerId, roomState])

  const canStartGame = useMemo(() => {
    return isHost && (roomState?.room.players.length ?? 0) > 1
  }, [isHost, roomState?.room.players.length])

  const joinRoom = async (options?: {
    playerName?: string
    targetRoomCode?: string
    existingPlayerId?: string
    isAutoReconnect?: boolean
  }) => {
    const trimmedName = (options?.playerName ?? name).trim()
    const trimmedRoomCode = (options?.targetRoomCode ?? roomCode).trim()
    const existingPlayerId = options?.existingPlayerId?.trim()

    if (!trimmedName) {
      setStatusMessage('Please enter your name first.')
      return
    }

    if (!trimmedRoomCode) {
      setStatusMessage('Please enter a room code.')
      return
    }

    setStatusMessage(options?.isAutoReconnect ? 'Reconnecting to room...' : 'Joining room...')
    const response = await fetch(`${API_BASE}/rooms/${trimmedRoomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        playerId: existingPlayerId,
      }),
    })

    if (response.status === 404) {
      setStatusMessage('Room not found. Check the room code and try again.')
      if (options?.isAutoReconnect) {
        clearStoredRoomSession()
      }
      return
    }

    if (!response.ok) {
      setStatusMessage('Failed to join room. Is the server running on port 3000?')
      return
    }

    const data = (await response.json()) as RoomState & { playerId: string }
    setName(trimmedName)
    setRoomCode(data.roomId)
    setPlayerId(data.playerId)
    setRoomState({ roomId: data.roomId, room: data.room, started: data.started })
    setChatMessages([])
    setStoredRoomSession({ roomId: data.roomId, playerId: data.playerId, name: trimmedName })
    pushRoomPath(data.roomId)
    setStatusMessage(options?.isAutoReconnect ? 'Reconnected to room.' : 'Joined room.')
  }

  useEffect(() => {
    const syncRoomCodeFromPath = () => {
      const roomCodeFromPath = getRoomCodeFromPath(window.location.pathname)
      if (roomCodeFromPath) {
        setRoomCode(roomCodeFromPath)
      }
    }

    syncRoomCodeFromPath()
    window.addEventListener('popstate', syncRoomCodeFromPath)
    return () => window.removeEventListener('popstate', syncRoomCodeFromPath)
  }, [])

  useEffect(() => {
    if (roomState) {
      return
    }

    const roomCodeFromPath = getRoomCodeFromPath(window.location.pathname)
    if (!roomCodeFromPath) {
      return
    }

    const session = getStoredRoomSession()
    if (!session || session.roomId !== roomCodeFromPath) {
      setRoomCode(roomCodeFromPath)
      return
    }

    setName(session.name)
    setRoomCode(roomCodeFromPath)
    void joinRoom({
      playerName: session.name,
      targetRoomCode: session.roomId,
      existingPlayerId: session.playerId,
      isAutoReconnect: true,
    })
  }, [roomState])

  useEffect(() => {
    if (!roomState) {
      return
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/rooms/${roomState.roomId}`)
        if (!response.ok) {
          return
        }
        const data = (await response.json()) as RoomState
        setRoomState(data)
      } catch {
        // Ignore poll errors to keep the current screen usable.
      }
    }, 2000)

    return () => window.clearInterval(timer)
  }, [roomState?.roomId])

  useEffect(() => {
    if (!roomState?.started) {
      return
    }

    const loadMessages = async () => {
      try {
        const response = await fetch(`${API_BASE}/rooms/${roomState.roomId}/chat`)
        if (!response.ok) {
          return
        }

        const data = (await response.json()) as { messages: ChatMessage[] }
        setChatMessages(data.messages)
      } catch {
        // Ignore load errors to keep game screen responsive.
      }
    }

    void loadMessages()
  }, [roomState?.roomId, roomState?.started])

  useEffect(() => {
    if (!roomState?.started || !playerId) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${protocol}://localhost:3000/ws?roomId=${encodeURIComponent(roomState.roomId)}&playerId=${encodeURIComponent(playerId)}`
    const socket = new WebSocket(wsUrl)
    chatSocketRef.current = socket

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type?: string
          message?: ChatMessage
        }

        if (data.type !== 'chat_message' || !data.message) {
          return
        }

        const incomingMessage = data.message

        setChatMessages((current) => {
          if (current.some((message) => message.id === incomingMessage.id)) {
            return current
          }
          return [...current, incomingMessage]
        })
      } catch {
        // Ignore malformed websocket payloads.
      }
    }

    socket.onclose = () => {
      if (chatSocketRef.current === socket) {
        chatSocketRef.current = null
      }
    }

    return () => {
      socket.close()
      if (chatSocketRef.current === socket) {
        chatSocketRef.current = null
      }
    }
  }, [playerId, roomState?.roomId, roomState?.started])

  useEffect(() => {
    if (!roomState?.started || !chatListRef.current) {
      return
    }

    chatListRef.current.scrollTop = chatListRef.current.scrollHeight
  }, [chatMessages, roomState?.started])

  const createRoom = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setStatusMessage('Please enter your name first.')
      return
    }

    setStatusMessage('Creating room...')
    const response = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmedName }),
    })

    if (!response.ok) {
      setStatusMessage('Failed to create room. Is the server running on port 3000?')
      return
    }

    const data = (await response.json()) as RoomState & { playerId: string }
    setName(trimmedName)
    setRoomCode(data.roomId)
    setPlayerId(data.playerId)
    setRoomState({ roomId: data.roomId, room: data.room, started: data.started })
    setChatMessages([])
    setStoredRoomSession({ roomId: data.roomId, playerId: data.playerId, name: trimmedName })
    pushRoomPath(data.roomId)
    setStatusMessage('Room created.')
  }

  const updateTimer = async (nextTimer: number) => {
    if (!roomState || !playerId || !isHost) {
      return
    }

    setRoomState({
      ...roomState,
      room: {
        ...roomState.room,
        settings: {
          ...roomState.room.settings,
          timer: nextTimer,
        },
      },
    })

    const response = await fetch(`${API_BASE}/rooms/${roomState.roomId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, timer: nextTimer }),
    })

    if (!response.ok) {
      setStatusMessage('Failed to update timer setting.')
      return
    }

    const data = (await response.json()) as RoomState
    setRoomState({ roomId: data.roomId, room: data.room, started: data.started })
  }

  const startGame = async () => {
    if (!roomState || !playerId || !canStartGame) {
      return
    }

    const response = await fetch(`${API_BASE}/rooms/${roomState.roomId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    })

    if (!response.ok) {
      setStatusMessage('Could not start game.')
      return
    }

    const data = (await response.json()) as RoomState
    setRoomState({ roomId: data.roomId, room: data.room, started: data.started })
    setStatusMessage('Game started.')
  }

  const sendChatMessage = async () => {
    if (!roomState || !playerId) {
      return
    }

    const trimmedText = chatInput.trim()
    if (!trimmedText) {
      return
    }

    const response = await fetch(`${API_BASE}/rooms/${roomState.roomId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, text: trimmedText }),
    })

    if (!response.ok) {
      setStatusMessage('Could not send message.')
      return
    }

    const data = (await response.json()) as { message: ChatMessage }
    setChatMessages((current) => {
      if (current.some((message) => message.id === data.message.id)) {
        return current
      }
      return [...current, data.message]
    })
    setChatInput('')
  }

  if (roomState?.started) {
    return (
      <main className="screen">
        <section className="panel gamePanel">
          <h1 className="title">Game Room {roomState.roomId}</h1>
          <p className="hintText">Chat only mode for now.</p>

          <ul className="chatList" ref={chatListRef}>
            {chatMessages.map((message) => (
              <li
                key={message.id}
                className={`chatItem ${message.playerId === playerId ? 'ownMessage' : ''}`}
              >
                <p className="chatAuthor">
                  {message.playerName}
                  {message.playerId === playerId ? ' (You)' : ''}
                </p>
                <p className="chatText">{message.text}</p>
              </li>
            ))}
          </ul>

          <form
            className="chatComposer"
            onSubmit={(event) => {
              event.preventDefault()
              void sendChatMessage()
            }}
          >
            <input
              className="input"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Type a message"
            />
            <button type="submit" className="playButton">
              Send
            </button>
          </form>

          {statusMessage ? <p className="hintText">{statusMessage}</p> : null}
        </section>
      </main>
    )
  }

  if (roomState) {
    return (
      <main className="screen">
        <section className="panel roomPanel">
          <h1 className="title">Room {roomState.roomId}</h1>
          <p className="hintText">Share this code: {roomState.roomId}</p>
          <p className="hintText">
            Room URL: {window.location.origin}
            {ROOM_PATH_PREFIX}
            {roomState.roomId}
          </p>

          <div className="timerRow">
            <label htmlFor="timer" className="label">
              Timer: {roomState.room.settings.timer}s
            </label>
            <input
              id="timer"
              type="range"
              min={10}
              max={300}
              step={5}
              value={roomState.room.settings.timer}
              disabled={!isHost}
              onChange={(event) => updateTimer(Number(event.target.value))}
            />
          </div>

          <div>
            <h2 className="sectionTitle">Players</h2>
            <ul className="playerList">
              {roomState.room.players.map((player) => (
                <li key={player.id} className="playerItem">
                  <span>
                    {player.name}
                    {player.id === playerId ? ' (You)' : ''}
                  </span>
                  {player.id === roomState.room.hostId ? <strong>Host</strong> : null}
                </li>
              ))}
            </ul>
          </div>

          {isHost ? (
            <button
              type="button"
              className="playButton"
              onClick={startGame}
              disabled={!canStartGame}
            >
              Start
            </button>
          ) : (
            <p className="hintText">Waiting for host to start the game.</p>
          )}

          {isHost && !canStartGame ? (
            <p className="hintText">At least 2 players are required to start.</p>
          ) : null}

          {roomState.started ? <p className="startedText">Game started.</p> : null}
          {statusMessage ? <p className="hintText">{statusMessage}</p> : null}
        </section>
      </main>
    )
  }

  return (
    <main className="screen">
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault()
          void joinRoom()
        }}
      >
        <label htmlFor="name" className="label">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <label htmlFor="roomCode" className="label">
          Room Code
        </label>
        <input
          id="roomCode"
          name="roomCode"
          type="text"
          className="input"
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value)}
        />
        <div className="actions">
          <button type="submit" className="playButton">
            Play
          </button>
          <button type="button" className="createRoomButton" onClick={createRoom}>
            Create Room
          </button>
        </div>
        {statusMessage ? <p className="hintText">{statusMessage}</p> : null}
      </form>
    </main>
  )
}

export default App
