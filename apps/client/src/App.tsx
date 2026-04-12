import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import './App.css'
import { ROOM_PATH_PREFIX } from './config/client'
import { AuthModal } from './components/AuthModal'
import { GameScreen } from './components/GameScreen'
import { Header } from './components/Header'
import { JoinScreen } from './components/JoinScreen'
import { RoomScreen } from './components/RoomScreen'
import {
  loginRequest,
  parseAuthErrorResponse,
  parseAuthResponse,
  registerRequest,
} from './services/authApi'
import type { AuthUser } from './types/auth'
import { clearStoredAuthUser, getStoredAuthUser, setStoredAuthUser } from './utils/authSession'
import {
  createRoomRequest,
  fetchRoomChatRequest,
  fetchRoomStateRequest,
  joinRoomRequest,
  mapRoomState,
  parseChatListResponse,
  parseChatMessageResponse,
  parseRoomJoinResponse,
  parseRoomStateResponse,
  sendChatMessageRequest,
  skipWordRequest,
  startGameRequest,
  updateTimerRequest,
} from './services/roomApi'
import type { ChatMessage, Player, RoomState, VolumeMenuState, WsPayload } from './types/game'
import { getRoomCodeFromPath, pushRoomPath } from './utils/roomPath'
import { clearStoredRoomSession, getStoredRoomSession, setStoredRoomSession } from './utils/roomSession'

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser())
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const [name, setName] = useState(() => getStoredAuthUser()?.name ?? '')
  const [roomCode, setRoomCode] = useState(() => getRoomCodeFromPath(window.location.pathname))
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [gameStartsIn, setGameStartsIn] = useState(0)
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [playerVolumes, setPlayerVolumes] = useState<Record<string, number>>({})
  const [volumeMenu, setVolumeMenu] = useState<VolumeMenuState | null>(null)
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

  const openVolumeMenu = (event: MouseEvent, targetPlayerId: string, targetPlayerName: string) => {
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
    const response = await joinRoomRequest(trimmedRoomCode, trimmedName, existingPlayerId)

    if (response.status === 404) {
      setStatusMessage('Room not found. Check the room code and try again.')
      if (options?.isAutoReconnect) {
        clearStoredRoomSession()
      }
      return
    }

    if (response.status === 403) {
      setStatusMessage('Game already started; only existing players can reconnect.')
      if (options?.isAutoReconnect) {
        clearStoredRoomSession()
      }
      return
    }

    if (!response.ok) {
      setStatusMessage('Failed to join room. Is the server running on port 3000?')
      return
    }

    const data = await parseRoomJoinResponse(response)
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
    if (authUser) {
      setName(authUser.name)
    }
  }, [authUser])

  useEffect(() => {
    if (roomState) {
      return
    }

    const roomCodeFromPath = getRoomCodeFromPath(window.location.pathname)
    if (!roomCodeFromPath) {
      return
    }

    const session = getStoredRoomSession()
    if (session && session.roomId === roomCodeFromPath) {
      setName(session.name)
      setRoomCode(roomCodeFromPath)
      void joinRoom({
        playerName: session.name,
        targetRoomCode: session.roomId,
        existingPlayerId: session.playerId,
        isAutoReconnect: true,
      })
      return
    }

    setRoomCode(roomCodeFromPath)

    if (authUser) {
      void joinRoom({
        playerName: authUser.name,
        targetRoomCode: roomCodeFromPath,
      })
    }
  }, [roomState, authUser])

  useEffect(() => {
    if (!roomState) {
      return
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetchRoomStateRequest(roomState.roomId)
        if (!response.ok) {
          return
        }
        const data = await parseRoomStateResponse(response)
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
        const response = await fetchRoomChatRequest(roomState.roomId)
        if (!response.ok) {
          return
        }

        const data = await parseChatListResponse(response)
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
        const data = JSON.parse(event.data) as WsPayload

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
    const response = await createRoomRequest(trimmedName)

    if (!response.ok) {
      setStatusMessage('Failed to create room. Is the server running on port 3000?')
      return
    }

    const data = await parseRoomJoinResponse(response)
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

    const response = await updateTimerRequest(roomState.roomId, playerId, nextTimer)

    if (!response.ok) {
      setStatusMessage('Failed to update timer setting.')
      return
    }

    const data = await parseRoomStateResponse(response)
    setRoomState(mapRoomState(data))
  }

  const startGame = async () => {
    if (!roomState || !playerId || !canStartGame) {
      return
    }

    const response = await startGameRequest(roomState.roomId, playerId)

    if (!response.ok) {
      setStatusMessage('Could not start game.')
      return
    }

    const data = await parseRoomStateResponse(response)
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

    const response = await sendChatMessageRequest(roomState.roomId, playerId, trimmedText)

    if (!response.ok) {
      setStatusMessage('Could not send message.')
      return
    }

    const data = await parseChatMessageResponse(response)
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

    const response = await skipWordRequest(roomState.roomId, playerId)

    if (!response.ok) {
      setStatusMessage('Could not skip word.')
      return
    }

    const data = await parseRoomStateResponse(response)
    setRoomState(mapRoomState(data))
    setStatusMessage('Word skipped.')
  }

  const handleLogin = async (username: string, password: string) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await loginRequest(username, password)
      if (!response.ok) {
        const message = await parseAuthErrorResponse(response)
        setAuthError(message)
        return
      }
      const data = await parseAuthResponse(response)
      const user: AuthUser = { id: String(data.id), name: data.username }
      setStoredAuthUser(user)
      setAuthUser(user)
      setAuthModal(null)
      setAuthError('')
    } catch {
      setAuthError('Could not reach the server. Is it running?')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async (username: string, email: string, password: string) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await registerRequest(username, email, password)
      if (!response.ok) {
        const message = await parseAuthErrorResponse(response)
        setAuthError(message)
        return
      }
      const data = await parseAuthResponse(response)
      const user: AuthUser = { id: String(data.id), name: data.username }
      setStoredAuthUser(user)
      setAuthUser(user)
      setAuthModal(null)
      setAuthError('')
    } catch {
      setAuthError('Could not reach the server. Is it running?')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    clearStoredAuthUser()
    setAuthUser(null)
  }

  const handleNavigate = (_page: 'profile' | 'friends' | 'stats' | 'collections') => {
    // TODO: implement page navigation when those pages are ready
  }

  const screenContent = roomState?.started ? (
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
      onSendChatMessage={() => {
        void sendChatMessage()
      }}
      onSkipWord={() => {
        void skipWord()
      }}
      onOpenVolumeMenu={openVolumeMenu}
      onUpdatePlayerVolume={updatePlayerVolume}
    />
  ) : roomState ? (
    <RoomScreen
      roomState={roomState}
      playerId={playerId}
      isHost={isHost}
      canStartGame={canStartGame}
      statusMessage={statusMessage}
      roomPathPrefix={ROOM_PATH_PREFIX}
      onUpdateTimer={(nextTimer) => {
        void updateTimer(nextTimer)
      }}
      onStartGame={() => {
        void startGame()
      }}
    />
  ) : (
    <JoinScreen
      name={name}
      roomCode={roomCode}
      statusMessage={statusMessage}
      nameReadOnly={!!authUser}
      onNameChange={setName}
      onRoomCodeChange={setRoomCode}
      onJoin={() => {
        void joinRoom()
      }}
      onCreateRoom={() => {
        void createRoom()
      }}
    />
  )

  return (
    <div className="appLayout">
      <Header
        user={authUser}
        onLoginClick={() => setAuthModal('login')}
        onRegisterClick={() => setAuthModal('register')}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
      {screenContent}
      {authModal && (
        <AuthModal
          initialTab={authModal}
          serverError={authError}
          loading={authLoading}
          onClose={() => {
            setAuthModal(null)
            setAuthError('')
          }}
          onLogin={(username, password) => {
            void handleLogin(username, password)
          }}
          onRegister={(username, email, password) => {
            void handleRegister(username, email, password)
          }}
        />
      )}
    </div>
  )
}

export default App
