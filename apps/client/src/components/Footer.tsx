import { ts } from '../i18n'
import './Footer.css'

// пропсы футера
interface FooterProps {
  onNavigate: (page: 'howtoplay' | 'terms') => void
}

// компонент футера с навигацией
export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <span className="footerLogo">{ts('footer.logo')}</span>
        <nav className="footerLinks">
          <button type="button" className="footerLink" onClick={() => onNavigate('howtoplay')}>
            {ts('footer.howToPlay')}
          </button>
          <button type="button" className="footerLink" onClick={() => onNavigate('terms')}>
            {ts('footer.terms')}
          </button>
        </nav>
        <p className="footerCopyright">{ts('footer.copyright')}</p>
      </div>
    </footer>
  )
}
