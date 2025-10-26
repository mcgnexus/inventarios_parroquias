"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GUADIX_PARISHES } from '@/data/guadixParishes'

// Definición de opciones visibles y valores internos
const CATEGORY_OPTIONS = ['Pintura','Escultura','Talla','Orfebreria','Ornamentos','Telas','Mobiliario','Documentos','Otros']
const CATEGORY_LOWER = CATEGORY_OPTIONS.map(s => s.toLowerCase())

// Tipado básico de initialData para evitar any y reflejar campos esperados
export type CatalogInitialData = Partial<{
   name: string
   descripcion_breve: string
   author: string
   autor: string
   location: string
   localizacion_actual: string
   descripcion_detallada: string
   observaciones: string
   tipo_objeto: string
   categoria: string
   datacion_aproximada: string
   siglos_estimados: string
   estilo_artistico: string
   iconografia: string
   materiales: string[]
   tecnicas: string[]
   dimensiones_estimadas: string
   estado_conservacion: string
   deterioros_visibles: string[]
   valor_artistico: string
   confianza_analisis: string
   inventory_number: string
   published_at: string
   parish_id: string
   parish_name: string
 }>

 interface Props {
   id: string
   initialData: CatalogInitialData
   onSaveSuccess?: () => void // Nueva prop para cerrar la sección
 }

