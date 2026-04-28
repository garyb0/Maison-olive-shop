'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getDictionary, normalizeLanguage, type Language } from '@/lib/i18n'

function getCookieLanguage(): Language {
  if (typeof document === 'undefined') return 'fr'
  const match = document.cookie.match(/chezolive_lang=([^;]+)/)
  return normalizeLanguage(match?.[1])
}

function useLanguage() {
  const [language, setLanguage] = useState<Language>('fr')

  useEffect(() => {
    const id = window.setTimeout(() => {
      setLanguage(getCookieLanguage())
    }, 0)

    return () => window.clearTimeout(id)
  }, [])

  return language
}

export default function LoginPage() {
  const router = useRouter()
  const language = useLanguage()
  const t = getDictionary(language)
  const isFr = language === 'fr'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [pendingRole, setPendingRole] = useState<'CUSTOMER' | 'ADMIN' | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (twoFactorRequired) {
        const res = await fetch('/api/auth/login/verify-two-factor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: twoFactorCode }),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          setError(isFr ? 'Code de vérification invalide.' : 'Invalid verification code.')
          return
        }

        if (data.role === 'ADMIN' || pendingRole === 'ADMIN') {
          router.push('/admin')
        } else {
          router.push('/')
        }
        return
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(isFr ? 'Courriel ou mot de passe invalide.' : 'Invalid email or password.')
        return
      }

      if (data.requiresTwoFactor) {
        setTwoFactorRequired(true)
        setPendingRole(data.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER')
        setTwoFactorCode('')
        return
      }

      if (data.role === 'ADMIN') {
        router.push('/admin')
      } else {
        router.push('/')
      }
    } catch {
      setError(isFr ? 'Une erreur est survenue. Réessaie.' : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <section className="section auth-shell">
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__brand">
              <Image
                src="/images/chez-olive/chezolive-logo-mark-tight.png"
                alt="Chez Olive"
                width={84}
                height={84}
                priority
                className="auth-card__logo"
              />
              <div>
                <p className="account-home-hero__eyebrow">
                  {twoFactorRequired
                    ? isFr
                      ? 'Sécurité'
                      : 'Security'
                    : isFr
                      ? 'Connexion'
                      : 'Sign in'}
                </p>
                <h1 className="auth-card__title">
                  {twoFactorRequired
                    ? isFr
                      ? 'Vérification en deux étapes'
                      : 'Two-step verification'
                    : t.login}
                </h1>
                <p className="auth-card__text">
                  {twoFactorRequired
                    ? isFr
                      ? 'Entre le code de ton application d’authentification ou un code de secours.'
                      : 'Enter the code from your authenticator app or a backup code.'
                    : isFr
                      ? 'Retrouve ton compte, tes commandes et tes préférences dans un espace clair et sécurisé.'
                      : 'Access your account, orders, and preferences in one clear and secure space.'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error ? (
              <div className="auth-alert auth-alert--err">
                <span>⚠️</span> {error}
              </div>
            ) : null}

            {twoFactorRequired ? (
              <div className="field">
                <label>{isFr ? 'Code de vérification' : 'Verification code'}</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">🔐</span>
                  <input
                    className="input input--icon"
                    type="text"
                    inputMode="numeric"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    required
                    autoComplete="one-time-code"
                    placeholder={isFr ? '123456 ou CODE-SECOURS' : '123456 or BACKUP-CODE'}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="field">
                  <label>{isFr ? 'Courriel' : 'Email'}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">✉️</span>
                    <input
                      className="input input--icon"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="ton@email.com"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>{isFr ? 'Mot de passe' : 'Password'}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">🔒</span>
                    <input
                      className="input input--icon"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            )}

            <button className="btn btn-full" type="submit" disabled={loading}>
              {loading
                ? isFr
                  ? 'Connexion...'
                  : 'Signing in...'
                : twoFactorRequired
                  ? isFr
                    ? 'Vérifier le code'
                    : 'Verify code'
                  : isFr
                    ? 'Se connecter'
                    : 'Sign in'}
            </button>

            {twoFactorRequired ? (
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={() => {
                  setTwoFactorRequired(false)
                  setPendingRole(null)
                  setTwoFactorCode('')
                  setError('')
                }}
              >
                {isFr ? 'Retour' : 'Back'}
              </button>
            ) : (
              <div className="auth-card__actions">
                <Link href="/forgot-password" className="small">
                  {t.forgotPassword}
                </Link>
                <Link href="/" className="small">
                  ← {t.backToHome}
                </Link>
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  )
}
