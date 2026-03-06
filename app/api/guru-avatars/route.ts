import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'
import { GURU_PROFILES } from '@/lib/thirteenf-data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/guru-avatars
 * Returns guru avatar data. Seeds DB on first call.
 *
 * POST /api/guru-avatars
 * Force re-seeds all guru avatar records to DB.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Guru Avatars API')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }

    if (!process.env.DATABASE_URL) {
      // Return static data from profiles when no DB
      const avatars = Object.fromEntries(
        GURU_PROFILES.map(g => [g.id, {
          guru_id: g.id,
          name_cn: g.nameCn,
          name_en: g.nameEn,
          avatar_url: g.avatarUrl,
          source: 'static',
        }])
      )
      return NextResponse.json({ avatars, source: 'static' })
    }

    const { ensureGuruAvatarsTable, getGuruAvatars } = await import('@/lib/db/financial-queries')
    await ensureGuruAvatarsTable()

    const avatars = await getGuruAvatars()

    // Auto-seed if empty
    if (Object.keys(avatars).length === 0) {
      await seedAvatars()
      const seeded = await getGuruAvatars()
      return NextResponse.json({ avatars: seeded, source: 'database', seeded: true })
    }

    return NextResponse.json({ avatars, source: 'database' })
  } catch (error: any) {
    console.error('[Guru Avatars API] Error:', error)
    return NextResponse.json({ avatars: {}, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Guru Avatars Seed')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'No database configured' }, { status: 400 })
    }

    await seedAvatars()
    return NextResponse.json({ success: true, count: GURU_PROFILES.length })
  } catch (error: any) {
    console.error('[Guru Avatars Seed] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function seedAvatars() {
  const { ensureGuruAvatarsTable, upsertGuruAvatar } = await import('@/lib/db/financial-queries')
  await ensureGuruAvatarsTable()

  for (const guru of GURU_PROFILES) {
    await upsertGuruAvatar({
      guru_id: guru.id,
      name_cn: guru.nameCn,
      name_en: guru.nameEn,
      avatar_url: guru.avatarUrl,
      source: 'wikipedia-commons',
    })
  }
}
