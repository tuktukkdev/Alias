import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Player, VolumeMenuState } from '../types/game'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: ['stun:stun.cloudflare.com:3478'] },
  ],
  iceCandidatePoolSize: 10,
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

interface UseVoiceChatOptions {
  chatSocketRef: React.RefObject<WebSocket | null>
  roomStarted: boolean
  players: Player[]
  playerId: string | null
  currentTurnPlayerId: string | null | undefined
  gameStartsIn: number
}

export function useVoiceChat({
  chatSocketRef,
  roomStarted,
  players,
  playerId,
  currentTurnPlayerId,
  gameStartsIn,
}: UseVoiceChatOptions) {
  const [playerVolumes, setPlayerVolumes] = useState<Record<string, number>>({})
  const [volumeMenu, setVolumeMenu] = useState<VolumeMenuState | null>(null)

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const localAudioStreamRef = useRef<MediaStream | null>(null)
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null)
  const playerVolumesRef = useRef<Record<string, number>>({})
  const volumeMenuRef = useRef<HTMLDivElement | null>(null)

  const getPlayerVolume = (targetPlayerId: string) => {
    return playerVolumes[targetPlayerId] ?? playerVolumesRef.current[targetPlayerId] ?? 1
  }

  const updatePlayerVolume = (targetPlayerId: string, volume: number) => {
    const normalizedVolume = Math.max(0, Math.min(1, volume))

    setPlayerVolumes((current) => {
      const next = { ...current, [targetPlayerId]: normalizedVolume }
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
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'voice_signal', toPlayerId, signal }))
  }

  const stopLocalAudio = () => {
    const stream = localAudioStreamRef.current
    if (!stream) return
    stream.getTracks().forEach((track) => track.stop())
    localAudioStreamRef.current = null
    localAudioTrackRef.current = null
  }

  const setLocalTrackEnabled = (enabled: boolean) => {
    const track = localAudioTrackRef.current
    if (track) track.enabled = enabled
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
      // Some browsers may reject bitrate tuning.
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
    if (pendingCandidates.length === 0) return
    pendingIceRef.current.delete(remotePlayerId)
    for (const candidate of pendingCandidates) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // Candidate can be stale when peers reconnect.
      }
    }
  }

  const getOrCreatePeerConnection = (remotePlayerId: string) => {
    const existing = peerConnectionsRef.current.get(remotePlayerId)
    if (existing) return existing

    const connection = new RTCPeerConnection(RTC_CONFIG)

    connection.onicecandidate = (event) => {
      if (!event.candidate) return
      sendVoiceSignal(remotePlayerId, { type: 'ice', candidate: event.candidate.toJSON() })
    }

    connection.ontrack = (event) => {
      const [remoteStream] = event.streams
      if (!remoteStream) return

      let audioElement = remoteAudioElementsRef.current.get(remotePlayerId)
      if (!audioElement) {
        audioElement = new Audio()
        audioElement.autoplay = true
        remoteAudioElementsRef.current.set(remotePlayerId, audioElement)
      }

      audioElement.volume = getPlayerVolume(remotePlayerId)
      audioElement.srcObject = remoteStream
      void audioElement.play().catch(() => {})
    }

    peerConnectionsRef.current.set(remotePlayerId, connection)
    return connection
  }

  const ensurePeerConnectionsForRoom = (roomPlayers: Player[], ownPlayerId: string) => {
    const expectedRemoteIds = new Set(roomPlayers.filter((p) => p.id !== ownPlayerId).map((p) => p.id))

    for (const [remotePlayerId, connection] of peerConnectionsRef.current) {
      if (expectedRemoteIds.has(remotePlayerId)) continue
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
    if (!audioTrack) throw new Error('No audio track available')
    localAudioStreamRef.current = stream
    localAudioTrackRef.current = audioTrack
    return audioTrack
  }

  const attachOrReplaceTrack = async (connection: RTCPeerConnection, track: MediaStreamTrack) => {
    const existingSender = connection.getSenders().find((s) => s.track?.kind === 'audio')
    if (existingSender) {
      if (existingSender.track !== track) await existingSender.replaceTrack(track)
      await tuneAudioSender(existingSender)
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
    sendVoiceSignal(remotePlayerId, { type: 'offer', sdp: offer.sdp })
  }

  const handleVoiceSignal = (fromPlayerId: string, signal: { type?: string; sdp?: string; candidate?: RTCIceCandidateInit }) => {
    const connection = getOrCreatePeerConnection(fromPlayerId)

    if (signal.type === 'offer' && signal.sdp) {
      void (async () => {
        await connection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp ?? '' }))
        await drainPendingIce(fromPlayerId, connection)
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)
        sendVoiceSignal(fromPlayerId, { type: 'answer', sdp: answer.sdp })
      })().catch(() => {})
      return
    }

    if (signal.type === 'answer' && signal.sdp) {
      void (async () => {
        await connection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp ?? '' }))
        await drainPendingIce(fromPlayerId, connection)
      })().catch(() => {})
      return
    }

    if (signal.type === 'ice' && signal.candidate) {
      if (connection.remoteDescription) {
        void connection.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {})
      } else {
        const queued = pendingIceRef.current.get(fromPlayerId) ?? []
        queued.push(signal.candidate)
        pendingIceRef.current.set(fromPlayerId, queued)
      }
    }
  }

  // Close volume menu when game stops
  useEffect(() => {
    if (!roomStarted) setVolumeMenu(null)
  }, [roomStarted])

  // Volume menu dismiss on click-outside / Escape
  useEffect(() => {
    if (!volumeMenu) return
    const handlePointerDown = (event: PointerEvent) => {
      if (volumeMenuRef.current?.contains(event.target as Node)) return
      setVolumeMenu(null)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVolumeMenu(null)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [volumeMenu])

  // Voice setup per turn
  useEffect(() => {
    if (!roomStarted || !playerId) {
      stopLocalAudio()
      clearVoiceConnections()
      return
    }

    ensurePeerConnectionsForRoom(players, playerId)

    if (gameStartsIn > 0) {
      setLocalTrackEnabled(false)
      return
    }

    let cancelled = false
    const isSpeaker = currentTurnPlayerId === playerId

    const setupVoice = async () => {
      if (!isSpeaker) {
        setLocalTrackEnabled(false)
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) return

      try {
        const localTrack = await ensureLocalAudioTrack()
        if (cancelled) return

        localTrack.enabled = true
        const peers = players.filter((p) => p.id !== playerId)
        for (const peer of peers) {
          const connection = getOrCreatePeerConnection(peer.id)
          const addedNew = await attachOrReplaceTrack(connection, localTrack)
          if (addedNew) await createOfferForPeer(peer.id, connection)
        }
      } catch {
        // Allow microphone access to speak during your turn.
      }
    }

    void setupVoice()
    return () => { cancelled = true }
  }, [gameStartsIn, playerId, roomStarted, currentTurnPlayerId, players])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocalAudio()
      clearVoiceConnections()
    }
  }, [])

  return {
    playerVolumes,
    volumeMenu,
    setVolumeMenu,
    volumeMenuRef,
    getPlayerVolume,
    updatePlayerVolume,
    openVolumeMenu,
    handleVoiceSignal,
  }
}
