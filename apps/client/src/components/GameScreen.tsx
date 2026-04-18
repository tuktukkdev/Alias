import type { ChatMessage, Player, RoomState, VolumeMenuState } from '../types/game'
import { ts } from '../i18n'
import './GameScreen.css'

// пропсы экрана игры
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

// формируем текст таймера хода
const getTurnTimerText = (
  roomState: RoomState,
  gameStartsIn: number,
  activePlayer: Player | undefined,
  turnSecondsLeft: number,
) => {
  if (gameStartsIn > 0) {
    return (
      <>
        {ts('game.startsIn')} <strong>{gameStartsIn}s</strong>
      </>
    )
  }

  if (roomState.waitingForWordResolutionAtZero) {
    return (
      <>
        {ts('game.timeLeft')} <strong>0s</strong>
        {activePlayer ? ` | ${ts('game.waitingForWord').replace('{name}', activePlayer.name)}` : ''}
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

// компонент экрана игры с чатом, табло и карточкой слова
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
        <h1 className="title">{ts('game.title')} {roomState.roomId}</h1>
        <p className="turnTimer">
          {getTurnTimerText(roomState, gameStartsIn, activePlayer, turnSecondsLeft)}
        </p>

        <div className="gameLayout">
          <div className="gameColumn scoreboardSection">
            <h2 className="sectionTitle">{ts('game.playersScore')}</h2>
            <table className="scoreboardTable">
              <thead>
                <tr>
                  <th scope="col">{ts('game.player')}</th>
                  <th scope="col">{ts('game.score')}</th>
                  <th scope="col" className="voiceHeaderCell">
                    {ts('game.voice')}
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
                        {player.id === playerId ? ` ${ts('game.you')}` : ''}
                      </td>
                      <td>{player.score}</td>
                      <td className="voiceCell">
                        <span
                          className={`voiceIndicator ${isSpeaking ? 'voiceIndicatorActive' : ''}`}
                          title={isSpeaking ? ts('game.isSpeaking').replace('{name}', player.name) : ts('game.isMuted').replace('{name}', player.name)}
                          aria-label={isSpeaking ? ts('game.isSpeaking').replace('{name}', player.name) : ts('game.isMuted').replace('{name}', player.name)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="gameColumn futureColumn wordColumn">
            <h2 className="sectionTitle">{ts('game.wordCard')}</h2>
            <div className="wordCard">
              {gameStartsIn > 0 ? (
                <p className="wordHint">{ts('game.getReady')}</p>
              ) : isActivePlayer ? (
                <p className="wordValue">{activeWord ?? ts('game.loadingWord')}</p>
              ) : (
                <p className="wordHint">
                  {activePlayer
                    ? ts('game.explaining').replace('{name}', activePlayer.name)
                    : ts('game.waitingForPlayer')}
                </p>
              )}
            </div>

            {isActivePlayer && gameStartsIn === 0 ? (
              <button type="button" className="skipButton" onClick={onSkipWord}>
                {ts('game.skipWord')}
              </button>
            ) : null}
          </div>

          <div className="gameColumn chatSection">
            <h2 className="sectionTitle">{ts('game.chat')}</h2>
            <ul className="chatList" ref={chatListRef}>
              {chatMessages.map((message) => (
                <li
                  key={message.id}
                  className={`chatItem ${message.playerId === playerId ? 'ownMessage' : ''}`}
                >
                  <p className="chatMeta">
                    {message.playerName}
                    {message.playerId === playerId ? ` ${ts('game.you')}` : ''}
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
                placeholder={ts('game.typeGuess')}
                maxLength={50}
              />
              <button type="submit" className="playButton">
                {ts('game.send')}
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
            <p className="volumeMenuTitle">{ts('game.volume')} {volumeMenu.playerName}</p>
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
                ? ts('game.ownMic')
                : `${Math.round(getPlayerVolume(volumeMenu.playerId) * 100)}%`}
            </p>
          </div>
        ) : null}

        <button type="button" className="exitButton" onClick={onExitRoom}>
          {ts('game.exitGame')}
        </button>
      </section>

      {roomState.winner && (
        <div className="winnerOverlay">
          <div className="winnerPanel">
            <h2 className="winnerTitle">{ts('game.gameOver')}</h2>
            <p className="winnerName">{ts('game.wins').replace('{name}', roomState.winner.playerName)}</p>
            <button type="button" className="mainMenuButton" onClick={onExitRoom}>
              {ts('game.mainMenu')}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
