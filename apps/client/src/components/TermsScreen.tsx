import { ts, ta } from '../i18n'
import './InfoPage.css'

interface TermsScreenProps {
  onBack: () => void
}

// страница с условиями использования
export function TermsScreen({ onBack }: TermsScreenProps) {
  return (
    <main className="infoScreen">
      <div className="infoHero">
        <button type="button" className="backButton" onClick={onBack}>{ts('terms.back')}</button>
        <h1 className="title">{ts('terms.title')}</h1>
      </div>

      <div className="infoPanel">
        <div className="infoSection">
          <p className="infoMeta">{ts('terms.lastUpdated')}</p>
          <h2 className="infoHeading">{ts('terms.s1title')}</h2>
          <div className="infoContent">
            <p>{ts('terms.s1text')}</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('terms.s2title')}</h2>
          <div className="infoContent">
            <p>{ts('terms.s2text')}</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('terms.s3title')}</h2>
          <div className="infoContent">
            <ul>
              {ta('terms.s3items').map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('terms.s4title')}</h2>
          <div className="infoContent">
            <p>{ts('terms.s4intro')}</p>
            <ul>
              {ta('terms.s4items').map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('terms.s5title')}</h2>
          <div className="infoContent">
            <p>{ts('terms.s5text')}</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('terms.s6title')}</h2>
          <div className="infoContent">
            <p>{ts('terms.s6text')}</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('terms.s7title')}</h2>
          <div className="infoContent">
            <p>{ts('terms.s7text')}</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('terms.s8title')}</h2>
          <div className="infoContent">
            <p>{ts('terms.s8text')}</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('terms.s9title')}</h2>
          <div className="infoContent">
            <p>{ts('terms.s9text')}</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">{ts('terms.s10title')}</h2>
          <div className="infoContent">
            <p>{ts('terms.s10text')}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
