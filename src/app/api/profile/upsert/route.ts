import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  try {
    const sb = getSupabaseServiceClient()
    const body = await request.json()

    const {
      id,
      full_name,
      email,
      role = 'user',
      parish_id = null,
    } = body || {}

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Falta id de usuario' }, { status: 400 })
    }

    const { error } = await sb
      .from('profiles')
      .upsert({
        id,
        full_name,
        email,
        role,
        parish_id,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}