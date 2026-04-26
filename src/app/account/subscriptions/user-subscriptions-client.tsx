'use client'

import { useState } from 'react'

type Subscription = {
  id: string
  status: string
  product: {
    nameFr: string
    nameEn: string
    imageUrl: string | null
  }
  quantity: number
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  nextPaymentDate?: string
  lastPaymentDate?: string
}

type Props = {
  subscriptions: Subscription[]
  language: 'fr' | 'en'
}

const statusLabels: Record<string, { fr: string; en: string; color: string }> = {
  ACTIVE: { fr: 'Actif', en: 'Active', color: 'var(--success)' },
  PAST_DUE: { fr: 'Paiement en retard', en: 'Payment overdue', color: 'var(--warning)' },
  CANCELED: { fr: 'Annulé', en: 'Canceled', color: 'var(--muted)' },
  PAUSED: { fr: 'En pause', en: 'Paused', color: 'var(--muted)' },
  EXPIRED: { fr: 'Expiré', en: 'Expired', color: 'var(--muted)' },
}

export default function UserSubscriptionsClient({ subscriptions, language }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const cleanedStatusLabels: Record<string, { fr: string; en: string; color: string }> = {
    ACTIVE: { fr: 'Actif', en: 'Active', color: 'var(--success)' },
    PAST_DUE: { fr: 'Paiement en retard', en: 'Payment overdue', color: 'var(--warning)' },
    CANCELED: { fr: 'Annulé', en: 'Canceled', color: 'var(--muted)' },
    PAUSED: { fr: 'En pause', en: 'Paused', color: 'var(--muted)' },
    EXPIRED: { fr: 'Expiré', en: 'Expired', color: 'var(--muted)' },
  }

  const formatDate = (iso: string) => {
    const locale = language === 'fr' ? 'fr-CA' : 'en-CA'
    return new Date(iso).toLocaleDateString(locale, { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    })
  }

  const cancelSubscription = async (id: string) => {
    if (!confirm(language === 'fr' 
      ? 'Es-tu sûr de vouloir annuler cet abonnement ? Il restera actif jusqu\'à la fin de la période.' 
      : 'Are you sure you want to cancel this subscription? It will remain active until the end of the period.')) {
      return
    }

    setLoading(id)
    try {
      await fetch('/api/account/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: id }),
      })
      window.location.reload()
    } finally {
      setLoading(null)
    }
  }

  if (subscriptions.length === 0) {
    return (
      <div className="support-lite-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h3>{language === 'fr' ? 'Aucun abonnement actif' : 'No active subscriptions'}</h3>
        <p className="small">
          {language === 'fr'
            ? "Tu n'as pas encore d'abonnement actif. Va choisir ta formule !"
            : "You don't have any active subscriptions yet. Go choose your plan!"}
        </p>
      </div>
    )
  }

  return (
    <div className="account-orders-grid">
      {subscriptions.map(sub => {
        const productName = language === 'fr' ? sub.product.nameFr : sub.product.nameEn
        const status = cleanedStatusLabels[sub.status] || cleanedStatusLabels.ACTIVE

        return (
          <div key={sub.id} className="account-order-card">
            <div className="account-order-card__head">
              <div>
                <p className="account-home-hero__eyebrow" style={{ marginBottom: 6 }}>
                  {language === 'fr' ? 'Abonnement' : 'Subscription'}
                </p>
                <h3 style={{ margin: '0 0 4px', color: '#44321d' }}>{productName}</h3>
                <span className="badge" style={{ background: status.color, color: 'white' }}>
                  {status[language]}
                </span>
              </div>

              {sub.status === 'ACTIVE' && !sub.cancelAtPeriodEnd ? (
                <button
                  className="btn btn-danger"
                  disabled={loading === sub.id}
                  onClick={() => void cancelSubscription(sub.id)}
                  style={{ fontSize: '0.9rem' }}
                >
                  {loading === sub.id ? '...' : language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
              ) : sub.cancelAtPeriodEnd ? (
                <span className="badge" style={{ background: 'var(--warning)' }}>
                  {language === 'fr' ? 'Annulé à la fin de période' : 'Canceled at period end'}
                </span>
              ) : null}
            </div>

            <div className="account-order-card__meta small" style={{ marginTop: 4 }}>
              <div className="account-order-card__meta-block">
                <span className="account-order-card__meta-label">{language === 'fr' ? 'Début période' : 'Period start'}</span>
                <strong>{formatDate(sub.currentPeriodStart)}</strong>
              </div>
              <div className="account-order-card__meta-block">
                <span className="account-order-card__meta-label">{language === 'fr' ? 'Fin période' : 'Period end'}</span>
                <strong>{formatDate(sub.currentPeriodEnd)}</strong>
              </div>
              {sub.nextPaymentDate ? (
                <div className="account-order-card__meta-block">
                  <span className="account-order-card__meta-label">{language === 'fr' ? 'Prochain paiement' : 'Next payment'}</span>
                  <strong>{formatDate(sub.nextPaymentDate)}</strong>
                </div>
              ) : null}
              {sub.lastPaymentDate ? (
                <div className="account-order-card__meta-block">
                  <span className="account-order-card__meta-label">{language === 'fr' ? 'Dernier paiement' : 'Last payment'}</span>
                  <strong>{formatDate(sub.lastPaymentDate)}</strong>
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (subscriptions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>📭</div>
        <h3>{language === 'fr' ? 'Aucun abonnement actif' : 'No active subscriptions'}</h3>
        <p className="small">
          {language === 'fr' 
            ? "Tu n'as pas encore d'abonnement actif. Va choisir ta formule !" 
            : "You don't have any active subscriptions yet. Go choose your plan!"}
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {subscriptions.map(sub => {
        const productName = language === 'fr' ? sub.product.nameFr : sub.product.nameEn
        const status = statusLabels[sub.status] || statusLabels.ACTIVE

        return (
          <div 
            key={sub.id} 
            className="card" 
            style={{ padding: 20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: '0 0 4px' }}>{productName}</h3>
                <span className="badge" style={{ background: status.color, color: 'white' }}>
                  {status[language]}
                </span>
              </div>

              {sub.status === 'ACTIVE' && !sub.cancelAtPeriodEnd && (
                <button 
                  className="btn btn-danger"
                  disabled={loading === sub.id}
                  onClick={() => void cancelSubscription(sub.id)}
                  style={{ fontSize: '0.9rem' }}
                >
                  {loading === sub.id 
                    ? '...' 
                    : language === 'fr' 
                      ? 'Annuler' 
                      : 'Cancel'}
                </button>
              )}

              {sub.cancelAtPeriodEnd && (
                <span className="badge" style={{ background: 'var(--warning)' }}>
                  {language === 'fr' ? 'Annulé à la fin de période' : 'Canceled at period end'}
                </span>
              )}
            </div>

            <div className="small" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div>
                <strong>{language === 'fr' ? 'Début période' : 'Period start'}</strong>
                <p>{formatDate(sub.currentPeriodStart)}</p>
              </div>
              <div>
                <strong>{language === 'fr' ? 'Fin période' : 'Period end'}</strong>
                <p>{formatDate(sub.currentPeriodEnd)}</p>
              </div>
              {sub.nextPaymentDate && (
                <div>
                  <strong>{language === 'fr' ? 'Prochain paiement' : 'Next payment'}</strong>
                  <p>{formatDate(sub.nextPaymentDate)}</p>
                </div>
              )}
              {sub.lastPaymentDate && (
                <div>
                  <strong>{language === 'fr' ? 'Dernier paiement' : 'Last payment'}</strong>
                  <p>{formatDate(sub.lastPaymentDate)}</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
