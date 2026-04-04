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
  startRequested?: boolean
  startedAt?: string | null
  connectedPlayerIds?: string[]
  turnSecondsRemaining?: number | null
  currentTurnPlayerId?: string | null
  waitingForWordResolutionAtZero?: boolean
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

const mapRoomState = (data: RoomState): RoomState => ({
  roomId: data.roomId,
  room: data.room,
  started: data.started,
  startRequested: data.startRequested,
  startedAt: data.startedAt,
  connectedPlayerIds: data.connectedPlayerIds,
  turnSecondsRemaining: data.turnSecondsRemaining,
  currentTurnPlayerId: data.currentTurnPlayerId,
  waitingForWordResolutionAtZero: data.waitingForWordResolutionAtZero,
})

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
}

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
    latency: 0.02,
  } as MediaTrackConstraints & { latency?: number },
}

const OPUS_TARGET_BITRATE = 48000

function App() {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState(() => getRoomCodeFromPath(window.location.pathname))
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [gameStartsIn, setGameStartsIn] = useState(0)
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [playerVolumes, setPlayerVolumes] = useState<Record<string, number>>({})
  const [volumeMenu, setVolumeMenu] = useState<{
    playerId: string
    playerName: string
    x: number
    y: number
  } | null>(null)
  const setVoiceStatus = (_: string) => {}
  const chatSocketRef = useRef<WebSocket | null>(null)
  const chatListRef = useRef<HTMLUListElement | null>(null)
  const volumeMenuRef = useRef<HTMLDivElement | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const localAudioStreamRef = useRef<MediaStream | null>(null)
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null)
  const playerVolumesRef = useRef<Record<string, number>>({})

  const isHost = useMemo(() => {
    if (!roomState || !playerId) {
      return false
    }
    return roomState.room.hostId === playerId
  }, [playerId, roomState])

  const canStartGame = useMemo(() => {
    return (
      isHost &&
      !roomState?.started &&
      !roomState?.startRequested &&
      (roomState?.room.players.length ?? 0) > 1
    )
  }, [isHost, roomState?.room.players.length, roomState?.started, roomState?.startRequested])

  const getPlayerVolume = (targetPlayerId: string) => {
    return playerVolumes[targetPlayerId] ?? playerVolumesRef.current[targetPlayerId] ?? 1
  }

  const updatePlayerVolume = (targetPlayerId: string, volume: number) => {
    const normalizedVolume = Math.max(0, Math.min(1, volume))

    setPlayerVolumes((current) => {
      const next = {
        ...current,
        [targetPlayerId]: normalizedVolume,
      }
      playerVolumesRef.current = next
      return next
    })

    const audioElement = remoteAudioElementsRef.current.get(targetPlayerId)
    if (audioElement) {
      audioElement.volume = normalizedVolume
    }
  }

  const openVolumeMenu = (
    event: React.MouseEvent,
    targetPlayerId: string,
    targetPlayerName: string,
  ) => {
    event.preventDefault()

    const menuWidth = 250
    const menuHeight = 116
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8)
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8)

    setVolumeMenu({
      playerId: targetPlayerId,
      playerName: targetPlayerName,
      x: Math.max(8, x),
      y: Math.max(8, y),
    })
  }

  const sendVoiceSignal = (toPlayerId: string, signal: unknown) => {
    const socket = chatSocketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(
      JSON.stringify({
        type: 'voice_signal',
        toPlayerId,
        signal,
      }),
    )
  }

  const stopLocalAudio = () => {
    const stream = localAudioStreamRef.current
    if (!stream) {
      return
    }

    stream.getTracks().forEach((track) => track.stop())
    localAudioStreamRef.current = null
    localAudioTrackRef.current = null
  }

  const setLocalTrackEnabled = (enabled: boolean) => {
    const track = localAudioTrackRef.current
    if (!track) {
      return
    }

    track.enabled = enabled
  }

  const tuneAudioSender = async (sender: RTCRtpSender) => {
    const params = sender.getParameters()
    const encodings = params.encodings && params.encodings.length > 0 ? params.encodings : [{}]
    encodings[0] = {
      ...encodings[0],
      maxBitrate: OPUS_TARGET_BITRATE,
      dtx: 'enabled',
    } as RTCRtpEncodingParameters & { dtx?: 'enabled' | 'disabled' }

    params.encodings = encodings

    try {
      await sender.setParameters(params)
    } catch {
      // Some browsers may reject bitrate tuning on specific transports.
    }
  }

  const clearVoiceConnections = () => {
    for (const [, connection] of peerConnectionsRef.current) {
      connection.onicecandidate = null
      connection.ontrack = null
      connection.close()
    }

    peerConnectionsRef.current.clear()
    pendingIceRef.current.clear()

    for (const [, audio] of remoteAudioElementsRef.current) {
      audio.pause()
      audio.srcObject = null
    }

    remoteAudioElementsRef.current.clear()
  }

  const drainPendingIce = async (remotePlayerId: string, connection: RTCPeerConnection) => {
    const pendingCandidates = pendingIceRef.current.get(remotePlayerId) ?? []
    if (pendingCandidates.length === 0) {
      return
    }

    pendingIceRef.current.delete(remotePlayerId)
    for (const candidate of pendingCandidates) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // Candidate can be stale when peers reconnect during turn handoff.
      }
    }
  }

  const getOrCreatePeerConnection = (remotePlayerId: string) => {
    const existingConnection = peerConnectionsRef.current.get(remotePlayerId)
    if (existingConnection) {
      return existingConnection
    }

    const connection = new RTCPeerConnection(RTC_CONFIG)

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        return
      }

      sendVoiceSignal(remotePlayerId, {
        type: 'ice',
        candidate: event.candidate.toJSON(),
      })
    }

    connection.ontrack = (event) => {
      const [remoteStream] = event.streams
      if (!remoteStream) {
        return
      }

      let audioElement = remoteAudioElementsRef.current.get(remotePlayerId)
      if (!audioElement) {
        audioElement = new Audio()
        audioElement.autoplay = true
        remoteAudioElementsRef.current.set(remotePlayerId, audioElement)
      }

      audioElement.volume = getPlayerVolume(remotePlayerId)
      audioElement.srcObject = remoteStream
      void audioElement.play().catch(() => {
        // Browser may require explicit gesture in strict autoplay modes.
      })
    }

    peerConnectionsRef.current.set(remotePlayerId, connection)
    return connection
  }

  const ensurePeerConnectionsForRoom = (players: Player[], ownPlayerId: string) => {
    const expectedRemoteIds = new Set(players.filter((player) => player.id !== ownPlayerId).map((p) => p.id))

    for (const [remotePlayerId, connection] of peerConnectionsRef.current) {
      if (expectedRemoteIds.has(remotePlayerId)) {
        continue
      }

      connection.onicecandidate = null
      connection.ontrack = null
      connection.close()
      peerConnectionsRef.current.delete(remotePlayerId)
      pendingIceRef.current.delete(remotePlayerId)

      const audioElement = remoteAudioElementsRef.current.get(remotePlayerId)
      if (audioElement) {
        audioElement.pause()
        audioElement.srcObject = null
        remoteAudioElementsRef.current.delete(remotePlayerId)
      }
    }

    for (const remotePlayerId of expectedRemoteIds) {
      getOrCreatePeerConnection(remotePlayerId)
    }
  }

  const ensureLocalAudioTrack = async () => {
    if (localAudioTrackRef.current && localAudioTrackRef.current.readyState === 'live') {
      return localAudioTrackRef.current
    }

    const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
    const [audioTrack] = stream.getAudioTracks()
    if (!audioTrack) {
      throw new Error('No audio track available')
    }

    localAudioStreamRef.current = stream
    localAudioTrackRef.current = audioTrack
    return audioTrack
  }

  const attachOrReplaceTrack = async (connection: RTCPeerConnection, track: MediaStreamTrack) => {
    const existingAudioSender = connection.getSenders().find((sender) => sender.track?.kind === 'audio')
    if (existingAudioSender) {
      if (existingAudioSender.track !== track) {
        await existingAudioSender.replaceTrack(track)
      }
      await tuneAudioSender(existingAudioSender)
      return false
    }

    const stream = localAudioStreamRef.current ?? new MediaStream([track])
    const sender = connection.addTrack(track, stream)
    await tuneAudioSender(sender)
    return true
  }

  const createOfferForPeer = async (remotePlayerId: string, connection: RTCPeerConnection) => {
    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)
    sendVoiceSignal(remotePlayerId, {
      type: 'offer',
      sdp: offer.sdp,
    })
  }

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

        if (response.status === 403) {
      setStatusMessage("Game already started; only existing players can reconnect.")
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
    setRoomState(mapRoomState(data))
    setActiveWord(null)
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
        setRoomState(mapRoomState(data))
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
    if (!roomState || !playerId) {
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
          roomId?: string
          room?: GameRoom
          started?: boolean
          startRequested?: boolean
          startedAt?: string | null
          connectedPlayerIds?: string[]
          turnSecondsRemaining?: number | null
          currentTurnPlayerId?: string | null
          waitingForWordResolutionAtZero?: boolean
          word?: string | null
          fromPlayerId?: string
          signal?: {
            type?: 'offer' | 'answer' | 'ice'
            sdp?: string
            candidate?: RTCIceCandidateInit
          }
        }

        if (data.type === 'room_state' && data.roomId === roomState.roomId && data.room) {
          setRoomState(
            mapRoomState({
              roomId: data.roomId,
              room: data.room,
              started: data.started,
              startRequested: data.startRequested,
              startedAt: data.startedAt,
              connectedPlayerIds: data.connectedPlayerIds,
              turnSecondsRemaining: data.turnSecondsRemaining,
              currentTurnPlayerId: data.currentTurnPlayerId,
              waitingForWordResolutionAtZero: data.waitingForWordResolutionAtZero,
            }),
          )
          return
        }

        if (data.type === 'active_word' && data.roomId === roomState.roomId) {
          setActiveWord(data.word ?? null)
          return
        }

        if (
          data.type === 'voice_signal' &&
          data.roomId === roomState.roomId &&
          data.fromPlayerId &&
          data.signal
        ) {
          const fromPlayerId = data.fromPlayerId
          const connection = getOrCreatePeerConnection(fromPlayerId)

          if (data.signal.type === 'offer' && data.signal.sdp) {
            void (async () => {
              await connection.setRemoteDescription(
                new RTCSessionDescription({ type: 'offer', sdp: data.signal?.sdp ?? '' }),
              )
              await drainPendingIce(fromPlayerId, connection)
              const answer = await connection.createAnswer()
              await connection.setLocalDescription(answer)
              sendVoiceSignal(fromPlayerId, {
                type: 'answer',
                sdp: answer.sdp,
              })
            })().catch(() => {
              setVoiceStatus('Voice sync failed. Retrying...')
            })

            return
          }

          if (data.signal.type === 'answer' && data.signal.sdp) {
            void (async () => {
              await connection.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: data.signal?.sdp ?? '' }),
              )
              await drainPendingIce(fromPlayerId, connection)
            })().catch(() => {
              setVoiceStatus('Voice answer failed.')
            })
            return
          }

          if (data.signal.type === 'ice' && data.signal.candidate) {
            if (connection.remoteDescription) {
              void connection.addIceCandidate(new RTCIceCandidate(data.signal.candidate)).catch(() => {
                // Ignore stale candidate race conditions.
              })
            } else {
              const queued = pendingIceRef.current.get(fromPlayerId) ?? []
              queued.push(data.signal.candidate)
              pendingIceRef.current.set(fromPlayerId, queued)
            }
            return
          }
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
  }, [playerId, roomState?.roomId])

  useEffect(() => {
    if (!roomState?.started || !chatListRef.current) {
      return
    }

    chatListRef.current.scrollTop = chatListRef.current.scrollHeight
  }, [chatMessages, roomState?.started])

  useEffect(() => {
    if (!volumeMenu) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const menuElement = volumeMenuRef.current
      if (menuElement?.contains(event.target as Node)) {
        return
      }

      setVolumeMenu(null)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setVolumeMenu(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [volumeMenu])

  useEffect(() => {
    if (!roomState?.started) {
      setVolumeMenu(null)
    }
  }, [roomState?.started])

  useEffect(() => {
    if (!roomState?.started || !roomState.startedAt) {
      setGameStartsIn(0)
      return
    }

    const updateCountdown = () => {
      const startMs = Date.parse(roomState.startedAt ?? '')
      if (!Number.isFinite(startMs)) {
        setGameStartsIn(0)
        return
      }

      const seconds = Math.max(0, Math.ceil((startMs - Date.now()) / 1000))
      setGameStartsIn(seconds)
    }

    updateCountdown()
    const intervalId = window.setInterval(updateCountdown, 250)
    return () => window.clearInterval(intervalId)
  }, [roomState?.started, roomState?.startedAt])

  useEffect(() => {
    if (!roomState?.started) {
      setActiveWord(null)
      return
    }

    if (roomState.currentTurnPlayerId !== playerId) {
      setActiveWord(null)
    }
  }, [playerId, roomState?.started, roomState?.currentTurnPlayerId])

  useEffect(() => {
    if (!roomState?.started || !playerId) {
      setVoiceStatus('')
      stopLocalAudio()
      clearVoiceConnections()
      return
    }

    ensurePeerConnectionsForRoom(roomState.room.players, playerId)

    if (gameStartsIn > 0) {
      setVoiceStatus('Voice opens when the timer starts.')
      setLocalTrackEnabled(false)
      return
    }

    let cancelled = false
    const isSpeaker = roomState.currentTurnPlayerId === playerId
    const activeSpeaker = roomState.room.players.find((player) => player.id === roomState.currentTurnPlayerId)

    const setupVoice = async () => {
      if (!isSpeaker) {
        setLocalTrackEnabled(false)
        setVoiceStatus(activeSpeaker ? `${activeSpeaker.name} is speaking now.` : 'Waiting for speaker.')
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setVoiceStatus('Microphone is not supported in this browser.')
        return
      }

      try {
        const localTrack = await ensureLocalAudioTrack()
        if (cancelled) {
          return
        }

        localTrack.enabled = true
        setVoiceStatus('You are live on microphone.')

        const peers = roomState.room.players.filter((player) => player.id !== playerId)
        for (const peer of peers) {
          const connection = getOrCreatePeerConnection(peer.id)
          const addedNewSender = await attachOrReplaceTrack(connection, localTrack)

          if (addedNewSender) {
            await createOfferForPeer(peer.id, connection)
          }
        }
      } catch {
        setVoiceStatus('Allow microphone access to speak during your turn.')
      }
    }

    void setupVoice()

    return () => {
      cancelled = true
    }
  }, [
    gameStartsIn,
    playerId,
    roomState?.started,
    roomState?.currentTurnPlayerId,
    roomState?.room.players,
  ])

  useEffect(() => {
    return () => {
      stopLocalAudio()
      clearVoiceConnections()
    }
  }, [])

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
    setRoomState(mapRoomState(data))
    setActiveWord(null)
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
    setRoomState(mapRoomState(data))
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
    setRoomState(mapRoomState(data))

    if (data.started) {
      setStatusMessage('Game started.')
      return
    }

    setStatusMessage('Waiting for all players to connect...')
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

  const skipWord = async () => {
    if (!roomState || !playerId) {
      return
    }

    const response = await fetch(`${API_BASE}/rooms/${roomState.roomId}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    })

    if (!response.ok) {
      setStatusMessage('Could not skip word.')
      return
    }

    const data = (await response.json()) as RoomState
    setRoomState(mapRoomState(data))
    setStatusMessage('Word skipped.')
  }

  if (roomState?.started) {
    const activePlayer = roomState.room.players.find(
      (player) => player.id === roomState.currentTurnPlayerId,
    )
    const turnSecondsLeft = roomState.turnSecondsRemaining ?? roomState.room.settings.timer
    const isActivePlayer = Boolean(playerId && roomState.currentTurnPlayerId === playerId)
    const speakingPlayerId = gameStartsIn === 0 ? roomState.currentTurnPlayerId : null

    return (
      <main className="screen">
        <section className="panel gamePanel">
          <h1 className="title">Game Room {roomState.roomId}</h1>
          <p className="turnTimer">
            {gameStartsIn > 0 ? (
              <>
                Game starts in <strong>{gameStartsIn}s</strong>
              </>
            ) : roomState.waitingForWordResolutionAtZero ? (
              <>
                Time Left: <strong>0s</strong>
                {activePlayer ? ` | Waiting for "${activePlayer.name}" word to be guessed or skipped` : ''}
              </>
            ) : (
              <>
                Time Left: <strong>{turnSecondsLeft}s</strong>
                {activePlayer ? ` | Turn: ${activePlayer.name}` : ''}
              </>
            )}
          </p>

          <div className="gameLayout">
            <div className="gameColumn scoreboardSection">
              <h2 className="sectionTitle">Players Score</h2>
              <table className="scoreboardTable">
                <thead>
                  <tr>
                    <th scope="col">Player</th>
                    <th scope="col">Score</th>
                    <th scope="col" className="voiceHeaderCell">
                      Voice
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roomState.room.players.map((player) => {
                    const isSpeaking = player.id === speakingPlayerId

                    return (
                      <tr
                        key={player.id}
                        className={player.id === roomState.currentTurnPlayerId ? 'highlightedPlayerRow' : ''}
                        onContextMenu={(event) => openVolumeMenu(event, player.id, player.name)}
                      >
                        <td>
                          {player.name}
                          {player.id === playerId ? ' (You)' : ''}
                        </td>
                        <td>{player.score}</td>
                        <td className="voiceCell">
                          <span
                            className={`voiceIndicator ${isSpeaking ? 'voiceIndicatorActive' : ''}`}
                            title={isSpeaking ? `${player.name} is speaking` : `${player.name} is muted`}
                            aria-label={isSpeaking ? `${player.name} is speaking` : `${player.name} is muted`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="gameColumn futureColumn wordColumn">
              <h2 className="sectionTitle">Word Card</h2>
              <div className="wordCard">
                {gameStartsIn > 0 ? (
                  <p className="wordHint">Get ready...</p>
                ) : isActivePlayer ? (
                  <p className="wordValue">{activeWord ?? 'Loading word...'}</p>
                ) : (
                  <p className="wordHint">
                    {activePlayer
                      ? `${activePlayer.name} is explaining now. Guess the word in chat.`
                      : 'Waiting for active player.'}
                  </p>
                )}
              </div>

              {isActivePlayer && gameStartsIn === 0 ? (
                <button type="button" className="skipButton" onClick={skipWord}>
                  Skip Word
                </button>
              ) : null}
            </div>

            <div className="gameColumn chatSection">
              <h2 className="sectionTitle">Chat</h2>
              <ul className="chatList" ref={chatListRef}>
                {chatMessages.map((message) => (
                  <li
                    key={message.id}
                    className={`chatItem ${message.playerId === playerId ? 'ownMessage' : ''}`}
                  >
                    <p className="chatMeta">
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
                  placeholder="Type your guess"
                />
                <button type="submit" className="playButton">
                  Send
                </button>
              </form>

              {statusMessage ? <p className="hintText">{statusMessage}</p> : null}
            </div>
          </div>

          {volumeMenu ? (
            <div
              ref={volumeMenuRef}
              className="volumeContextMenu"
              style={{ left: volumeMenu.x, top: volumeMenu.y }}
            >
              <p className="volumeMenuTitle">Volume: {volumeMenu.playerName}</p>
              <input
                className="volumeSlider"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(getPlayerVolume(volumeMenu.playerId) * 100)}
                onChange={(event) => {
                  updatePlayerVolume(volumeMenu.playerId, Number(event.target.value) / 100)
                }}
                disabled={volumeMenu.playerId === playerId}
              />
              <p className="volumeMenuValue">
                {volumeMenu.playerId === playerId
                  ? 'Your own mic volume is controlled by system input settings.'
                  : `${Math.round(getPlayerVolume(volumeMenu.playerId) * 100)}%`}
              </p>
            </div>
          ) : null}
        </section>
      </main>
    )
  }

  if (roomState) {
    const connectedPlayerIds = new Set(roomState.connectedPlayerIds ?? [])
    const disconnectedPlayers = roomState.room.players.filter(
      (player) => !connectedPlayerIds.has(player.id),
    )

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
                  <strong>{connectedPlayerIds.has(player.id) ? 'Online' : 'Offline'}</strong>
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
              disabled={!canStartGame || Boolean(roomState.startRequested)}
            >
              {roomState.startRequested ? 'Waiting for players...' : 'Start'}
            </button>
          ) : (
            <p className="hintText">
              {roomState.startRequested
                ? 'Host started the game. Waiting for everyone to reconnect.'
                : 'Waiting for host to start the game.'}
            </p>
          )}

          {isHost && !canStartGame ? (
            <p className="hintText">At least 2 players are required to start.</p>
          ) : null}

          {roomState.startRequested && disconnectedPlayers.length > 0 ? (
            <p className="hintText">
              Waiting for: {disconnectedPlayers.map((player) => player.name).join(', ')}
            </p>
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
