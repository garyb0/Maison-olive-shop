'use client'

import { useEffect, useMemo, useState } from 'react'

type Props = {
  openAtIso: string
  language?: 'fr' | 'en'
}

function formatCountdown(ms: number, language: 'fr' | 'en') {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (language === 'en') {
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
    return `${minutes}m ${seconds}s`
  }

  if (days > 0) return `${days}j ${hours}h ${minutes}m ${seconds}s`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

export function ReopenCountdown({ openAtIso, language = 'fr' }: Props) {
  const targetTime = useMemo(() => new Date(openAtIso).getTime(), [openAtIso])
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    if (Number.isNaN(targetTime)) return

    const updateRemaining = () => {
      setRemainingMs(targetTime - Date.now())
    }

    const kickoff = setTimeout(updateRemaining, 0)
    const timer = setInterval(() => {
      updateRemaining()
    }, 1000)

    return () => {
      clearTimeout(kickoff)
      clearInterval(timer)
    }
  }, [targetTime])

  if (Number.isNaN(targetTime)) {
    return null
  }

  if (remainingMs === null) {
    return (
      <p className="text-sm text-olive-700 font-medium">
        {language === 'fr' ? 'Calcul du délai…' : 'Calculating time…'}
      </p>
    )
  }

  if (remainingMs <= 0) {
    return (
      <p className="text-sm text-olive-700 font-medium">
        {language === 'fr' ? 'Réouverture imminente…' : 'Reopening very soon…'}
      </p>
    )
  }

  return (
    <p className="text-sm text-olive-700 font-medium">
      {language === 'fr' ? 'Compte à rebours: ' : 'Countdown: '}
      {formatCountdown(remainingMs, language)}
    </p>
  )
}
