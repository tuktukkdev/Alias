import { useEffect, useState } from 'react'
import { API_BASE } from '../config/client'
import type { AuthUser } from '../types/auth'
import { ts } from '../i18n'
import './StatsModal.css'

// интерфейс статистики юзера
interface UserStats {
  guessed: number
  skipped: number
  wins: number
  losses: number
}

// пропсы модалки статистики
interface StatsModalProps {
  user: AuthUser
  onClose: () => void
}

// модалка со статистикой юзера
export function StatsModal({ user, onClose }: StatsModalProps) {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [error, setError] = useState('')

  // загружаем статистику при монтировании
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/stats/${user.id}`)
        if (!res.ok) {
          setError(ts('stats.loadError'))
          return
        }
        const data = (await res.json()) as UserStats
        setStats(data)
      } catch {
        setError(ts('stats.serverError'))
      }
    }
    void load()
  }, [user.id])

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div
        className="authDialog statsDialog"
        role="dialog"
        aria-modal="true"
        aria-label="Stats"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="statsHeader">
          <h2 className="authTitle">Stats — {user.name}</h2>
          <button type="button" className="modalCloseButton" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <p className="formError">{error}</p>}

        {!stats && !error && <p className="hintText">{ts('stats.loading')}</p>}

        {stats && (
          <table className="statsTable">
            <tbody>
              <tr>
                <td className="statsLabel">{ts('stats.guessed')}</td>
                <td className="statsValue">{stats.guessed}</td>
              </tr>
              <tr>
                <td className="statsLabel">{ts('stats.skipped')}</td>
                <td className="statsValue">{stats.skipped}</td>
              </tr>
              <tr>
                <td className="statsLabel">{ts('stats.wins')}</td>
                <td className="statsValue">{stats.wins}</td>
              </tr>
              <tr>
                <td className="statsLabel">{ts('stats.losses')}</td>
                <td className="statsValue">{stats.losses}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
