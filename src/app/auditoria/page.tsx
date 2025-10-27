import Link from 'next/link'
import { obtenerCatalogo } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function AuditoriaPage() {
  const items = await obtenerCatalogo()

  const publicadosSinImagen = items.filter(it => {
    const d = it.data
    const status = (d.status || '').toLowerCase()
    const isPublished = !!d.published_at || status === 'published'
    const hasImage = !!(d.image_url && d.image_url.trim())
    return isPublished && !hasImage
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Auditoría</h1>
          <p className="text-sm text-slate-600">Piezas publicadas sin imagen</p>
        </div>
        <Link href="/catalogo" className="text-sm text-slate-600 hover:text-slate-800">Volver al catálogo</Link>
      </div>

      {publicadosSinImagen.length === 0 ? (
        <p className="text-slate-600">No hay piezas publicadas sin imagen.</p>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Descripción</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Categoría</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Parroquia</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Fecha</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {publicadosSinImagen.map(it => {
                const d = it.data
                const parish = d.parish_name || (typeof d.parish_id === 'string' ? d.parish_id : '')
                return (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{d.descripcion_breve || d.name || d.tipo_objeto}</td>
                    <td className="px-3 py-2">{d.tipo_objeto}</td>
                    <td className="px-3 py-2">{d.categoria}</td>
                    <td className="px-3 py-2">{parish}</td>
                    <td className="px-3 py-2">{new Date(it.fecha).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Link href={`/catalogo/${it.id}`} className="px-2 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">Ver</Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <footer className="text-center mt-10 text-sm text-gray-500">
        <p>💡Auditoría para corregir piezas antes de aprobación.</p>
      </footer>
    </div>
  )
}