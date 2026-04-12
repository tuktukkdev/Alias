import type { ChatMessage, Player, RoomState, VolumeMenuState } from '../types/game'
import './GameScreen.css'

interface GameScreenProps {
  roomState: RoomState
  playerId: string | null
  chatInput: string
  chatMessages: ChatMessage[]
  statusMessage: string
  gameStartsIn: number
  activeWord: string | null
  volumeMenu: VolumeMenuState | null
  chatListRef: React.RefObject<HTMLUListElement | null>
  volumeMenuRef: React.RefObject<HTMLDivElement | null>
  getPlayerVolume: (playerId: string) => number
  onChatInputChange: (value: string) => void
  onSendChatMessage: () => void
  onSkipWord: () => void
  onOpenVolumeMenu: (event: React.MouseEvent, playerId: string, playerName: string) => void
  onUpdatePlayerVolume: (playerId: string, volume: number) => void
  onExitRoom: () => void
}

const getTurnTimerText = (
  roomState: RoomState,
  gameStartsIn: number,
  activePlayer: Player | undefined,
  turnSecondsLeft: number,
) => {
  if (gameStartsIn > 0) {
    return (
      <>
        Game starts in <strong>{gameStartsIn}s</strong>
      </>
    )
  }

  if (roomState.waitingForWordResolutionAtZero) {
    return (
      <>
        Time Left: <strong>0s</strong>
        {activePlayer ? ` | Waiting for "${activePlayer.name}" word to be guessed or skipped` : ''}
      </>
    )
  }

  return (
    <>
      Time Left: <strong>{turnSecondsLeft}s</strong>
      {activePlayer ? ` | Turn: ${activePlayer.name}` : ''}
    </>
  )
}

export function GameScreen({
  roomState,
  playerId,
  chatInput,
  chatMessages,
  statusMessage,
  gameStartsIn,
  activeWord,
  volumeMenu,
  chatListRef,
  volumeMenuRef,
  getPlayerVolume,
  onChatInputChange,
  onSendChatMessage,
  onSkipWord,
  onOpenVolumeMenu,
  onUpdatePlayerVolume,
  onExitRoom,
}: GameScreenProps) {
  const activePlayer = roomState.room.players.find((player) => player.id === roomState.currentTurnPlayerId)
  const turnSecondsLeft = roomState.turnSecondsRemaining ?? roomState.room.settings.timer
  const isActivePlayer = Boolean(playerId && roomState.currentTurnPlayerId === playerId)
  const speakingPlayerId = gameStartsIn === 0 ? roomState.currentTurnPlayerId : null

  return (
    <main className="screen">
      <section className="panel gamePanel">
        <h1 className="title">Game Room {roomState.roomId}</h1>
        <p className="turnTimer">
          {getTurnTimerText(roomState, gameStartsIn, activePlayer, turnSecondsLeft)}
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
                      onContextMenu={(event) => onOpenVolumeMenu(event, player.id, player.name)}
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
              <button type="button" className="skipButton" onClick={onSkipWord}>
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
                onSendChatMessage()
              }}
            >
              <input
                className="input"
                value={chatInput}
                onChange={(event) => onChatInputChange(event.target.value)}
                placeholder="Type your guess"
                maxLength={50}
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
                onUpdatePlayerVolume(volumeMenu.playerId, Number(event.target.value) / 100)
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

        <button type="button" className="exitButton" onClick={onExitRoom}>
          Exit Game
        </button>
      </section>

      {roomState.winner && (
        <div className="winnerOverlay">
          <div className="winnerPanel">
            <h2 className="winnerTitle">Game Over!</h2>
            <p className="winnerName">🏆 {roomState.winner.playerName} wins!</p>
            <button type="button" className="mainMenuButton" onClick={onExitRoom}>
              Main Menu
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
