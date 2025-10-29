import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { obtenerCatalogoItem, obtenerParroquiaNombre, obtenerCatalogo } from '@/lib/supabase'
import FullscreenImage from '@/components/FullscreenImage'
import ExportPDFButton from '@/components/ExportPDFButton'
import AuthEditControls from '@/components/AuthEditControls'

export const dynamic = 'force-dynamic'

export default async function CatalogoDetallePage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ tipo?: string; categoria?: string; q?: string; user?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const tipo = (sp?.tipo || '').trim()
  const categoria = (sp?.categoria || '').trim().toLowerCase()
  const q = (sp?.q || '').trim().toLowerCase()
  const userParam = (sp?.user || '').trim()
  if (!id) notFound()
  const item = await obtenerCatalogoItem(id)
  if (!item) notFound()
  
  // Obtener todos los items para la navegación (mismo usuario del item)
  const allItems = await obtenerCatalogo(userParam || item.user_id)
  const filtrados = allItems.filter(it => {
    const tipoMatch = !tipo || it.data.tipo_objeto === tipo
    const categoriaMatch = !categoria || (it.data.categoria || '').toLowerCase() === categoria
    const autorMaybe = String(it.data.autor || it.data.author || '')
    const texto = `${it.data.descripcion_breve || ''} ${it.data.categoria || ''} ${autorMaybe}`.toLowerCase()
    const qMatch = !q || texto.includes(q)
    return tipoMatch && categoriaMatch && qMatch
  })
  
  // Índice actual dentro de la lista filtrada
  const currentIndexFiltered = filtrados.findIndex(it => String(it.id) === String(id))
  // Objetivo al quitar filtros: mismo índice en lista completa si existe
  const targetIdOnClear = currentIndexFiltered >= 0 && currentIndexFiltered < allItems.length
    ? allItems[currentIndexFiltered]?.id ?? id
    : id
