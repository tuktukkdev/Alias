import './Footer.css'

interface FooterProps {
  onNavigate: (page: 'howtoplay' | 'terms') => void
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <span className="footerLogo">Alias</span>
        <nav className="footerLinks">
          <button type="button" className="footerLink" onClick={() => onNavigate('howtoplay')}>
            How to Play
          </button>
          <button type="button" className="footerLink" onClick={() => onNavigate('terms')}>
            Terms of Service
          </button>
        </nav>
        <p className="footerCopyright">Valentina Vladimirova &middot; 2026</p>
      </div>
    </footer>
  )
}
