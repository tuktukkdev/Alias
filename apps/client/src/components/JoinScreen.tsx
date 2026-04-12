import './JoinScreen.css'

interface JoinScreenProps {
  name: string
  roomCode: string
  statusMessage: string
  nameReadOnly?: boolean
  onNameChange: (value: string) => void
  onRoomCodeChange: (value: string) => void
  onJoin: () => void
  onCreateRoom: () => void
}

export function JoinScreen({
  name,
  roomCode,
  statusMessage,
  nameReadOnly,
  onNameChange,
  onRoomCodeChange,
  onJoin,
  onCreateRoom,
}: JoinScreenProps) {
  return (
    <main className="screen">
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault()
          onJoin()
        }}
      >
        <label htmlFor="name" className="label">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className={`input${nameReadOnly ? ' inputLocked' : ''}`}
          value={name}
          readOnly={nameReadOnly}
          onChange={(event) => onNameChange(event.target.value)}
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
          onChange={(event) => onRoomCodeChange(event.target.value)}
        />
        <div className="actions">
          <button type="submit" className="playButton">
            Play
          </button>
          <button type="button" className="createRoomButton" onClick={onCreateRoom}>
            Create Room
          </button>
        </div>
        {statusMessage ? <p className="hintText">{statusMessage}</p> : null}
      </form>
    </main>
  )
}
