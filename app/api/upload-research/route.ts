import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session-validator'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/upload-research
 * 
 * Simple server-side file upload to Vercel Blob.
 * Accepts multipart form data with a single file.
 * Returns the blob URL for use in the analyze API.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionResult = await validateSession(request, 'Upload Research')
    if (!sessionResult.valid) {
      return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小超过50MB限制' }, { status: 400 })
    }

    console.log(`[Upload] Uploading research: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pathname = `uploads/research/${timestamp}_${safeName}`

    const blob = await put(pathname, file, {
      access: 'private',
      contentType: file.type || 'application/pdf',
    })

    console.log(`[Upload] Complete: ${blob.url}`)

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      originalName: file.name,
      size: file.size,
    })
  } catch (error: any) {
    console.error('[Upload] Error:', error)
    return NextResponse.json({ error: error.message || '上传失败' }, { status: 500 })
  }
}
