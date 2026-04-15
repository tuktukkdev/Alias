import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './styles/common.css'
import { API_BASE, ROOM_PATH_PREFIX, WS_BASE } from './config/client'
import { ts } from './i18n'
import desktopBck from './assets/desktop_bck.svg'
import mobileBck from './assets/mobile_bck.svg'
import { AuthModal } from './components/AuthModal'
import CollectionsScreen from './components/CollectionsScreen'
import { CollectionPickerModal } from './components/CollectionPickerModal'
import { Footer } from './components/Footer'
import { FriendsScreen } from './components/FriendsScreen'
import { GameScreen } from './components/GameScreen'
import { Header } from './components/Header'
import { HowToPlayScreen } from './components/HowToPlayScreen'
import { JoinScreen } from './components/JoinScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { ResetPasswordModal } from './components/ResetPasswordModal'
import { RoomScreen } from './components/RoomScreen'
import { StatsModal } from './components/StatsModal'
import { TermsScreen } from './components/TermsScreen'
import { useAuth } from './hooks/useAuth'
import { useVoiceChat } from './hooks/useVoiceChat'
import {
  createRoomRequest,
  exitRoomRequest,
  fetchRoomChatRequest,
  fetchRoomStateRequest,
  findMyRoomRequest,
  joinRoomRequest,
  mapRoomState,
  parseChatListResponse,
  parseChatMessageResponse,
  parseRoomJoinResponse,
  parseRoomStateResponse,
  sendChatMessageRequest,
  skipWordRequest,
  startGameRequest,
  updateCollectionsRequest,
  updateSettingsRequest,
  updateTimerRequest,
} from './services/roomApi'
import {
  requestPasswordResetRequest,
  resetPasswordRequest,
  verifyEmailRequest,
} from './services/authApi'
import type { AuthUser } from './types/auth'
import type { ChatMessage, RoomState, SelectedCollection, WsPayload } from './types/game'
import { getStoredAuthUser } from './utils/authSession'
import { getRoomCodeFromPath, pushRoomPath } from './utils/roomPath'
import {
  clearStoredRoomSession,
  getStoredRoomSession,
  setStoredRoomSession,
} from './utils/roomSession'

