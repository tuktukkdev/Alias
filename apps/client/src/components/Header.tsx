import { useEffect, useRef, useState } from 'react'
import type { AuthUser } from '../types/auth'

interface HeaderProps {
  user: AuthUser | null
  pendingFriendRequests: number
  onLoginClick: () => void
  onRegisterClick: () => void
  onLogout: () => void
  onNavigate: (page: 'profile' | 'friends' | 'stats' | 'collections') => void
}

export function Header({ user, pendingFriendRequests, onLoginClick, onRegisterClick, onLogout, onNavigate }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return

    const handlePointerDown = (e: PointerEvent) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setDropdownOpen(false)
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [dropdownOpen])

  return (
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <span className="siteHeaderLogo">Alias</span>
        <nav className="siteHeaderNav">
          {user ? (
            <div className="userMenu" ref={dropdownRef}>
              <button
                className="avatarButton"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-label="User menu"
                aria-expanded={dropdownOpen}
              >
                {user.avatarUrl ? (
                  <img className="avatarImg" src={user.avatarUrl} alt={user.name} />
                ) : (
                  <span className="avatarDefault">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                    </svg>
                  </span>
                )}
                <span className="avatarName">{user.name}</span>
                <svg className="avatarChevron" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="dropdown">
                  <button
                    className="dropdownItem"
                    onClick={() => {
                      onNavigate('profile')
                      setDropdownOpen(false)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                    </svg>
                    Profile
                  </button>
                  <button
                    className="dropdownItem"
                    onClick={() => {
                      onNavigate('friends')
                      setDropdownOpen(false)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                    Friends
                    {pendingFriendRequests > 0 && (
                      <span className="friendsBadge">
                        {pendingFriendRequests > 9 ? '9+' : pendingFriendRequests}
                      </span>
                    )}
                  </button>
                  <button
                    className="dropdownItem"
                    onClick={() => {
                      onNavigate('stats')
                      setDropdownOpen(false)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                    Stats
                  </button>
                  <button
                    className="dropdownItem"
                    onClick={() => {
                      onNavigate('collections')
                      setDropdownOpen(false)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z" />
                    </svg>
                    Custom Collections
                  </button>
                  <div className="dropdownDivider" />
                  <button
                    className="dropdownItem dropdownItemDanger"
                    onClick={() => {
                      onLogout()
                      setDropdownOpen(false)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                    </svg>
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="authButtons">
              <button className="headerBtn headerBtnGhost" onClick={onLoginClick}>
                Log in
              </button>
              <button className="headerBtn headerBtnPrimary" onClick={onRegisterClick}>
                Register
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