export default function EditableCatalogForm({ id, initialData, onSaveSuccess }: Props) {
  const router = useRouter()
  const [name, setName] = useState<string>(initialData?.name || initialData?.descripcion_breve || '')
  const [author, setAuthor] = useState<string>(initialData?.author || initialData?.autor || '')
  const [location, setLocation] = useState<string>(initialData?.location || initialData?.localizacion_actual || '')
  const [descripcionDetallada, setDescripcionDetallada] = useState<string>(initialData?.descripcion_detallada || '')
  const [observaciones, setObservaciones] = useState<string>(initialData?.observaciones || '')
  const [tipoObjeto, setTipoObjeto] = useState<string>(initialData?.tipo_objeto || '')
  const [categoria, setCategoria] = useState<string>(initialData?.categoria || '')
  const [datacion, setDatacion] = useState<string>(initialData?.datacion_aproximada || '')
  const [siglos, setSiglos] = useState<string>(initialData?.siglos_estimados || '')
  const [estilo, setEstilo] = useState<string>(initialData?.estilo_artistico || '')
  const [iconografia, setIconografia] = useState<string>(initialData?.iconografia || '')
  const [materialesText, setMaterialesText] = useState<string>((initialData?.materiales || []).join(', '))
  const [tecnicasText, setTecnicasText] = useState<string>((initialData?.tecnicas || []).join(', '))
  const [dimensiones, setDimensiones] = useState<string>(initialData?.dimensiones_estimadas || '')
  const [estado, setEstado] = useState<string>(initialData?.estado_conservacion || '')
  const [deteriorosText, setDeteriorosText] = useState<string>((initialData?.deterioros_visibles || []).join(', '))
  const [valorArtistico, setValorArtistico] = useState<string>(initialData?.valor_artistico || '')
  const [confianza, setConfianza] = useState<string>(initialData?.confianza_analisis || '')
  const [inventoryNumber, setInventoryNumber] = useState<string>(initialData?.inventory_number || '')

  // Normalizar estado inicial si coincide con categorías conocidas
  useEffect(() => {
    const c = (initialData?.categoria || '') as string
    const lower = c.toLowerCase()
    if (CATEGORY_LOWER.includes(lower)) {
      setCategoria(lower)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Establecer fecha actual por defecto si no hay fecha inicial
  const getCurrentDate = () => {
    const now = new Date()
    return now.toISOString().split('T')[0] // Formato YYYY-MM-DD
  }

  const [publishedAt, setPublishedAt] = useState<string>(
    initialData?.published_at || getCurrentDate()
  )
  // Reemplaza el input libre de parroquia por desplegable + entrada manual
  type ParishOption = { id: string; name: string; location?: string }
  const [parishOptions, setParishOptions] = useState<ParishOption[]>([])
  const [parishSelection, setParishSelection] = useState<string>('')
  const [parishManual, setParishManual] = useState<string>('')
  const [parishSearch, setParishSearch] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>("")
  const [confirming, setConfirming] = useState(false)
  // Utilidad para detectar UUID
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)

  // Mezclar API con fallback estático (prioriza API por id y nombre)
  const mergeParishes = useCallback((api: ParishOption[], fallbackNames: { name: string; location?: string }[]): ParishOption[] => {
    const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const byKey = new Map<string, ParishOption>()
    for (const p of api) {
      const key = normalize(`${p.name}|${p.location || ''}`)
      byKey.set(key, { id: p.id || `${p.name}|${p.location || ''}`, name: p.name, location: p.location })
    }
    for (const f of fallbackNames) {
      const key = normalize(`${f.name}|${f.location || ''}`)
      if (!byKey.has(key)) {
        byKey.set(key, { id: `${f.name}|${f.location || ''}`, name: f.name, location: f.location })
      }
    }
    const merged = Array.from(byKey.values())
    merged.sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)))
    return merged
  }, [])

  useEffect(() => {
    // Inicializar selección/entrada manual según initialData
    const initialParish = (initialData?.parish_id || initialData?.parish_name || '') as string
    if (typeof initialParish === 'string' && isUuid(initialParish)) {
      setParishSelection(initialParish)
      setParishManual('')
    } else {
      setParishSelection('')
      setParishManual(initialParish || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      try {
        const res = await fetch('/api/parishes/list?diocese=Guadix')
        const js = await res.json()
        const apiRows: ParishOption[] = res.ok && js?.ok ? (js.parishes || []) : []
        const merged = mergeParishes(apiRows, GUADIX_PARISHES)
        setParishOptions(merged)
      } catch {
        setParishOptions(mergeParishes([], GUADIX_PARISHES))
      }
    }
    loadAll()
  }, [mergeParishes])

  // Buscar sin tildes y seleccionar la primera coincidencia, manteniendo todo el listado
  useEffect(() => {
    const strip = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const term = strip(parishSearch)
    if (!term) return
    const found = parishOptions.find(opt => strip(opt.name).includes(term) || strip(opt.location || '').includes(term))
    if (found) setParishSelection(found.id)
  }, [parishSearch, parishOptions])

  async function handleSave() {
    try {
      // Validación defensiva del id
      const idStr = typeof id === 'number' ? String(id) : String(id || '')
      if (!idStr) {
        setMessage('ID del elemento no válido')
        return
      }

      setSaving(true)
      setMessage('')
      const parish_input = parishSelection || parishManual || ''

      // Asegurar que la petición va al mismo origen/puerto actual
      const base = typeof window !== 'undefined' ? window.location.origin : ''
      const url = base ? `${base}/api/catalogo/update` : '/api/catalogo/update'

      // Normalizar categoría para compatibilidad si es conocida
      const categoriaToSave = categoria ? (CATEGORY_LOWER.includes(categoria.toLowerCase()) ? categoria.toLowerCase() : categoria) : ''

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: idStr,
          changes: {
            name,
            author,
            location,
            descripcion_detallada: descripcionDetallada,
            observaciones,
            tipo_objeto: tipoObjeto,
            categoria: categoriaToSave,
            datacion_aproximada: datacion,
            siglos_estimados: siglos,
            estilo_artistico: estilo,
            iconografia,
            materiales: materialesText,
            tecnicas: tecnicasText,
            dimensiones_estimadas: dimensiones,
            estado_conservacion: estado,
            deterioros_visibles: deteriorosText,
            valor_artistico: valorArtistico,
            confianza_analisis: confianza,
            inventory_number: inventoryNumber,
            published_at: publishedAt,
            parish_input,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Error guardando cambios')
      }
      setMessage('Cambios guardados')
      router.refresh()

      // Cerrar la sección de edición después de guardar exitosamente
      if (onSaveSuccess) {
        setTimeout(() => {
          onSaveSuccess()
        }, 1000) // Esperar 1 segundo para mostrar el mensaje de éxito
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error guardando cambios'
      setMessage(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-slate-800">Editar ficha</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Autor</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Localización</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Descripción detallada</label>
            <textarea
              value={descripcionDetallada}
              onChange={(e) => setDescripcionDetallada(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[100px]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[80px]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Tipo</label>
            <input type="text" value={tipoObjeto} onChange={(e)=>setTipoObjeto(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Categoría</label>
            <select
              value={categoria}
              onChange={(e)=>setCategoria(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Selecciona categoría</option>
              {CATEGORY_OPTIONS.map((label)=> (
                <option key={label.toLowerCase()} value={label.toLowerCase()}>{label}</option>
              ))}
              {!CATEGORY_LOWER.includes((categoria||'').toLowerCase()) && categoria && (
                <option value={categoria}>{categoria.charAt(0).toUpperCase() + categoria.slice(1)}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Datación</label>
            <input type="text" value={datacion} onChange={(e)=>setDatacion(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Siglos estimados</label>
            <input type="text" value={siglos} onChange={(e)=>setSiglos(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Estilo artístico</label>
            <input type="text" value={estilo} onChange={(e)=>setEstilo(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Iconografía</label>
            <textarea value={iconografia} onChange={(e)=>setIconografia(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[80px]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Materiales (coma separada)</label>
            <input type="text" value={materialesText} onChange={(e)=>setMaterialesText(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Técnicas (coma separada)</label>
            <input type="text" value={tecnicasText} onChange={(e)=>setTecnicasText(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Dimensiones</label>
            <input type="text" value={dimensiones} onChange={(e)=>setDimensiones(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Estado de conservación</label>
            <input type="text" value={estado} onChange={(e)=>setEstado(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Deterioros (coma separada)</label>
            <input type="text" value={deteriorosText} onChange={(e)=>setDeteriorosText(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Valor artístico</label>
            <input type="text" value={valorArtistico} onChange={(e)=>setValorArtistico(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Confianza</label>
            <input type="text" value={confianza} onChange={(e)=>setConfianza(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Número de inventario</label>
            <input type="text" value={inventoryNumber} onChange={(e)=>setInventoryNumber(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
             <label className="text-xs font-semibold text-slate-600">Publicado el</label>
             <input 
               type="date" 
               value={publishedAt} 
               onChange={(e)=>setPublishedAt(e.target.value)} 
               className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" 
             />
           </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Parroquia</label>
            <input
              type="text"
              value={parishSearch}
              onChange={(e) => setParishSearch(e.target.value)}
              placeholder="Buscar por nombre o municipio (Guadix)"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />

            <select
              value={parishSelection}
              onChange={(e) => {
                const val = e.target.value
                if (isUuid(val)) {
                  setParishSelection(val)
                  setParishManual('')
                } else {
                  const selected = parishOptions.find(o => o.id === val)
                  setParishSelection('')
                  setParishManual(selected?.name || val)
                }
              }}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Selecciona parroquia (Guadix)</option>
              {parishOptions.map((opt) => {
                const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                const term = normalize(parishSearch || '')
                const isMatch = !!parishSearch && (normalize(opt.name).includes(term) || normalize(opt.location || '').includes(term))
                return (
                  <option
                    key={opt.id}
                    value={opt.id}
                    style={isMatch ? { color: '#16a34a', fontWeight: 600 } : undefined}
                  >
                    {opt.name}{opt.location ? ` (${opt.location})` : ''}{isMatch ? ' ✓' : ''}
                  </option>
                )
              })}
            </select>
            <div className="mt-2 text-xs text-slate-600">Si no aparece en la lista, introduce el nombre exacto:</div>
            <input
              type="text"
              value={parishManual}
              onChange={(e) => setParishManual(e.target.value)}
              placeholder="Nombre de la parroquia"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm disabled:opacity-60"
            >
              💾 Guardar cambios
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm disabled:opacity-60"
              >
                ✅ Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm disabled:opacity-60"
              >
                ✖️ Cancelar
              </button>
            </>
          )}
          {message && (
            <span className="text-sm text-slate-600">{message}</span>
          )}
        </div>
      </div>
    </div>
  )
}