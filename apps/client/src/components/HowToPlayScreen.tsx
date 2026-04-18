import { ts } from '../i18n'
import './InfoPage.css'

interface HowToPlayScreenProps {
  onBack: () => void
}

// страница с правилами игры
export function HowToPlayScreen({ onBack }: HowToPlayScreenProps) {
  return (
    <main className="infoScreen">
      <div className="infoHero">
        <button type="button" className="backButton" onClick={onBack}>{ts('howToPlay.back')}</button>
        <h1 className="title">{ts('howToPlay.title')}</h1>
      </div>

      <div className="infoPanel">
        <div className="infoSection">
          <h2 className="infoHeading">{ts('howToPlay.whatIsTitle')}</h2>
          <div className="infoContent">
            <p>{ts('howToPlay.whatIsText')}</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('howToPlay.gettingStartedTitle')}</h2>
          <div className="infoContent">
            <ol>
              <li dangerouslySetInnerHTML={{ __html: ts('howToPlay.gettingStarted1') }} />
              <li dangerouslySetInnerHTML={{ __html: ts('howToPlay.gettingStarted2') }} />
              <li dangerouslySetInnerHTML={{ __html: ts('howToPlay.gettingStarted3') }} />
              <li dangerouslySetInnerHTML={{ __html: ts('howToPlay.gettingStarted4') }} />
            </ol>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('howToPlay.gameplayTitle')}</h2>
          <div className="infoContent">
            <ul>
              <li dangerouslySetInnerHTML={{ __html: ts('howToPlay.gameplay1') }} />
              <li>{ts('howToPlay.gameplay2')}</li>
              <li>{ts('howToPlay.gameplay3')}</li>
              <li dangerouslySetInnerHTML={{ __html: ts('howToPlay.gameplay4') }} />
              <li>{ts('howToPlay.gameplay5')}</li>
            </ul>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('howToPlay.winningTitle')}</h2>
          <div className="infoContent">
            <p dangerouslySetInnerHTML={{ __html: ts('howToPlay.winningText') }} />
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('howToPlay.tipsTitle')}</h2>
          <div className="infoContent">
            <ul>
              <li>{ts('howToPlay.tip1')}</li>
              <li>{ts('howToPlay.tip2')}</li>
              <li>{ts('howToPlay.tip3')}</li>
              <li>{ts('howToPlay.tip4')}</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
