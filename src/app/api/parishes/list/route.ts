import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET(request: Request) {
  try {
    if (!supabaseUrl) {
      return NextResponse.json({ ok: false, error: 'Supabase no configurado' }, { status: 500 })
    }
    const key = serviceRoleKey || anonKey
    const supabase = createClient(supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const url = new URL(request.url)
    const diocese = url.searchParams.get('diocese') || 'Guadix'
    const q = (url.searchParams.get('q') || '').trim()

    let query = supabase
      .from('parishes')
      .select('id, name, location')

    if (diocese) {
      query = query.eq('diocese', diocese)
    }

    if (q) {
      query = query.or(`name.ilike.%${q}%,location.ilike.%${q}%`)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Error listando parroquias:', error)
      return NextResponse.json({ ok: false, error: 'Error listando parroquias' }, { status: 500 })
    }

    const strip = (s: string | null | undefined) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

    let rows = (data || []) as Array<{ id: string; name: string; location?: string }>

    if (q) {
      const nq = strip(q)
      rows = rows.filter(r => strip(r.name).includes(nq) || strip(r.location).includes(nq))
    }

    rows.sort((a, b) => strip(a.name).localeCompare(strip(b.name)))

    return NextResponse.json({ ok: true, parishes: rows })
  } catch (e) {
    console.error('Error inesperado en listado de parroquias:', e)
    return NextResponse.json({ ok: false, error: 'Error inesperado' }, { status: 500 })
  }
}