function App() {
  /* ── Navigation ──────────────────────────────────────── */
  const [page, setPage] = useState<'main' | 'profile' | 'friends' | 'collections' | 'howtoplay' | 'terms'>('main')
  const [showStats, setShowStats] = useState(false)
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0)

  /* ── Email verification / password reset via URL token ── */
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('resetToken')
    if (token) window.history.replaceState(null, '', window.location.pathname)
    return token
  })

  /* ── Room / Game State ───────────────────────────────── */
  const [name, setName] = useState(() => getStoredAuthUser()?.name ?? '')
  const [roomCode, setRoomCode] = useState(() => getRoomCodeFromPath(window.location.pathname))
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [gameStartsIn, setGameStartsIn] = useState(0)
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [showCollectionPicker, setShowCollectionPicker] = useState(false)

  const chatSocketRef = useRef<WebSocket | null>(null)
  const chatListRef = useRef<HTMLUListElement | null>(null)
  const [wsBlocked, setWsBlocked] = useState(false)

  /* ── Auth ─────────────────────────────────────────────── */
  const {
    authUser,
    authModal,
    authLoading,
    authError,
    setAuthModal,
    setAuthError,
    handleLogin,
    handleRegister,
    handleLogout,
    updateAuthUser,
  } = useAuth({
    onLoginSuccess: (user) => setName(user.name),
    onLogout: () => {
      setPage('main')
      setShowStats(false)
      setPendingFriendRequests(0)
    },
  })

  /* ── Voice Chat ──────────────────────────────────────── */
  const {
    volumeMenu,
    volumeMenuRef,
    getPlayerVolume,
    updatePlayerVolume,
    openVolumeMenu,
    handleVoiceSignal,
  } = useVoiceChat({
    chatSocketRef,
    roomStarted: !!roomState?.started,
    players: roomState?.room.players ?? [],
    playerId,
    currentTurnPlayerId: roomState?.currentTurnPlayerId,
    gameStartsIn,
  })

  /* ── Derived ─────────────────────────────────────────── */
  const isHost = useMemo(
    () => !!roomState && !!playerId && roomState.room.hostId === playerId,
    [playerId, roomState],
  )

  const canStartGame = useMemo(
    () => isHost && !roomState?.started && !roomState?.startRequested && (roomState?.room.players.length ?? 0) > 1,
    [isHost, roomState?.room.players.length, roomState?.started, roomState?.startRequested],
  )

  /* ── Room Actions ────────────────────────────────────── */
  const joinRoom = async (options?: {
    playerName?: string
    targetRoomCode?: string
    existingPlayerId?: string
    isAutoReconnect?: boolean
  }) => {
    const trimmedName = (options?.playerName ?? name).trim()
    const trimmedRoomCode = (options?.targetRoomCode ?? roomCode).trim()
    const existingPlayerId = options?.existingPlayerId?.trim()

    if (!trimmedName) { setStatusMessage(ts('app.enterName')); return }
    if (!trimmedRoomCode) { setStatusMessage(ts('app.enterRoomCode')); return }

    setStatusMessage(options?.isAutoReconnect ? ts('app.reconnecting') : ts('app.joining'))
    const response = await joinRoomRequest(trimmedRoomCode, trimmedName, existingPlayerId, authUser?.id)

    if (response.status === 404) {
      setStatusMessage(ts('app.roomNotFound'))
      if (options?.isAutoReconnect) clearStoredRoomSession()
      return
    }
    if (response.status === 403) {
      setStatusMessage(ts('app.gameAlreadyStarted'))
      if (options?.isAutoReconnect) clearStoredRoomSession()
      return
    }
    if (response.status === 409) { setStatusMessage(ts('app.alreadyInRoom')); return }
    if (!response.ok) { setStatusMessage(ts('app.joinFailed')); return }

    const data = await parseRoomJoinResponse(response)
    setName(trimmedName)
    setRoomCode(data.roomId)
    setPlayerId(data.playerId)
    setRoomState(mapRoomState(data))
    setActiveWord(null)
    setChatMessages([])
    setStoredRoomSession({ roomId: data.roomId, playerId: data.playerId, name: trimmedName })
    pushRoomPath(data.roomId)
    setStatusMessage(options?.isAutoReconnect ? ts('app.reconnected') : ts('app.joined'))
  }

  const createRoom = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) { setStatusMessage(ts('app.enterName')); return }

    setStatusMessage(ts('app.creatingRoom'))
    const response = await createRoomRequest(trimmedName, authUser?.id)

    if (response.status === 409) { setStatusMessage(ts('app.alreadyInRoom')); return }
    if (!response.ok) { setStatusMessage(ts('app.createFailed')); return }

    const data = await parseRoomJoinResponse(response)
    setName(trimmedName)
    setRoomCode(data.roomId)
    setPlayerId(data.playerId)
    setRoomState(mapRoomState(data))
    setActiveWord(null)
    setChatMessages([])
    setStoredRoomSession({ roomId: data.roomId, playerId: data.playerId, name: trimmedName })
    pushRoomPath(data.roomId)
    setStatusMessage(ts('app.roomCreated'))
  }

  const handleExitRoom = async () => {
    if (!roomState || !playerId) return
    try { await exitRoomRequest(roomState.roomId, playerId, authUser?.id) } catch { /* proceed */ }
    setRoomState(null)
    setPlayerId(null)
    setActiveWord(null)
    setChatMessages([])
    clearStoredRoomSession()
    window.history.replaceState(null, '', '/')
  }

  const updateTimer = async (nextTimer: number) => {
    if (!roomState || !playerId || !isHost) return
    setRoomState({
      ...roomState,
      room: { ...roomState.room, settings: { ...roomState.room.settings, timer: nextTimer } },
    })
    const response = await updateTimerRequest(roomState.roomId, playerId, nextTimer)
    if (!response.ok) { setStatusMessage(ts('app.timerFailed')); return }
    setRoomState(mapRoomState(await parseRoomStateResponse(response)))
  }

  const updateDifficulty = async (nextDifficulty: number) => {
    if (!roomState || !playerId || !isHost) return
    setRoomState({
      ...roomState,
      room: { ...roomState.room, settings: { ...roomState.room.settings, difficulty: nextDifficulty } },
    })
    const response = await updateSettingsRequest(roomState.roomId, playerId, { difficulty: nextDifficulty })
    if (!response.ok) { setStatusMessage(ts('app.difficultyFailed')); return }
    setRoomState(mapRoomState(await parseRoomStateResponse(response)))
  }

  const updateWinScore = async (nextWinScore: number) => {
    if (!roomState || !playerId || !isHost) return
    setRoomState({
      ...roomState,
      room: { ...roomState.room, settings: { ...roomState.room.settings, winScore: nextWinScore } },
    })
    const response = await updateSettingsRequest(roomState.roomId, playerId, { winScore: nextWinScore })
    if (!response.ok) { setStatusMessage(ts('app.winScoreFailed')); return }
    setRoomState(mapRoomState(await parseRoomStateResponse(response)))
  }

  const handleForgotPassword = async (email: string): Promise<boolean> => {
    try {
      const response = await requestPasswordResetRequest(email)
      return response.ok
    } catch {
      return false
    }
  }

  const handleResetPassword = async (newPassword: string): Promise<string | null> => {
    if (!resetToken) return ts('app.invalidResetLink')
    try {
      const response = await resetPasswordRequest(resetToken, newPassword)
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        return data.error ?? ts('app.resetFailed')
      }
      setResetToken(null)
      return null
    } catch {
      return ts('app.serverError')
    }
  }

  const updateCollections = async (collections: SelectedCollection[]) => {
    if (!roomState || !playerId || !isHost) return
    setShowCollectionPicker(false)
    const response = await updateCollectionsRequest(roomState.roomId, playerId, collections)
    if (!response.ok) { setStatusMessage(ts('app.collectionsFailed')); return }
    setRoomState(mapRoomState(await parseRoomStateResponse(response)))
  }

  const startGame = async () => {
    if (!roomState || !playerId || !canStartGame) return
    const response = await startGameRequest(roomState.roomId, playerId)
    if (!response.ok) { setStatusMessage(ts('app.startFailed')); return }
    const data = await parseRoomStateResponse(response)
    setRoomState(mapRoomState(data))
    setStatusMessage(data.started ? ts('app.gameStarted') : ts('app.waitingPlayers'))
  }

  const sendChatMessage = async () => {
    if (!roomState || !playerId) return
    const trimmedText = chatInput.trim()
    if (!trimmedText) return

    const response = await sendChatMessageRequest(roomState.roomId, playerId, trimmedText)
    if (!response.ok) { setStatusMessage(ts('app.sendFailed')); return }

    const data = await parseChatMessageResponse(response)
    setChatMessages((current) =>
      current.some((m) => m.id === data.message.id) ? current : [...current, data.message],
    )
    setChatInput('')
  }

  const skipWord = async () => {
    if (!roomState || !playerId) return
    const response = await skipWordRequest(roomState.roomId, playerId)
    if (!response.ok) { setStatusMessage(ts('app.skipFailed')); return }
    setRoomState(mapRoomState(await parseRoomStateResponse(response)))
    setStatusMessage(ts('app.wordSkipped'))
  }

  /* ── Effects: URL & Auth Sync ────────────────────────── */
  useEffect(() => {
    const sync = () => {
      const code = getRoomCodeFromPath(window.location.pathname)
      if (code) setRoomCode(code)
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useEffect(() => {
    if (authUser) setName(authUser.name)
  }, [authUser])

  useEffect(() => {
    if (!authUser) { setPendingFriendRequests(0); return }
    const fetchPending = async () => {
      try {
        const res = await fetch(`${API_BASE}/friends/${authUser.id}/pending-count`)
        if (res.ok) setPendingFriendRequests(((await res.json()) as { count: number }).count)
      } catch { /* ignore */ }
    }
    void fetchPending()
    const interval = window.setInterval(() => void fetchPending(), 30000)
    return () => window.clearInterval(interval)
  }, [authUser?.id])

  /* ── Effects: Email verification via URL token ───────── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const verifyToken = params.get('verifyToken')
    if (!verifyToken) return
    window.history.replaceState(null, '', window.location.pathname)
    void verifyEmailRequest(verifyToken).then((res) => {
      setStatusMessage(res.ok ? ts('app.emailVerified') : ts('app.verifyFailed'))
    }).catch(() => {
      setStatusMessage(ts('app.verifyError'))
    })
  }, [])

  /* ── Effects: Room Auto-Reconnect ────────────────────── */
  useEffect(() => {
    if (roomState) return
    const roomCodeFromPath = getRoomCodeFromPath(window.location.pathname)
    const session = getStoredRoomSession()

    if (session && (!roomCodeFromPath || session.roomId === roomCodeFromPath)) {
      setName(session.name)
      setRoomCode(session.roomId)
      void joinRoom({
        playerName: session.name,
        targetRoomCode: session.roomId,
        existingPlayerId: session.playerId,
        isAutoReconnect: true,
      })
      return
    }

    if (roomCodeFromPath) {
      setRoomCode(roomCodeFromPath)
      if (authUser) void joinRoom({ playerName: authUser.name, targetRoomCode: roomCodeFromPath })
      return
    }

    if (authUser) {
      void (async () => {
        try {
          const response = await findMyRoomRequest(authUser.id)
          if (response.ok) {
            const data = (await response.json()) as { roomId: string; playerId: string }
            void joinRoom({
              playerName: authUser.name,
              targetRoomCode: data.roomId,
              existingPlayerId: data.playerId,
              isAutoReconnect: true,
            })
          }
        } catch { /* non-critical */ }
      })()
    }
  }, [roomState, authUser])

  /* ── Effects: Room Polling & Chat ────────────────────── */
  useEffect(() => {
    if (!roomState) return
    const timer = window.setInterval(async () => {
      try {
        const response = await fetchRoomStateRequest(roomState.roomId)
        if (response.ok) setRoomState(mapRoomState(await parseRoomStateResponse(response)))
      } catch { /* ignore */ }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [roomState?.roomId])

  useEffect(() => {
    if (!roomState?.started) return
    void (async () => {
      try {
        const response = await fetchRoomChatRequest(roomState.roomId)
        if (response.ok) setChatMessages((await parseChatListResponse(response)).messages)
      } catch { /* ignore */ }
    })()
  }, [roomState?.roomId, roomState?.started])

  /* ── Effects: WebSocket ──────────────────────────────── */
  useEffect(() => {
    if (!roomState || !playerId) return

    const wsBase = WS_BASE ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    const wsUrl = `${wsBase}/ws?roomId=${encodeURIComponent(roomState.roomId)}&playerId=${encodeURIComponent(playerId)}`
    let currentSocket: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let active = true
    let reconnectDelay = 1000
    let failCount = 0

    const connect = () => {
      if (!active) return
      const socket = new WebSocket(wsUrl)
      currentSocket = socket
      chatSocketRef.current = socket

      socket.onopen = () => {
        reconnectDelay = 1000
        failCount = 0
        setWsBlocked(false)
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsPayload

          if (data.type === 'room_state' && data.roomId === roomState.roomId && data.room) {
            setRoomState(mapRoomState({
              roomId: data.roomId,
              room: data.room,
              started: data.started,
              startRequested: data.startRequested,
              startedAt: data.startedAt,
              connectedPlayerIds: data.connectedPlayerIds,
              turnSecondsRemaining: data.turnSecondsRemaining,
              currentTurnPlayerId: data.currentTurnPlayerId,
              waitingForWordResolutionAtZero: data.waitingForWordResolutionAtZero,
              winner: data.winner,
            }))
            return
          }

          if (data.type === 'active_word' && data.roomId === roomState.roomId) {
            setActiveWord(data.word ?? null)
            return
          }

          if (data.type === 'voice_signal' && data.roomId === roomState.roomId && data.fromPlayerId && data.signal) {
            handleVoiceSignal(data.fromPlayerId, data.signal)
            return
          }

          if (data.type === 'chat_message' && data.message) {
            const msg = data.message
            setChatMessages((current) =>
              current.some((m) => m.id === msg.id) ? current : [...current, msg],
            )
          }
        } catch { /* ignore malformed payloads */ }
      }

      socket.onclose = () => {
        if (chatSocketRef.current === socket) chatSocketRef.current = null
        if (currentSocket === socket) currentSocket = null
        if (active) {
          failCount += 1
          if (failCount >= 3) setWsBlocked(true)
          reconnectTimeout = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, 30000)
            connect()
          }, reconnectDelay)
        }
      }
    }

    connect()

    return () => {
      active = false
      setWsBlocked(false)
      if (reconnectTimeout !== null) clearTimeout(reconnectTimeout)
      if (currentSocket) {
        currentSocket.close()
        if (chatSocketRef.current === currentSocket) chatSocketRef.current = null
      }
    }
  }, [playerId, roomState?.roomId])

  useEffect(() => {
    if (roomState?.started && chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight
    }
  }, [chatMessages, roomState?.started])

  /* ── Effects: Game Countdown & Active Word ───────────── */
  useEffect(() => {
    if (!roomState?.started || !roomState.startedAt) { setGameStartsIn(0); return }
    const update = () => {
      const startMs = Date.parse(roomState.startedAt ?? '')
      setGameStartsIn(Number.isFinite(startMs) ? Math.max(0, Math.ceil((startMs - Date.now()) / 1000)) : 0)
    }
    update()
    const id = window.setInterval(update, 250)
    return () => window.clearInterval(id)
  }, [roomState?.started, roomState?.startedAt])

  useEffect(() => {
    if (!roomState?.started) { setActiveWord(null); return }
    if (roomState.currentTurnPlayerId !== playerId) setActiveWord(null)
  }, [playerId, roomState?.started, roomState?.currentTurnPlayerId])

  /* ── Auth Handlers (with room rejoin) ────────────────── */
  const onLogin = async (username: string, password: string) => {
    const roomData = await handleLogin(username, password)
    if (roomData) {
      void joinRoom({
        playerName: username,
        targetRoomCode: roomData.roomId,
        existingPlayerId: roomData.playerId,
        isAutoReconnect: true,
      })
    }
  }

  const onRegister = async (username: string, email: string, password: string) => {
    const roomData = await handleRegister(username, email, password)
    if (roomData) {
      void joinRoom({
        playerName: username,
        targetRoomCode: roomData.roomId,
        existingPlayerId: roomData.playerId,
        isAutoReconnect: true,
      })
    }
  }

  const handleNavigate = (nav: 'profile' | 'friends' | 'stats' | 'collections') => {
    if (nav === 'stats') setShowStats(true)
    else setPage(nav)
  }

  const handleUsernameChanged = (newName: string) => {
    updateAuthUser((prev: AuthUser) => ({ ...prev, name: newName }))
    setName(newName)
  }

  const handleAvatarChanged = (url: string) => {
    updateAuthUser((prev: AuthUser) => ({ ...prev, avatarUrl: url }))
  }

  /* ── Screen Content ──────────────────────────────────── */
  const screenContent =
    page === 'profile' && authUser ? (
      <ProfileScreen
        user={authUser}
        onBack={() => setPage('main')}
        onUsernameChanged={handleUsernameChanged}
        onAvatarChanged={handleAvatarChanged}
        onEmailVerified={() => updateAuthUser((prev: AuthUser) => ({ ...prev, emailVerified: true }))}
      />
    ) : page === 'friends' && authUser ? (
      <FriendsScreen
        user={authUser}
        onBack={() => setPage('main')}
        onPendingCountChange={setPendingFriendRequests}
      />
    ) : page === 'collections' && authUser ? (
      <CollectionsScreen user={authUser} onBack={() => setPage('main')} />
    ) : page === 'howtoplay' ? (
      <HowToPlayScreen onBack={() => setPage('main')} />
    ) : page === 'terms' ? (
      <TermsScreen onBack={() => setPage('main')} />
    ) : roomState?.started ? (
      <GameScreen
        roomState={roomState}
        playerId={playerId}
        chatInput={chatInput}
        chatMessages={chatMessages}
        statusMessage={statusMessage}
        gameStartsIn={gameStartsIn}
        activeWord={activeWord}
        volumeMenu={volumeMenu}
        chatListRef={chatListRef}
        volumeMenuRef={volumeMenuRef}
        getPlayerVolume={getPlayerVolume}
        onChatInputChange={setChatInput}
        onSendChatMessage={() => void sendChatMessage()}
        onSkipWord={() => void skipWord()}
        onOpenVolumeMenu={openVolumeMenu}
        onUpdatePlayerVolume={updatePlayerVolume}
        onExitRoom={() => void handleExitRoom()}
      />
    ) : roomState ? (
      <RoomScreen
        roomState={roomState}
        playerId={playerId}
        isHost={isHost}
        canStartGame={canStartGame}
        statusMessage={statusMessage}
        wsBlocked={wsBlocked}
        roomPathPrefix={ROOM_PATH_PREFIX}
        onUpdateTimer={(t) => void updateTimer(t)}
        onUpdateDifficulty={(d) => void updateDifficulty(d)}
        onUpdateWinScore={(w) => void updateWinScore(w)}
        onOpenCollectionPicker={() => setShowCollectionPicker(true)}
        onStartGame={() => void startGame()}
        onExitRoom={() => void handleExitRoom()}
      />
    ) : (
      <JoinScreen
        name={name}
        roomCode={roomCode}
        statusMessage={statusMessage}
        nameReadOnly={!!authUser}
        onNameChange={setName}
        onRoomCodeChange={setRoomCode}
        onJoin={() => void joinRoom()}
        onCreateRoom={() => void createRoom()}
      />
    )

  return (
    <>
      <div className="bgLayer" aria-hidden="true">
        <img className="bgImg bgImgDesktop" src={desktopBck} alt="" />
        <img className="bgImg bgImgMobile" src={mobileBck} alt="" />
      </div>
      <div className="appLayout">
      <Header
        user={authUser}
        pendingFriendRequests={pendingFriendRequests}
        onLoginClick={() => setAuthModal('login')}
        onRegisterClick={() => setAuthModal('register')}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        onLogoClick={!roomState ? () => setPage('main') : undefined}
      />
      {screenContent}
      <Footer onNavigate={(p) => setPage(p)} />
      {showStats && authUser && (
        <StatsModal user={authUser} onClose={() => setShowStats(false)} />
      )}
      {showCollectionPicker && roomState && (
        <CollectionPickerModal
          userId={authUser ? parseInt(authUser.id, 10) : null}
          selected={roomState.room.settings.selectedCollections ?? []}
          onConfirm={(cols) => void updateCollections(cols)}
          onCancel={() => setShowCollectionPicker(false)}
        />
      )}
      {authModal && (
        <AuthModal
          initialTab={authModal}
          serverError={authError}
          loading={authLoading}
          onClose={() => { setAuthModal(null); setAuthError('') }}
          onLogin={(u, p) => void onLogin(u, p)}
          onRegister={(u, e, p) => void onRegister(u, e, p)}
          onForgotPassword={(email) => handleForgotPassword(email)}
        />
      )}
      {resetToken && (
        <ResetPasswordModal
          onClose={() => setResetToken(null)}
          onSubmit={(newPassword) => handleResetPassword(newPassword)}
        />
      )}
      </div>
    </>
  )
}

export default App
