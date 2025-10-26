import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabaseServer'

interface ParishRow { id: string; name: string }

function normalize(str: string) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'y', 'los', 'las'])

function parishPrefix(name: string): string {
  const cleaned = normalize(name)
  const words = cleaned.trim().split(/\s+/).filter(w => w && !STOPWORDS.has(w))
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase()
  }
  if (words.length === 2) {
    return (words[0][0] + words[1][0] + (words[1][1] || 'x')).toUpperCase().slice(0,3)
  }
  const compact = cleaned.replace(/\s+/g, '')
  return compact.slice(0, 3).toUpperCase()
}

function typePrefix(tipo: string): string {
  const t = normalize(tipo).replace(/\s+/g, '')
  return (t.slice(0,3) || 'unk').toUpperCase()
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

export const dynamic = 'force-dynamic'

type ItemRow = { inventory_number?: string }

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServiceClient()
    const body = await req.json().catch(() => null)
    const parish_id_input: string | undefined = body?.parish_id
    const parish_name_input: string | undefined = body?.parish_name
    const categoria: string | undefined = body?.categoria

    const providedParish = parish_name_input || parish_id_input || ''
    if (!providedParish) {
      return NextResponse.json({ error: 'parish_id o parish_name requerido' }, { status: 400 })
    }

    // Utilidad para comparar nombres sin acentos y en minúsculas
    const strip = (s: string | null | undefined) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

    // Obtener parroquia por UUID si es válido, si no por nombre flexible
    let parishRow: ParishRow | null = null
    if (parish_id_input && isUuid(parish_id_input)) {
      const { data, error } = await supabase
        .from('parishes')
        .select('id,name')
        .eq('id', parish_id_input)
        .limit(1)
        .single()
      if (error) {
        return NextResponse.json({ error: 'Parroquia no encontrada por id' }, { status: 404 })
      }
      parishRow = data as ParishRow
    } else if (parish_name_input) {
      // 1º intento: igualdad exacta
      let { data } = await supabase
        .from('parishes')
        .select('id,name')
        .eq('name', parish_name_input)
        .limit(1)
        .maybeSingle()
      if (!data) {
        // 2º intento: ilike (insensible a mayúsculas)
        const { data: dataIlike } = await supabase
          .from('parishes')
          .select('id,name')
          .ilike('name', parish_name_input)
          .limit(1)
          .maybeSingle()
        if (dataIlike) {
          data = dataIlike as ParishRow
        } else {
          // 3º intento: comparación en memoria sin acentos
          const { data: all } = await supabase
            .from('parishes')
            .select('id,name')
          const target = strip(parish_name_input)
          const allRows = (all || []) as Array<{ id: string; name?: string }>
          const found = allRows.find(r => strip(r.name) === target)
          if (found) {
            data = found as ParishRow
          }
        }
      }
      if (!data) {
        return NextResponse.json({ error: 'Parroquia no encontrada por nombre' }, { status: 404 })
      }
      parishRow = data as ParishRow
    }

    // Guardar si no se encontró parroquia
    if (!parishRow) {
      return NextResponse.json({ error: 'Parroquia no encontrada' }, { status: 404 })
    }

    const prefixParish = parishPrefix(parishRow.name)
    const prefixType = typePrefix(categoria || '')
    const year = new Date().getFullYear()
    const basePrefix = `${prefixParish}-${year}-${prefixType}-`

    // Leer inventarios existentes en items y calcular el siguiente número
    // Además, reservar el número insertando una fila en items para garantizar unicidad

    const tryGenerateAndReserve = async (): Promise<string> => {
      // 1) Buscar máximos existentes por prefijo y parroquia
      const { data: itemsRows, error: itemsErr } = await supabase
        .from('items')
        .select('inventory_number')
        .eq('parish_id', parishRow!.id)
        .ilike('inventory_number', `${basePrefix}%`)

      if (itemsErr) {
        // Si la tabla aún no existe, devolver fallback
        return `${basePrefix}001`
      }

      let maxSeq = 0
      const rows = (itemsRows || []) as ItemRow[]
      for (const r of rows) {
        const inv = r.inventory_number
        if (inv && typeof inv === 'string' && inv.startsWith(basePrefix)) {
          const parts = inv.split('-')
          const last = parts[parts.length - 1]
          const n = parseInt(last, 10)
          if (!isNaN(n)) {
            maxSeq = Math.max(maxSeq, n)
          }
        }
      }

      const nextSeq = (maxSeq || 0) + 1
      const seqStr = String(nextSeq).padStart(3, '0')
      const candidate = `${basePrefix}${seqStr}`

      // 2) Intentar reservar con INSERT en items (único por parroquia)
      const { error: insErr } = await supabase
        .from('items')
        .insert({ parish_id: parishRow!.id, inventory_number: candidate, status: 'draft' })

      if (!insErr) {
        return candidate
      }

      // Si hay conflicto de unicidad, reintentar devolviendo cadena vacía para bucle externo
      const code = (insErr as { code?: string }).code || ''
      const message = (insErr as { message?: string }).message || ''
      if (code === '23505' || /duplicate key/i.test(message)) {
        return ''
      }

      // Otro error: retornar fallback (sin reservar)
      return `${basePrefix}001`
    }

    // Reintentos ante carrera por unicidad
    for (let attempt = 0; attempt < 5; attempt++) {
      const reserved = await tryGenerateAndReserve()
      if (reserved) {
        return NextResponse.json({ inventory_number: reserved })
      }
      // Esperar un poco antes de reintentar
      await new Promise(res => setTimeout(res, 50))
    }

    // Fallback final
    return NextResponse.json({ inventory_number: `${basePrefix}001` })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('Error generando número de inventario:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}