import './InfoPage.css'

interface HowToPlayScreenProps {
  onBack: () => void
}

export function HowToPlayScreen({ onBack }: HowToPlayScreenProps) {
  return (
    <main className="infoScreen">
      <div className="infoHero">
        <button type="button" className="backButton" onClick={onBack}>← Back</button>
        <h1 className="title">How to Play</h1>
      </div>

      <div className="infoPanel">
        <div className="infoSection">
          <h2 className="infoHeading">What is Alias?</h2>
          <div className="infoContent">
            <p>
              Alias is a word-guessing party game where players take turns explaining words
              to their teammates — without using the word itself, its root, or direct translations.
              The goal is for your team to guess as many words as possible before the timer runs out.
            </p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">Getting Started</h2>
          <div className="infoContent">
            <ol>
              <li><strong>Create or join a room</strong> — One player creates a room and shares the room code (or link) with friends.</li>
              <li><strong>Wait for players</strong> — At least 2 players are required. Everyone joins using the room code.</li>
              <li><strong>Host configures the game</strong> — The host can adjust the timer duration, win score, and word collections.</li>
              <li><strong>Start the game</strong> — Once everyone is connected, the host presses Start.</li>
            </ol>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">Gameplay</h2>
          <div className="infoContent">
            <ul>
              <li>Players take turns being the <strong>explainer</strong>.</li>
              <li>When it's your turn, you'll see a word on screen. Describe it without saying the word, its root, or rhyming clues.</li>
              <li>Your teammates type their guesses in the chat. Correct guesses earn points automatically.</li>
              <li>You can <strong>skip</strong> a difficult word, but it costs a point penalty.</li>
              <li>When the timer runs out, the turn passes to the next player.</li>
            </ul>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">Winning</h2>
          <div className="infoContent">
            <p>
              The first player to reach the <strong>win score</strong> wins the game.
              The default is 50 points, but the host can change this before starting.
            </p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">Tips</h2>
          <div className="infoContent">
            <ul>
              <li>Use synonyms, antonyms, and associations.</li>
              <li>Describe the context or situation where the word is used.</li>
              <li>Be creative — vivid descriptions are your best tool online!</li>
              <li>Don't waste too much time on a hard word — skip it and move on.</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
