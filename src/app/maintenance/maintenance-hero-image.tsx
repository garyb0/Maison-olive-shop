'use client'

import Image from 'next/image'
import { useState } from 'react'

type Props = {
  alt: string
}

export function MaintenanceHeroImage({ alt }: Props) {
  const [useFallback, setUseFallback] = useState(false)

  return (
    <Image
      src={useFallback ? '/olive-logo-2.png' : '/maintenance-dog.png'}
      alt={alt}
      width={640}
      height={640}
      priority
      className="mx-auto h-auto w-full max-w-[360px] object-contain drop-shadow-[0_24px_48px_rgba(45,68,38,0.18)]"
      onError={() => setUseFallback(true)}
    />
  )
}
