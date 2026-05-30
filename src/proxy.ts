import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_ACCESS_COOKIE_NAME, verifyAdminAccessCookieValue } from '@/lib/admin-access-cookie'
import { env } from '@/lib/env'
import { isMaintenanceEnabled } from '@/lib/maintenance'

const PUBLIC_FILE_REGEX = /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff|woff2)$/i
const MAINTENANCE_BYPASS_PREFIXES = ['/admin', '/login', '/forgot-password', '/reset-password', '/api/auth', '/api/admin']
const MAINTENANCE_BYPASS_EXACT = ['/maintenance', '/api/health', '/favicon.ico', '/robots.txt', '/sitemap.xml']
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CROSS_SITE_API_EXEMPT_PREFIXES = ['/api/stripe/webhook', '/api/support/email-reply']
const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1'])

function getForwardedHost(request: NextRequest) {
  return request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host')?.trim() || request.nextUrl.host
}

function getHostnameFromHost(host: string) {
  const value = host.trim().toLowerCase()
  if (value.startsWith('[')) {
    const closingBracket = value.indexOf(']')
    if (closingBracket > 0) return value.slice(1, closingBracket)
  }

  const colonCount = value.match(/:/g)?.length ?? 0
  if (colonCount > 1) return value

  return value.split(':')[0]
}

function isLocalhostHost(host: string) {
  return LOCALHOST_NAMES.has(getHostnameFromHost(host))
}

function shouldRedirectToHttps(request: NextRequest) {
  const host = getForwardedHost(request)
  if (!host || isLocalhostHost(host)) return false

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  const protocol = forwardedProto || request.nextUrl.protocol.replace(/:$/, '').toLowerCase()
  return protocol === 'http'
}

function normalizeOrigin(value: string | null) {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getTrustedOrigins(request: NextRequest) {
  const origins = new Set<string>()
  const requestOrigin = normalizeOrigin(request.nextUrl.origin)
  const configuredOrigin = normalizeOrigin(env.siteUrl)

  if (requestOrigin) origins.add(requestOrigin)
  if (configuredOrigin) origins.add(configuredOrigin)

  return origins
}

function isTrustedRequestOrigin(request: NextRequest, value: string | null) {
  const origin = normalizeOrigin(value)
  if (!origin) return false
  return getTrustedOrigins(request).has(origin)
}

function isCrossSiteApiMutation(request: NextRequest, path: string) {
  if (!path.startsWith('/api/')) return false
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return false
  if (CROSS_SITE_API_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return false

  const origin = request.headers.get('origin')
  if (origin && !isTrustedRequestOrigin(request, origin)) return true

  const referer = request.headers.get('referer')
  if (!origin && referer && !isTrustedRequestOrigin(request, referer)) return true

  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) return true

  return false
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (shouldRedirectToHttps(request)) {
    const redirectUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, `https://${getForwardedHost(request)}`)
    return NextResponse.redirect(redirectUrl, 308)
  }

  // Toujours laisser passer les ressources statiques
  if (
    path.startsWith('/_next') ||
    PUBLIC_FILE_REGEX.test(path)
  ) {
    return NextResponse.next()
  }

  if (isCrossSiteApiMutation(request, path)) {
    return NextResponse.json({ error: 'FORBIDDEN_CROSS_SITE_REQUEST' }, { status: 403 })
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
