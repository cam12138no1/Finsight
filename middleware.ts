import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * 13-F 持仓追踪：仅在 preview / development 环境开放
 * production 环境访问 /dashboard/13f/* 直接重定向到 /dashboard
 */
export function middleware(request: NextRequest) {
  const isProduction = process.env.VERCEL_ENV === 'production'
  const is13FPath = request.nextUrl.pathname.startsWith('/dashboard/13f')

  if (isProduction && is13FPath) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/13f/:path*'],
}
