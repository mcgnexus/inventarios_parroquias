import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabaseServer'

function isUuid(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
}

function toArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean)
  if (typeof val === 'string') return val.split(',').map(v => v.trim()).filter(Boolean)
  return []
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id: string | undefined = body?.id
    const changes: Record<string, unknown> = body?.changes || {}

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ ok: false, error: 'Falta id válido' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()

    const { data: rows, error: selError } = await supabase
      .from('conversaciones')
      .select('id, respuesta')
      .eq('id', id)
      .limit(1)

    if (selError) {
      console.error('Error seleccionando conversación:', selError)
      return NextResponse.json({ ok: false, error: 'Error seleccionando' }, { status: 500 })
    }

    const rowsTyped: { id: string; respuesta: string | null }[] | null = rows as { id: string; respuesta: string | null }[] | null
    const row = rowsTyped?.[0]
    if (!row) {
      return NextResponse.json({ ok: false, error: 'No existe el item' }, { status: 404 })
    }

    let current: Record<string, unknown> = {}
    try {
      current = JSON.parse(row.respuesta || '{}') as Record<string, unknown>
    } catch {
      console.warn('respuesta no JSON, se sobrescribe')
      current = {}
    }

    const normalized: Record<string, unknown> = { ...changes }

    // Normalizar arrays
    normalized.materiales = toArray(changes.materiales ?? current.materiales)
    normalized.tecnicas = toArray(changes.tecnicas ?? current.tecnicas)
    normalized.deterioros_visibles = toArray(changes.deterioros_visibles ?? current.deterioros_visibles)

    // Resolver parroquia por id UUID o por nombre exacto
    if ('parish_input' in changes) {
      const input = String(changes.parish_input || '').trim()
      delete normalized.parish_input
      if (input) {
        if (isUuid(input)) {
          const { data }: { data: { id: string; name: string } | null } = await supabase
            .from('parishes')
            .select('id,name')
            .eq('id', input)
            .maybeSingle()
          if (data) {
            normalized.parish_id = data.id
            normalized.parish_name = data.name
          } else {
            normalized.parish_id = undefined
            normalized.parish_name = input
          }
        } else {
          const { data }: { data: { id: string; name: string } | null } = await supabase
            .from('parishes')
            .select('id,name')
            .eq('name', input)
            .maybeSingle()
          if (data) {
            normalized.parish_id = data.id
            normalized.parish_name = data.name
          } else {
            normalized.parish_id = undefined
            normalized.parish_name = input
          }
        }
      } else {
        normalized.parish_id = undefined
        normalized.parish_name = undefined
      }
    }

    const updated = { ...current, ...normalized }

    const { error: updError } = await supabase
      .from('conversaciones')
      .update({ respuesta: JSON.stringify(updated) })
      .eq('id', id)

    if (updError) {
      console.error('Error actualizando conversación:', updError)
      return NextResponse.json({ ok: false, error: 'Error actualizando' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data: updated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error inesperado'
    console.error('Error en API actualización catálogo:', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}