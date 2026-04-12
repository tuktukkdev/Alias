import { useState } from 'react'
import type { RoomState } from '../types/game'
import './RoomScreen.css'

interface RoomScreenProps {
  roomState: RoomState
  playerId: string | null
  isHost: boolean
  canStartGame: boolean
  statusMessage: string
  roomPathPrefix: string
  onUpdateTimer: (timer: number) => void
  onUpdateDifficulty: (difficulty: number) => void
  onUpdateWinScore: (winScore: number) => void
  onOpenCollectionPicker: () => void
  onStartGame: () => void
  onExitRoom: () => void
}

export function RoomScreen({
  roomState,
  playerId,
  isHost,
  canStartGame,
  statusMessage,
  roomPathPrefix,
  onUpdateTimer,
  onUpdateDifficulty,
  onUpdateWinScore,
  onOpenCollectionPicker,
  onStartGame,
  onExitRoom,
}: RoomScreenProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const connectedPlayerIds = new Set(roomState.connectedPlayerIds ?? [])
  const disconnectedPlayers = roomState.room.players.filter(
    (player) => !connectedPlayerIds.has(player.id),
  )

  return (
    <main className="screen">
      <section className="panel roomPanel">
        <h1 className="title">Room {roomState.roomId}</h1>
        <div className="roomShareRow">
          <span className="hintText roomShareLabel">Code: <strong>{roomState.roomId}</strong></span>
          <button
            type="button"
            className="copyBtn"
            title="Copy code"
            onClick={() => {
              void navigator.clipboard.writeText(roomState.roomId)
              setCopiedCode(true)
              setTimeout(() => setCopiedCode(false), 2000)
            }}
          >
            {copiedCode ? '✓' : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
                <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            )}
          </button>
          <button
            type="button"
            className="copyBtn"
            title="Copy room link"
            onClick={() => {
              const link = `${window.location.origin}${roomPathPrefix}${roomState.roomId}`
              void navigator.clipboard.writeText(link)
              setCopiedLink(true)
              setTimeout(() => setCopiedLink(false), 2000)
            }}
          >
            {copiedLink ? '✓' : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7C4.24 7 2 9.24 2 12s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
              </svg>
            )}
          </button>
        </div>

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
            onChange={(event) => onUpdateTimer(Number(event.target.value))}
          />
        </div>

        <div className="timerRow">
          <label htmlFor="difficulty" className="label">
            Difficulty: {roomState.room.settings.difficulty}
          </label>
          <input
            id="difficulty"
            type="range"
            min={1}
            max={3}
            step={1}
            value={roomState.room.settings.difficulty}
            disabled={!isHost}
            onChange={(event) => onUpdateDifficulty(Number(event.target.value))}
          />
        </div>

        <div className="timerRow">
          <label htmlFor="winScore" className="label">
            Win Score: {roomState.room.settings.winScore ?? 50}
          </label>
          <input
            id="winScore"
            type="range"
            min={20}
            max={200}
            step={5}
            value={roomState.room.settings.winScore ?? 50}
            disabled={!isHost}
            onChange={(event) => onUpdateWinScore(Number(event.target.value))}
          />
        </div>

        {isHost && (
          <button type="button" className="collectionsPickerBtn" onClick={onOpenCollectionPicker}>
            Choose Collections
            {(roomState.room.settings.selectedCollections?.length ?? 0) > 0 &&
              ` (${roomState.room.settings.selectedCollections?.length ?? 0})`}
          </button>
        )}

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
            onClick={onStartGame}
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

        <button type="button" className="exitButton" onClick={onExitRoom}>
          Exit Room
        </button>
      </section>
    </main>
  )
}
