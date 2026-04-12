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
  onStartGame,
  onExitRoom,
}: RoomScreenProps) {
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
          {roomPathPrefix}
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
            onChange={(event) => onUpdateTimer(Number(event.target.value))}
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
