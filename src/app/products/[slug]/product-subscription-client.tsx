'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/format'

type Product = {
  id: string
  slug: string
  isSubscription: boolean
  priceWeekly: number | null
  priceBiweekly: number | null
  priceMonthly: number | null
  priceQuarterly: number | null
  currency: string
}

type Props = {
  product: Product
  language: 'fr' | 'en'
}

const intervalLabels: Record<string, { fr: string; en: string }> = {
  WEEKLY: { fr: 'Chaque semaine', en: 'Every week' },
  BIWEEKLY: { fr: 'Toutes les 2 semaines', en: 'Every 2 weeks' },
  MONTHLY: { fr: 'Chaque mois', en: 'Every month' },
  QUARTERLY: { fr: 'Chaque trimestre', en: 'Every 3 months' },
}

export function ProductSubscriptionClient({ product, language }: Props) {
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA'
  const [loading, setLoading] = useState(false)
  const [selectedInterval, setSelectedInterval] = useState<string>('')

  const availableIntervals = [
    { id: 'WEEKLY', price: product.priceWeekly },
    { id: 'BIWEEKLY', price: product.priceBiweekly },
    { id: 'MONTHLY', price: product.priceMonthly },
    { id: 'QUARTERLY', price: product.priceQuarterly },
  ].filter(i => i.price != null && i.price > 0)

  if (!product.isSubscription || availableIntervals.length === 0) {
    return null
  }

  const subscribe = async () => {
    if (!selectedInterval) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          interval: selectedInterval,
          quantity: 1,
        }),
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 24, padding: 16, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: '1.2rem' }}>🔄</span>
        <strong>{language === 'fr' ? 'Abonnement récurrent' : 'Recurring subscription'}</strong>
      </div>

      <p className="small" style={{ marginBottom: 16 }}>
        {language === 'fr' 
          ? 'Choisis la fréquence de livraison qui te convient. Tu peux annuler à tout moment.' 
          : 'Choose the delivery frequency that works for you. Cancel anytime.'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {availableIntervals.map(interval => (
          <label 
            key={interval.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: 12,
              borderRadius: 8,
              background: selectedInterval === interval.id ? 'var(--accent-light)' : 'var(--background)',
              cursor: 'pointer',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input 
                type="radio" 
                name="subscription-interval"
                checked={selectedInterval === interval.id}
                onChange={() => setSelectedInterval(interval.id)}
              />
              <span>{intervalLabels[interval.id][language]}</span>
            </div>
            <strong>{formatCurrency(interval.price!, product.currency, locale)}</strong>
          </label>
        ))}
      </div>

      <button 
        className="btn btn-full"
        disabled={!selectedInterval || loading}
        onClick={() => void subscribe()}
      >
        {loading 
          ? '...' 
          : language === 'fr' 
            ? "S'abonner maintenant" 
            : 'Subscribe now'}
      </button>
    </div>
  )
}
