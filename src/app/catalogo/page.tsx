import Link from 'next/link'
import { Suspense } from 'react'
import Image from 'next/image'
import { obtenerCatalogo } from '@/lib/supabase'
import CatalogoUserFilter from '@/components/CatalogoUserFilter'
import FullscreenImage from '@/components/FullscreenImage'

export const dynamic = 'force-dynamic'

type SearchParams = { tipo?: string; categoria?: string; q?: string; parroquia?: string; user?: string }

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const userParam = (sp?.user || '').trim()
  // Mostrar catálogo: si viene user en la URL, filtrar por ese usuario; si no, público
  const items = await obtenerCatalogo(userParam || undefined)

  const tipo = (sp?.tipo || '').trim()
  const categoria = (sp?.categoria || '').trim().toLowerCase()
  const q = (sp?.q || '').trim().toLowerCase()
  const parroquia = (sp?.parroquia || '').trim()
  const qsParts: string[] = []
  if (tipo) qsParts.push(`tipo=${encodeURIComponent(tipo)}`)
  if (categoria) qsParts.push(`categoria=${encodeURIComponent(categoria)}`)
  if (q) qsParts.push(`q=${encodeURIComponent(q)}`)
  if (parroquia) qsParts.push(`parroquia=${encodeURIComponent(parroquia)}`)
  if (userParam) qsParts.push(`user=${encodeURIComponent(userParam)}`)
  const queryString = qsParts.length ? `?${qsParts.join('&')}` : ''

  const tipos = Array.from(new Set(items.map(i => i.data.tipo_objeto).filter(Boolean))).sort()
  // Opciones fijas de categoría con compatibilidad adicional
  const CATEGORY_OPTIONS = ['Pintura','Escultura','Talla','Orfebreria','Ornamentos','Telas','Mobiliario','Documentos','Otros']
  const CATEGORY_LOWER = CATEGORY_OPTIONS.map(s => s.toLowerCase())
  const categoriasExtra = Array.from(new Set(items.map(i => (i.data.categoria || '').toLowerCase()).filter(c => c && !CATEGORY_LOWER.includes(c)))).sort()

  // Parroquias únicas detectadas en los items
  const parroquias = Array.from(new Set(
    items
      .map(i => (i.data.parish_name || (typeof i.data.parish_id === 'string' ? i.data.parish_id : '')).trim())
      .filter(Boolean)
  )).sort()

  // Nombre para encabezado
  const parishHeader = parroquia || (parroquias.length === 1 ? parroquias[0] : '')

  const filtrados = items.filter(it => {
    const d = it.data
    const matchTipo = !tipo || (d.tipo_objeto || '').toLowerCase() === tipo.toLowerCase()
    const matchCat = !categoria || (d.categoria || '').toLowerCase() === categoria
    const matchQ = !q || [
      d.descripcion_breve,
      d.descripcion_detallada,
      d.estilo_artistico,
      d.iconografia,
      d.observaciones,
      d.valor_artistico,
      d.datacion_aproximada,
      d.siglos_estimados,
      d.categoria,
      d.tipo_objeto,
    ].some(v => (v || '').toLowerCase().includes(q))
    const dParroquia = (d.parish_name || (typeof d.parish_id === 'string' ? d.parish_id : '')).toLowerCase()
    const matchParroquia = !parroquia || dParroquia === parroquia.toLowerCase()
    return matchTipo && matchCat && matchQ && matchParroquia
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-4">
        <img src="/escudo-guadix.jpg" alt="Escudo Guadix" className="h-12 w-auto logo-escudo" />
        <div className="text-sm text-slate-600">Diócesis de Guadix — Catálogo</div>
      </div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catálogo</h1>
          {parishHeader && (
            <p className="text-sm text-slate-600">Parroquia: {parishHeader}</p>
          )}
          {userParam && (
            <p className="text-xs mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Filtrando: Mis piezas</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <CatalogoUserFilter />
          </Suspense>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-800">Volver</Link>
        </div>
      </div>

      <form method="GET" className="mb-6 bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-4 items-end">
        {userParam && (
          <input type="hidden" name="user" value={userParam} />
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
          <select name="tipo" defaultValue={tipo} className="text-sm border border-slate-300 rounded px-2 py-1 bg-white">
            <option value="">Todos</option>
            {tipos.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
          <select name="categoria" defaultValue={categoria} className="text-sm border border-slate-300 rounded px-2 py-1 bg-white">
            <option value="">Todas</option>
            {CATEGORY_OPTIONS.map(label => (
              <option key={label.toLowerCase()} value={label.toLowerCase()}>{label}</option>
            ))}
            {categoriasExtra.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Parroquia</label>
          <select name="parroquia" defaultValue={parroquia} className="text-sm border border-slate-300 rounded px-2 py-1 bg-white">
            <option value="">Todas</option>
            {parroquias.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Buscar</label>
          <input
            type="text"
            name="q"
            placeholder="Palabras clave (descripción, estilo, observaciones...)"
            defaultValue={q}
            className="w-full text-sm border border-slate-300 rounded px-3 py-1.5"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">Filtrar</button>
          <Link href="/catalogo" className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200">Limpiar</Link>
        </div>
      </form>

      {filtrados.length === 0 ? (
        <p className="text-slate-600">No hay elementos que coincidan con el filtro.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtrados.map((it) => (
              <div key={it.id} id={`item-${it.id}`} className="relative group bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <Link href={`/catalogo/${it.id}${queryString}`} className="block bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-200">
                <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
                  {it.data.image_url ? (
                    <FullscreenImage
                      src={it.data.image_url}
                      alt={it.data.descripcion_breve || it.data.tipo_objeto}
                      imgClassName="w-full h-full object-contain"
                      containerClassName="w-full h-full"
                    />
                  ) : (
                    <div className="text-slate-400 text-sm">Sin imagen</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-slate-800">{it.data.descripcion_breve || it.data.tipo_objeto}</h3>
                  <p className="text-xs text-slate-600 mt-1">{it.data.categoria} · {it.data.datacion_aproximada || it.data.siglos_estimados}</p>
                </div>
              </Link>
              <Link href={`/catalogo/${it.id}${queryString}`} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-white/90 border border-slate-200 rounded p-1 shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Image src="/window.svg" alt="Abrir en nueva pestaña" width={16} height={16} />
              </Link>
            </div>
          ))}
        </div>
      )}
      <footer className="text-center mt-10 text-sm text-gray-500">
        <p>💡Creado por: Manuel Carrasco García</p>
      </footer>
    </div>
  )
}
