import './InfoPage.css'

interface TermsScreenProps {
  onBack: () => void
}

export function TermsScreen({ onBack }: TermsScreenProps) {
  return (
    <main className="infoScreen">
      <div className="infoHero">
        <button type="button" className="backButton" onClick={onBack}>← Back</button>
        <h1 className="title">Terms of Service</h1>
      </div>

      <div className="infoPanel">
        <div className="infoSection">
          <p className="infoMeta">Last updated: April 13, 2026</p>
          <h2 className="infoHeading">1. Acceptance of Terms</h2>
          <div className="infoContent">
            <p>By accessing and using the Alias online word game ("Service"), you agree to be bound by these Terms of Service. If you do not agree, please stop using the Service.</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">2. Description of Service</h2>
          <div className="infoContent">
            <p>Alias is a free online multiplayer word-guessing game. We provide the platform for entertainment purposes. The Service is offered "as is" without warranties of any kind.</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">3. User Accounts</h2>
          <div className="infoContent">
            <ul>
              <li>You may create an account using a username, email, and password.</li>
              <li>You are responsible for keeping your login credentials secure.</li>
              <li>You must provide accurate information when registering.</li>
              <li>You must be at least 13 years of age to use this Service.</li>
            </ul>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">4. Acceptable Use</h2>
          <div className="infoContent">
            <p>You agree not to:</p>
            <ul>
              <li>Use offensive, hateful, or inappropriate language in chat or usernames.</li>
              <li>Attempt to hack, exploit, or disrupt the Service.</li>
              <li>Impersonate other users or third parties.</li>
              <li>Use the Service for any commercial or illegal purpose.</li>
            </ul>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">5. Content &amp; Collections</h2>
          <div className="infoContent">
            <p>Word collections provided in the game are curated for entertainment. Users may create custom word collections. You retain ownership of content you create, but grant us a license to display it within the Service.</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">6. Privacy</h2>
          <div className="infoContent">
            <p>We collect minimal data necessary to operate the Service: your username, email (for account recovery), and game statistics. We do not sell your personal information to third parties.</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">7. Termination</h2>
          <div className="infoContent">
            <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time by contacting us.</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">8. Limitation of Liability</h2>
          <div className="infoContent">
            <p>The Service is provided for entertainment only. We are not liable for any damages arising from the use of the Service, including but not limited to data loss, service interruptions, or third-party actions.</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">9. Changes to Terms</h2>
          <div className="infoContent">
            <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
          </div>
        </div>

        <div className="infoSection">
          <h2 className="infoHeading">10. Contact</h2>
          <div className="infoContent">
            <p>For questions about these Terms, please reach out through the game's support channels.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
