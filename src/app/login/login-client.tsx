'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  AtSign,
  CircleHelp,
  ClipboardList,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPinHouse,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { GoogleAuthButton } from '@/components/GoogleAuthButton'
import { MobileAppChrome } from '@/components/MobileAppChrome'
import { Navigation } from '@/components/Navigation'
import { getDictionary, normalizeLanguage, type Language } from '@/lib/i18n'

type LoginClientProps = {
  googleOAuthEnabled: boolean
  googleReturnTo: string
  initialGoogleError?: string
}

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

function getGoogleErrorMessage(code: string | undefined, isFr: boolean) {
  if (!code) return ''
  if (code === 'email_not_verified') {
    return isFr
      ? 'Google ne confirme pas ce courriel. Essaie un autre compte ou utilise ton mot de passe.'
      : 'Google did not verify this email. Try another account or use your password.'
  }
  if (code === 'admin_not_allowed') {
    return isFr
      ? 'Les comptes admin doivent utiliser la connexion classique avec 2FA.'
      : 'Admin accounts must use the classic sign-in with 2FA.'
  }
  if (code === 'not_configured') {
    return isFr
      ? 'Connexion Google pas encore configurée.'
      : 'Google sign-in is not configured yet.'
  }
  if (code === 'cancelled') {
    return isFr
      ? 'Connexion Google annulée.'
      : 'Google sign-in was cancelled.'
  }
  if (code === 'expired' || code === 'invalid_state') {
    return isFr
      ? 'La tentative Google a expiré. Réessaie.'
      : 'The Google sign-in attempt expired. Please try again.'
  }
  return isFr
    ? 'Connexion Google impossible. Réessaie ou utilise ton courriel.'
    : 'Google sign-in failed. Please try again or use your email.'
}