const prevItem = currentIndexFiltered > 0 ? filtrados[currentIndexFiltered - 1] : null
const nextItem = currentIndexFiltered >= 0 && currentIndexFiltered < filtrados.length - 1 ? filtrados[currentIndexFiltered + 1] : null
  const qsParts: string[] = []
  if (tipo) qsParts.push(`tipo=${encodeURIComponent(tipo)}`)
  if (categoria) qsParts.push(`categoria=${encodeURIComponent(categoria)}`)
  if (q) qsParts.push(`q=${encodeURIComponent(q)}`)
  if (userParam) qsParts.push(`user=${encodeURIComponent(userParam)}`)
  const queryString = qsParts.length ? `?${qsParts.join('&')}` : ''
  const d = item.data
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
  const parishName = (typeof d.parish_id === 'string' && isUuid(d.parish_id))
    ? await obtenerParroquiaNombre(d.parish_id)
    : (d.parish_name || (typeof d.parish_id === 'string' ? d.parish_id : null))

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 print-container relative">
      {/* Navegación lateral deshabilitada; usar botones superiores */}
       <div className="flex items-baseline justify-between mb-6 print-header">
         <h1 className="text-2xl font-bold text-slate-800">{d.descripcion_breve || d.tipo_objeto}</h1>
         <div className="flex items-center gap-3">
           {prevItem ? (
             <Link
               href={`/catalogo/${prevItem.id}${queryString}`}
               className="px-3 py-1.5 rounded text-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
               aria-label="Ver elemento anterior"
             >
               ← Anterior
             </Link>
           ) : (
             <span
               className="px-3 py-1.5 rounded text-sm border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
               aria-hidden="true"
             >
               ← Anterior
             </span>
           )}
           {nextItem ? (
             <Link
               href={`/catalogo/${nextItem.id}${queryString}`}
               className="px-3 py-1.5 rounded text-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
               aria-label="Ver elemento siguiente"
             >
               Siguiente →
             </Link>
           ) : (
             <span
               className="px-3 py-1.5 rounded text-sm border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
               aria-hidden="true"
             >
               Siguiente →
             </span>
           )}
          <ExportPDFButton data={d} />
           {/* Botón de editar movido fuera del header */}
           <Link href={`/catalogo${queryString}#item-${id}`} className="text-sm text-slate-600 hover:text-slate-800 no-print">Volver al catálogo</Link>
         </div>
       </div>
       {(tipo || categoria || q || userParam) && (
         <div className="mb-4 no-print flex flex-wrap items-center gap-2">
           {tipo && (
             <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
               Tipo: {tipo}
             </span>
           )}
           {categoria && (
             <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
               Categoría: {categoria.charAt(0).toUpperCase() + categoria.slice(1)}
             </span>
           )}
           {q && (
             <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
               Buscar: {q}
             </span>
           )}
           {userParam && (
             <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700">
               Mis piezas
             </span>
           )}
           <Link
              href={`/catalogo/${targetIdOnClear}`}
              className="ml-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100"
              aria-label="Quitar filtros activos en navegación"
            >
              Quitar filtros
            </Link>
         </div>
       )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6 print-card">
        <div className="flex items-center gap-3 mb-4">
          <Image
            src="/guadix.svg"
            alt="Diócesis de Guadix"
            width={48}
            height={48}
            priority
            className="h-12 w-12 logo-escudo"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-800">FICHA DE INVENTARIO DE BIENES MUEBLES</div>
            <div className="text-xs text-slate-600">{parishName || '—'}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-600">Nombre</div>
            <div className="text-sm text-slate-800">{d.name || d.descripcion_breve || d.tipo_objeto}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">Número de inventario</div>
            <div className="text-sm text-slate-800">{d.inventory_number || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">Autor</div>
            <div className="text-sm text-slate-800">{d.author || d.autor || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">Localización</div>
            <div className="text-sm text-slate-800">{d.location || d.localizacion_actual || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">Parroquia</div>
            <div className="text-sm text-slate-800">{parishName || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">Creado por</div>
            <div className="text-sm text-slate-800">{item.user_id || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">Creado el</div>
            <div className="text-sm text-slate-800">{item.fecha}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">Publicado el</div>
            <div className="text-sm text-slate-800">{d.published_at || '—'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex items-center justify-center min-h-[240px] h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh] print-image">
            {d.image_url ? (
              <FullscreenImage
                src={d.image_url}
                alt={d.descripcion_breve || d.tipo_objeto}
                imgClassName="max-w-full max-h-full object-contain"
                containerClassName="w-full h-full"
              />
            ) : (
              <div className="p-6 text-slate-500 text-sm">Sin imagen</div>
            )}
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 print-card">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-slate-800">Ficha</h2>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-600">Tipo</div>
                  <div className="text-sm text-slate-800">{d.tipo_objeto}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Categoría</div>
                  <div className="text-sm text-slate-800">{d.categoria}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Datación</div>
                  <div className="text-sm text-slate-800">{d.datacion_aproximada || d.siglos_estimados}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Estilo</div>
                  <div className="text-sm text-slate-800">{d.estilo_artistico}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold text-slate-600">Descripción detallada</div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{d.descripcion_detallada}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold text-slate-600">Iconografía</div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{d.iconografia}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Materiales</div>
                  <div className="text-sm text-slate-800">{(d.materiales || []).join(', ')}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Técnicas</div>
                  <div className="text-sm text-slate-800">{(d.tecnicas || []).join(', ')}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Dimensiones</div>
                  <div className="text-sm text-slate-800">{d.dimensiones_estimadas}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Estado</div>
                  <div className="text-sm text-slate-800">{d.estado_conservacion}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Deterioros</div>
                  <div className="text-sm text-slate-800">{(d.deterioros_visibles || []).join(', ')}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Valor artístico</div>
                  <div className="text-sm text-slate-800">{d.valor_artistico}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Confianza</div>
                  <div className="text-sm text-slate-800">{d.confianza_analisis}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold text-slate-600">Observaciones</div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{d.observaciones}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 no-print">
            <AuthEditControls id={String(item.id)} name={d.name || d.descripcion_breve || d.tipo_objeto} initialData={d} />
          </div>
        </div>
      </div>
      <footer className="text-center mt-10 text-sm text-gray-500">
        <p>💡Creado por: Manuel Carrasco García</p>
      </footer>
    </div>
  )
}