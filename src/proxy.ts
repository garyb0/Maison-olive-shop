import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_ACCESS_COOKIE_NAME, verifyAdminAccessCookieValue } from '@/lib/admin-access-cookie'
import { env } from '@/lib/env'
import { isMaintenanceEnabled } from '@/lib/maintenance'

const PUBLIC_FILE_REGEX = /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff|woff2)$/i
const MAINTENANCE_BYPASS_PREFIXES = ['/admin', '/login', '/forgot-password', '/reset-password', '/api/auth', '/api/admin']
const MAINTENANCE_BYPASS_EXACT = ['/maintenance', '/api/health', '/favicon.ico', '/robots.txt', '/sitemap.xml']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Toujours laisser passer les ressources statiques
  if (
    path.startsWith('/_next') ||
    PUBLIC_FILE_REGEX.test(path)
  ) {
    return NextResponse.next()
  }

  // Toujours laisser passer l'admin et les APIs nécessaires
  // (elles ont leur propre couche d'authentification)
  if (
    MAINTENANCE_BYPASS_EXACT.includes(path) ||
    MAINTENANCE_BYPASS_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    return NextResponse.next()
  }

  // État maintenance effectif (inclut auto-réouverture programmée via openAt)
  const maintenanceEnabled = isMaintenanceEnabled()

  if (!maintenanceEnabled) {
    return NextResponse.next()
  }

  const hasAdminMaintenanceBypass = await verifyAdminAccessCookieValue({
    cookieValue: request.cookies.get(ADMIN_ACCESS_COOKIE_NAME)?.value,
    sessionToken: request.cookies.get(env.sessionCookieName)?.value,
    secret: env.sessionSecret,
  })

  if (hasAdminMaintenanceBypass) {
    return NextResponse.next()
  }

  if (path.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'MAINTENANCE_MODE' },
      {
        status: 503,
        headers: { 'Retry-After': '3600' },
      }
    )
  }

  // Tout autre visiteur public: rediriger vers maintenance
  return NextResponse.rewrite(new URL('/maintenance', request.url))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