export function LoginClient({
  googleOAuthEnabled,
  googleReturnTo,
  initialGoogleError,
}: LoginClientProps) {
  const router = useRouter()
  const language = useLanguage()
  const t = getDictionary(language)
  const isFr = language === 'fr'
  const redirectTarget = googleReturnTo || '/account'
  const googleErrorMessage = getGoogleErrorMessage(initialGoogleError, isFr)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [pendingRole, setPendingRole] = useState<'CUSTOMER' | 'ADMIN' | null>(null)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)

  function navigateAfterAuth(role: unknown) {
    router.replace(role === 'ADMIN' ? '/admin' : redirectTarget)
    router.refresh()
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      if (twoFactorRequired) {
        const res = await fetch('/api/auth/login/verify-two-factor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: twoFactorCode }),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          setLoginError(isFr ? 'Code de vérification invalide.' : 'Invalid verification code.')
          return
        }

        navigateAfterAuth(data.role === 'ADMIN' || pendingRole === 'ADMIN' ? 'ADMIN' : 'CUSTOMER')
        return
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setLoginError(isFr ? 'Courriel ou mot de passe invalide.' : 'Invalid email or password.')
        return
      }

      if (data.requiresTwoFactor) {
        setTwoFactorRequired(true)
        setPendingRole(data.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER')
        setTwoFactorCode('')
        return
      }

      navigateAfterAuth(data.role)
    } catch {
      setLoginError(isFr ? 'Une erreur est survenue. Réessaie.' : 'Something went wrong. Please try again.')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRegisterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setRegisterError('')
    setRegisterLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          firstName,
          lastName,
          language,
          autoLogin: true,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 409) {
          setRegisterError(
            isFr
              ? 'Ce courriel a déjà un compte. Connecte-toi plutôt à gauche.'
              : 'This email already has an account. Sign in on the left instead.',
          )
          return
        }

        setRegisterError(isFr ? 'Inscription impossible. Vérifie les champs.' : 'Unable to register. Check the fields.')
        return
      }

      navigateAfterAuth(data.role)
    } catch {
      setRegisterError(isFr ? 'Une erreur est survenue. Réessaie.' : 'Something went wrong. Please try again.')
    } finally {
      setRegisterLoading(false)
    }
  }

  return (
    <div className="app-shell login-page mobile-app-clone-shell">
      <MobileAppChrome language={language} userRole={null} />
      <header className="topbar">
        <Suspense fallback={null}>
          <Navigation language={language} t={t} user={null} />
        </Suspense>
      </header>

      <main className="login-screen">
        <div className="login-auth-frame">
          <div className="login-auth-grid">
          <section className="login-panel login-panel--signin" aria-labelledby="login-title">
            <div className="login-brand">
              <div className="login-brand__mark">
                <Image
                  src="/images/chez-olive/chezolive-logo-mark-tight.png"
                  alt="Chez Olive"
                  width={96}
                  height={96}
                  priority
                  className="login-brand__logo"
                />
                <span>ChezOlive.ca</span>
              </div>
              <div>
                <p className="login-eyebrow">
                  {isFr ? 'Espace client' : 'Customer space'}
                </p>
                <h1 id="login-title" className="login-title">
                  {twoFactorRequired
                    ? isFr
                      ? 'Vérification'
                      : 'Verification'
                    : t.login}
                </h1>
                <p className="login-copy">
                  {twoFactorRequired
                    ? isFr
                      ? "Entre ton code d'authentification pour continuer."
                      : 'Enter your authentication code to continue.'
                    : isFr
                      ? 'Retourne à tes commandes et préférences en quelques secondes.'
                      : 'Get back to your orders and preferences in seconds.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="login-form login-form--signin">
              {googleErrorMessage ? (
                <div className="auth-alert auth-alert--err" role="alert">
                  <span aria-hidden="true">!</span> {googleErrorMessage}
                </div>
              ) : null}

              {loginError ? (
                <div className="auth-alert auth-alert--err" role="alert">
                  <span aria-hidden="true">!</span> {loginError}
                </div>
              ) : null}

              {twoFactorRequired ? (
                <div className="field">
                  <label htmlFor="login-two-factor-code">{isFr ? 'Code de vérification' : 'Verification code'}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon" aria-hidden="true">
                      <ShieldCheck size={16} strokeWidth={2.2} />
                    </span>
                    <input
                      id="login-two-factor-code"
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
                    <label htmlFor="login-email">{isFr ? 'Courriel' : 'Email'}</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon" aria-hidden="true">
                        <AtSign size={16} strokeWidth={2.2} />
                      </span>
                      <input
                        id="login-email"
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
                    <label htmlFor="login-password">{isFr ? 'Mot de passe' : 'Password'}</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon" aria-hidden="true">
                        <LockKeyhole size={16} strokeWidth={2.2} />
                      </span>
                      <input
                        id="login-password"
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

              <button className="btn btn-full" type="submit" disabled={loginLoading}>
                {loginLoading
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
                    setLoginError('')
                  }}
                >
                  {isFr ? 'Retour' : 'Back'}
                </button>
              ) : (
                <div className="login-actions">
                  <Link href="/forgot-password" className="small">
                    {t.forgotPassword}
                  </Link>
                  <Link href="/" className="small">
                    {isFr ? "Retour à l'accueil" : 'Back to home'}
                  </Link>
                </div>
              )}
            </form>
          </section>

          <div className="login-auth-connector" aria-hidden="true" />

          <section className="login-panel login-panel--register" aria-labelledby="register-title">
            <div className="login-panel__header">
              <p className="login-eyebrow">
                {isFr ? 'Nouveau client' : 'New customer'}
              </p>
              <h2 id="register-title" className="login-panel__title">
                {isFr ? 'Créer un compte' : 'Create an account'}
              </h2>
              <p className="login-panel__text">
                {isFr
                  ? 'Un compte te permet de retrouver tes commandes, tes adresses et tes prochaines livraisons plus vite.'
                  : 'An account helps you find orders, addresses, and upcoming deliveries faster.'}
              </p>
              <div className="login-benefits" aria-label={isFr ? 'Avantages du compte' : 'Account benefits'}>
                <span className="login-benefit">
                  <span className="login-benefit__icon" aria-hidden="true">
                    <ClipboardList size={16} strokeWidth={2.2} />
                  </span>
                  <span className="login-benefit__copy">
                    <strong>{isFr ? 'Commandes' : 'Orders'}</strong>
                    <small>{isFr ? 'Historique' : 'History'}</small>
                  </span>
                </span>
                <span className="login-benefit">
                  <span className="login-benefit__icon" aria-hidden="true">
                    <MapPinHouse size={16} strokeWidth={2.2} />
                  </span>
                  <span className="login-benefit__copy">
                    <strong>{isFr ? 'Adresses' : 'Addresses'}</strong>
                    <small>{isFr ? 'Sauvegarde' : 'Saved'}</small>
                  </span>
                </span>
                <span className="login-benefit">
                  <span className="login-benefit__icon" aria-hidden="true">
                    <Truck size={16} strokeWidth={2.2} />
                  </span>
                  <span className="login-benefit__copy">
                    <strong>{isFr ? 'Livraisons' : 'Deliveries'}</strong>
                    <small>{isFr ? 'Rappels' : 'Updates'}</small>
                  </span>
                </span>
              </div>
            </div>

            {googleOAuthEnabled ? (
              <div className="login-google-block">
                <GoogleAuthButton language={language} returnTo={redirectTarget} className="btn-full" />
                <p className="google-auth-note">
                  {isFr
                    ? 'Connexion ou création rapide avec Google. Aucun accès à Gmail, Drive ou tes contacts.'
                    : 'Quick sign-in or sign-up with Google. No Gmail, Drive, or contacts access.'}
                </p>
                <div className="login-or-divider" aria-hidden="true">
                  <span />
                  <strong>{isFr ? 'ou' : 'or'}</strong>
                  <span />
                </div>
              </div>
            ) : null}

            <form onSubmit={handleRegisterSubmit} className="login-form">
              {registerError ? (
                <div className="auth-alert auth-alert--err" role="alert">
                  <span aria-hidden="true">!</span> {registerError}
                </div>
              ) : null}

              <div className="login-name-row">
                <div className="field">
                  <label htmlFor="register-first-name">{isFr ? 'Prénom' : 'First name'}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon" aria-hidden="true">
                      <UserRound size={16} strokeWidth={2.2} />
                    </span>
                    <input
                      id="register-first-name"
                      className="input input--icon"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoComplete="given-name"
                      placeholder={isFr ? 'Prénom' : 'First name'}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="register-last-name">{isFr ? 'Nom' : 'Last name'}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon" aria-hidden="true">
                      <UserRound size={16} strokeWidth={2.2} />
                    </span>
                    <input
                      id="register-last-name"
                      className="input input--icon"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoComplete="family-name"
                      placeholder={isFr ? 'Nom' : 'Last name'}
                    />
                  </div>
                </div>
              </div>

              <div className="field">
                <label htmlFor="register-email">{isFr ? 'Courriel' : 'Email'}</label>
                <div className="input-icon-wrap">
                  <span className="input-icon" aria-hidden="true">
                    <AtSign size={16} strokeWidth={2.2} />
                  </span>
                  <input
                    id="register-email"
                    className="input input--icon"
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="ton@email.com"
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="register-password">{isFr ? 'Mot de passe' : 'Password'}</label>
                <div className="input-icon-wrap">
                  <span className="input-icon" aria-hidden="true">
                    <KeyRound size={16} strokeWidth={2.2} />
                  </span>
                  <input
                    id="register-password"
                    className="input input--icon"
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </div>
                <p className="login-field-note">
                  {isFr ? 'Minimum 8 caractères.' : 'Minimum 8 characters.'}
                </p>
              </div>

              <button className="btn btn-full btn-register" type="submit" disabled={registerLoading}>
                {registerLoading
                  ? isFr
                    ? 'Création...'
                    : 'Creating...'
                  : isFr
                    ? 'Créer mon compte'
                    : 'Create my account'}
              </button>
            </form>
          </section>

          </div>
        </div>

        <aside className="login-support-tile" aria-label={isFr ? "Aide compte" : "Account help"}>
          <div className="login-support-tile__copy">
            <p className="login-eyebrow">Chez Olive</p>
            <h2 className="login-support-tile__title">
              {isFr ? "Besoin d'aide ?" : "Need help?"}
            </h2>
            <p className="login-support-tile__text">
              {isFr
                ? 'Questions de compte, livraison ou commande: on garde les liens utiles juste ici.'
                : 'Account, delivery, or order questions: the useful links stay right here.'}
            </p>
          </div>
          <div className="login-support-tile__actions">
            <Link href="/boutique" className="login-support-link">
              <Store size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>{isFr ? 'Boutique' : 'Shop'}</span>
            </Link>
            <Link href="/faq" className="login-support-link">
              <CircleHelp size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>{isFr ? "Centre d'aide" : 'Help center'}</span>
            </Link>
            <a href="mailto:support@chezolive.ca" className="login-support-link">
              <Mail size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>{isFr ? 'Support' : 'Support'}</span>
            </a>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default LoginClient
