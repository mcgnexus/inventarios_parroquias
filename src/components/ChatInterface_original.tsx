'use client'
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from 'react'
import { enviarMensajeDify, enviarImagenDifyConInputArchivo, prepararImagen } from '@/lib/dify'
import { guardarConversacion, guardarCatalogacion } from '@/lib/supabase'

interface Mensaje {
  tipo: 'usuario' | 'ia' | 'sistema'
  texto: string
  timestamp: Date
  catalogacion?: CatalogacionIA
  mensajeId?: string
  imagenOriginal?: File  // Guardar referencia a la imagen original
}

interface CatalogacionIA {
  tipo_objeto: string
  categoria: string
  descripcion_breve: string
  descripcion_detallada: string
  materiales: string[]
  tecnicas: string[]
  estilo_artistico: string
  datacion_aproximada: string
  siglos_estimados: string
  iconografia: string
  estado_conservacion: string
  deterioros_visibles: string[]
  dimensiones_estimadas: string
  valor_artistico: string
  observaciones: string
  confianza_analisis: string
}

// Categorías rápidas
const CATEGORIAS_RAPIDAS = [
  { emoji: '🕯️', label: 'Orfebrería litúrgica', descripcion: 'Cáliz, custodia, copón, patena...' },
  { emoji: '📿', label: 'Ornamentos litúrgicos', descripcion: 'Casulla, estola, paño de altar...' },
  { emoji: '🖼️', label: 'Imaginería', descripcion: 'Imágenes, retablos, crucifijos...' },
  { emoji: '📚', label: 'Documentos', descripcion: 'Libros, pergaminos, actas...' },
]

export default function ChatInterface() {
  const [mensaje, setMensaje] = useState('')
  const [conversacion, setConversacion] = useState<Mensaje[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagenSeleccionada, setImagenSeleccionada] = useState<File | null>(null)
  const [previewImagen, setPreviewImagen] = useState<string | null>(null)
  
  // Estados para edición
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [catalogacionEditada, setCatalogacionEditada] = useState<CatalogacionIA | null>(null)
  
  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversacion])

  // Manejar selección de imagen
  const manejarSeleccionImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError('La imagen es demasiado grande. Máximo: 20MB')
        return
      }
      
      setImagenSeleccionada(file)
      
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewImagen(reader.result as string)
      }
      reader.readAsDataURL(file)
      
      setError(null)
    }
  }

  const limpiarImagen = () => {
    setImagenSeleccionada(null)
    setPreviewImagen(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const analizarObjeto = async () => {
    if (!mensaje.trim() && !imagenSeleccionada) return

    setError(null)

    const contenidoMensaje = imagenSeleccionada 
      ? `📸 Imagen adjunta: ${imagenSeleccionada.name}\n${mensaje || 'Analizar objeto en la fotografía'}`
      : mensaje

    const mensajeId = Date.now().toString()
    const imagenOriginalRef = imagenSeleccionada // Guardar referencia

    const nuevoMensajeUsuario: Mensaje = {
      tipo: 'usuario',
      texto: contenidoMensaje,
      timestamp: new Date(),
      mensajeId,
      imagenOriginal: imagenOriginalRef || undefined
    }
    
    setConversacion(prev => [...prev, nuevoMensajeUsuario])
    
    const mensajeParaEnviar = mensaje || 'Por favor, analiza este objeto del patrimonio parroquial'
    setMensaje('')
    setCargando(true)

    try {
      const userId = 'usuario-huescar-catalogacion'
      
      let respuesta
      if (imagenSeleccionada) {
        const mensajeSistema: Mensaje = {
          tipo: 'sistema',
          texto: '⚙️ Preparando imagen para análisis...',
          timestamp: new Date()
        }
        setConversacion(prev => [...prev, mensajeSistema])
        
        const imagenPreparada = await prepararImagen(imagenSeleccionada)
        
        if (imagenPreparada.size !== imagenSeleccionada.size) {
          const mensajeCompresion: Mensaje = {
            tipo: 'sistema',
            texto: `✅ Imagen optimizada: ${(imagenSeleccionada.size / 1024).toFixed(1)}KB → ${(imagenPreparada.size / 1024).toFixed(1)}KB`,
            timestamp: new Date()
          }
          setConversacion(prev => [...prev, mensajeCompresion])
        }
        
        respuesta = await enviarImagenDifyConInputArchivo(mensajeParaEnviar, imagenPreparada, userId)
      } else {
        respuesta = await enviarMensajeDify(mensajeParaEnviar, userId)
      }

      if (respuesta.exito && respuesta.respuesta) {
        let catalogacion: CatalogacionIA | null = null
        const textoRespuesta = respuesta.respuesta

        try {
          const jsonMatch = respuesta.respuesta.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            catalogacion = JSON.parse(jsonMatch[0])
          }
        } catch {
          console.log('No se pudo parsear como JSON, mostrando texto plano')
        }

        const nuevoMensajeIA: Mensaje = {
          tipo: 'ia',
          texto: textoRespuesta,
          timestamp: new Date(),
          catalogacion: catalogacion || undefined,
          mensajeId: 'ia-' + mensajeId,
          imagenOriginal: imagenOriginalRef || undefined
        }
        
        setConversacion(prev => [...prev, nuevoMensajeIA])

        // Guardar solo el texto de la conversación (sin imagen aún)
        guardarConversacion(userId, mensajeParaEnviar, respuesta.respuesta)
          .catch(err => console.error('Error al guardar:', err))
        
      } else {
        throw new Error(respuesta.error || 'Error desconocido')
      }
      
    } catch (err) {
      const mensajeError = err instanceof Error ? err.message : 'Error desconocido'
      setError(mensajeError)
      
      const nuevoMensajeError: Mensaje = {
        tipo: 'sistema',
        texto: '❌ Error al analizar el objeto. Por favor, intente nuevamente.',
        timestamp: new Date()
      }
      
      setConversacion(prev => [...prev, nuevoMensajeError])
      
    } finally {
      setCargando(false)
      limpiarImagen()
    }
  }

  const manejarKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      analizarObjeto()
    }
  }

  // Funciones de edición
  const iniciarEdicion = (mensajeId: string, cat: CatalogacionIA) => {
    setEditandoId(mensajeId)
    setCatalogacionEditada({ ...cat })
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setCatalogacionEditada(null)
  }

  const guardarEdicion = (mensajeId: string) => {
    if (!catalogacionEditada) return

    setConversacion(prev => prev.map(msg => {
      if (msg.mensajeId === mensajeId && msg.catalogacion) {
        return {
          ...msg,
          catalogacion: { ...catalogacionEditada }
        }
      }
      return msg
    }))

    setEditandoId(null)
    setCatalogacionEditada(null)
  }

  const actualizarCampo = <K extends keyof CatalogacionIA>(
    campo: K,
    valor: CatalogacionIA[K]
  ) => {
    if (!catalogacionEditada) return
    setCatalogacionEditada({
      ...catalogacionEditada,
      [campo]: valor
    })
  }

  const actualizarArray = (campo: 'materiales' | 'tecnicas' | 'deterioros_visibles', texto: string) => {
    if (!catalogacionEditada) return
    const valores = texto.split(',').map(v => v.trim()).filter(v => v)
    setCatalogacionEditada({
      ...catalogacionEditada,
      [campo]: valores
    })
  }

  // FUNCIÓN CLAVE: Aprobar y guardar con imagen
  const aprobarCatalogacion = async (cat: CatalogacionIA, mensajeId?: string) => {
    setGuardando(true)
    try {
      // Buscar el mensaje con la imagen original
      const mensajeConImagen = conversacion.find(m => 
        m.mensajeId === mensajeId || m.mensajeId === mensajeId?.replace('ia-', '')
      )

      const userId = 'usuario-huescar-catalogacion'
      
      // Guardar catalogación CON imagen
      const resultado = await guardarCatalogacion(
        userId,
        {
          user_id: userId,
          ...cat
        },
        mensajeConImagen?.imagenOriginal ?? null // Pasar la imagen original
      )

      if (resultado) {
        // Mostrar mensaje de éxito
        const mensajeExito: Mensaje = {
          tipo: 'sistema',
          texto: '✅ Catalogación guardada correctamente en la base de datos con su imagen.',
          timestamp: new Date()
        }
        setConversacion(prev => [...prev, mensajeExito])
      } else {
        throw new Error('No se pudo guardar')
      }
    } catch (error) {
      console.error('Error al guardar:', error)
      const mensajeError: Mensaje = {
        tipo: 'sistema',
        texto: '❌ Error al guardar la catalogación. Por favor, intente nuevamente.',
        timestamp: new Date()
      }
      setConversacion(prev => [...prev, mensajeError])
    } finally {
      setGuardando(false)
    }
  }

  const reanalizar = () => {
    const mensajeInfo: Mensaje = {
      tipo: 'sistema',
      texto: '💡 Para reanalizar, suba nuevamente la imagen del objeto.',
      timestamp: new Date()
    }
    setConversacion(prev => [...prev, mensajeInfo])
  }

  // Renderizar catalogación (modo lectura o edición)
  const renderCatalogacion = (cat: CatalogacionIA, mensajeId?: string) => {
    const estaEditando = mensajeId === editandoId
    const datos = estaEditando && catalogacionEditada ? catalogacionEditada : cat

    return (
      <div className="mt-4 space-y-3 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
        <h4 className="font-bold text-blue-900 text-lg border-b-2 border-blue-300 pb-2">
          📋 Ficha de Catalogación
        </h4>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          {/* Tipo de objeto */}
          <div>
            <p className="font-semibold text-gray-700">Tipo de objeto:</p>
            {estaEditando ? (
              <input
                type="text"
                value={datos.tipo_objeto}
                onChange={(e) => actualizarCampo('tipo_objeto', e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            ) : (
              <p className="text-gray-900">{datos.tipo_objeto}</p>
            )}
          </div>
          
          {/* Categoría */}
          <div>
            <p className="font-semibold text-gray-700">Categoría:</p>
            {estaEditando ? (
              <select
                value={datos.categoria}
                onChange={(e) => actualizarCampo('categoria', e.target.value)}
                className="w-full px-2 py-1 border rounded"
              >
                <option value="orfebrería">Orfebrería</option>
                <option value="ornamento_litúrgico">Ornamento litúrgico</option>
                <option value="imaginería">Imaginería</option>
                <option value="mobiliario">Mobiliario</option>
                <option value="documento">Documento</option>
                <option value="otro">Otro</option>
              </select>
            ) : (
              <p className="text-gray-900">{datos.categoria}</p>
            )}
          </div>
          
          {/* Descripción breve */}
          <div className="col-span-2">
            <p className="font-semibold text-gray-700">Descripción breve:</p>
            {estaEditando ? (
              <input
                type="text"
                value={datos.descripcion_breve}
                onChange={(e) => actualizarCampo('descripcion_breve', e.target.value)}
                className="w-full px-2 py-1 border rounded"
                maxLength={200}
              />
            ) : (
              <p className="text-gray-900">{datos.descripcion_breve}</p>
            )}
          </div>
          
          {/* Descripción detallada */}
          <div className="col-span-2">
            <p className="font-semibold text-gray-700">Descripción detallada:</p>
            {estaEditando ? (
              <textarea
                value={datos.descripcion_detallada}
                onChange={(e) => actualizarCampo('descripcion_detallada', e.target.value)}
                className="w-full px-2 py-1 border rounded"
                rows={4}
              />
            ) : (
              <p className="text-gray-900 whitespace-pre-wrap">{datos.descripcion_detallada}</p>
            )}
          </div>
          
          {/* Materiales */}
          <div>
            <p className="font-semibold text-gray-700">Materiales:</p>
            {estaEditando ? (
              <input
                type="text"
                value={datos.materiales.join(', ')}
                onChange={(e) => actualizarArray('materiales', e.target.value)}
                className="w-full px-2 py-1 border rounded"
                placeholder="Separados por comas"
              />
            ) : (
              <p className="text-gray-900">{datos.materiales.join(', ')}</p>
            )}
          </div>
          
          {/* Técnicas */}
          <div>
            <p className="font-semibold text-gray-700">Técnicas:</p>
            {estaEditando ? (
              <input
                type="text"
                value={datos.tecnicas.join(', ')}
                onChange={(e) => actualizarArray('tecnicas', e.target.value)}
                className="w-full px-2 py-1 border rounded"
                placeholder="Separados por comas"
              />
            ) : (
              <p className="text-gray-900">{datos.tecnicas.join(', ')}</p>
            )}
          </div>
          
          {/* Estilo artístico */}
          <div>
            <p className="font-semibold text-gray-700">Estilo artístico:</p>
            {estaEditando ? (
              <input
                type="text"
                value={datos.estilo_artistico}
                onChange={(e) => actualizarCampo('estilo_artistico', e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            ) : (
              <p className="text-gray-900">{datos.estilo_artistico}</p>
            )}
          </div>
          
          {/* Datación */}
          <div>
            <p className="font-semibold text-gray-700">Datación:</p>
            {estaEditando ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={datos.datacion_aproximada}
                  onChange={(e) => actualizarCampo('datacion_aproximada', e.target.value)}
                  className="w-full px-2 py-1 border rounded"
                  placeholder="Datación aproximada"
                />
                <input
                  type="text"
                  value={datos.siglos_estimados}
                  onChange={(e) => actualizarCampo('siglos_estimados', e.target.value)}
                  className="w-full px-2 py-1 border rounded"
                  placeholder="Siglos estimados (opcional)"
                />
              </div>
            ) : (
              <p className="text-gray-900">{datos.datacion_aproximada}{datos.siglos_estimados ? ` (${datos.siglos_estimados})` : ''}</p>
            )}
          </div>
          
          {/* Iconografía */}
          {datos.iconografia && (
            <div className="col-span-2">
              <p className="font-semibold text-gray-700">Iconografía:</p>
              {estaEditando ? (
                <textarea
                  value={datos.iconografia}
                  onChange={(e) => actualizarCampo('iconografia', e.target.value)}
                  className="w-full px-2 py-1 border rounded"
                  rows={2}
                />
              ) : (
                <p className="text-gray-900">{datos.iconografia}</p>
              )}
            </div>
          )}
          
          {/* Estado de conservación */}
          <div>
            <p className="font-semibold text-gray-700">Estado de conservación:</p>
            {estaEditando ? (
              <select
                value={datos.estado_conservacion}
                onChange={(e) => actualizarCampo('estado_conservacion', e.target.value)}
                className="w-full px-2 py-1 border rounded"
              >
                <option value="excelente">Excelente</option>
                <option value="bueno">Bueno</option>
                <option value="regular">Regular</option>
                <option value="deficiente">Deficiente</option>
                <option value="crítico">Crítico</option>
              </select>
            ) : (
              <p className={`font-semibold ${
                datos.estado_conservacion === 'excelente' ? 'text-green-600' :
                datos.estado_conservacion === 'bueno' ? 'text-blue-600' :
                datos.estado_conservacion === 'regular' ? 'text-yellow-600' :
                datos.estado_conservacion === 'deficiente' ? 'text-orange-600' :
                'text-red-600'
              }`}>
                {datos.estado_conservacion.toUpperCase()}
              </p>
            )}
          </div>
          
          {/* Deterioros visibles */}
          {datos.deterioros_visibles.length > 0 && (
            <div>
              <p className="font-semibold text-gray-700">Deterioros visibles:</p>
              {estaEditando ? (
                <input
                  type="text"
                  value={datos.deterioros_visibles.join(', ')}
                  onChange={(e) => actualizarArray('deterioros_visibles', e.target.value)}
                  className="w-full px-2 py-1 border rounded"
                  placeholder="Separados por comas"
                />
              ) : (
                <p className="text-gray-900">{datos.deterioros_visibles.join(', ')}</p>
              )}
            </div>
          )}
          
          {/* Dimensiones */}
          <div>
            <p className="font-semibold text-gray-700">Dimensiones estimadas:</p>
            {estaEditando ? (
              <input
                type="text"
                value={datos.dimensiones_estimadas}
                onChange={(e) => actualizarCampo('dimensiones_estimadas', e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            ) : (
              <p className="text-gray-900">{datos.dimensiones_estimadas}</p>
            )}
          </div>
          
          {/* Valor artístico */}
          <div>
            <p className="font-semibold text-gray-700">Valor artístico:</p>
            {estaEditando ? (
              <select
                value={datos.valor_artistico}
                onChange={(e) => actualizarCampo('valor_artistico', e.target.value)}
                className="w-full px-2 py-1 border rounded"
              >
                <option value="muy_alto">Muy alto</option>
                <option value="alto">Alto</option>
                <option value="medio">Medio</option>
                <option value="regular">Regular</option>
                <option value="bajo">Bajo</option>
              </select>
            ) : (
              <p className="text-gray-900 font-semibold">{datos.valor_artistico.replace('_', ' ').toUpperCase()}</p>
            )}
          </div>
          
          {/* Observaciones */}
          {datos.observaciones && (
            <div className="col-span-2">
              <p className="font-semibold text-gray-700">Observaciones:</p>
              {estaEditando ? (
                <textarea
                  value={datos.observaciones}
                  onChange={(e) => actualizarCampo('observaciones', e.target.value)}
                  className="w-full px-2 py-1 border rounded"
                  rows={2}
                />
              ) : (
                <p className="text-gray-900 italic">{datos.observaciones}</p>
              )}
            </div>
          )}
          
          {/* Confianza */}
          <div className="col-span-2 pt-2 border-t-2 border-blue-200">
            <p className="font-semibold text-gray-700">Confianza del análisis:</p>
            <p className={`font-bold ${
              datos.confianza_analisis === 'alta' ? 'text-green-600' :
              datos.confianza_analisis === 'media' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {datos.confianza_analisis.toUpperCase()}
            </p>
          </div>
        </div>
        
        {/* Botones de acción */}
        <div className="flex gap-3 pt-3 border-t-2 border-blue-200">
          {estaEditando ? (
            <>
              <button
                onClick={() => mensajeId && guardarEdicion(mensajeId)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                ✅ Guardar Cambios
              </button>
              <button
                onClick={cancelarEdicion}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                ✕ Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => aprobarCatalogacion(cat, mensajeId)}
                disabled={guardando}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400"
              >
                {guardando ? '⏳ Guardando...' : '✅ Aprobar y Guardar'}
              </button>
              <button
                onClick={() => mensajeId && iniciarEdicion(mensajeId, cat)}
                disabled={guardando}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold disabled:bg-gray-400"
              >
                ✏️ Editar Catalogación
              </button>
              <button
                onClick={reanalizar}
                disabled={guardando}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400"
              >
                🔄 Reanalizar
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[750px] max-w-6xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
      
      {/* ENCABEZADO */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">⛪</span>
              <h2 className="text-xl font-bold">FIDES DIGITAL</h2>
            </div>
            <p className="text-sm text-blue-100 ml-9">
              Sistema de Catalogación Patrimonial con IA
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-blue-100">Parroquia Mayor de la Encarnación</p>
            <p className="text-blue-200 font-semibold">Huéscar, Granada</p>
          </div>
        </div>
      </div>

      {/* SUBHEADER */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 py-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <span>📸</span>
          <span>Suba fotografía → Revise catalogación → Edite si necesario → Guarde en base de datos</span>
        </p>
      </div>

      {/* ÁREA DE MENSAJES */}
      <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-br from-slate-50 to-blue-50 space-y-4">
        
        {/* Bienvenida */}
        {conversacion.length === 0 && (
          <div className="text-center space-y-6 mt-4">
            <div className="text-6xl mb-4">📸</div>
            <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md border border-blue-100">
              <h3 className="text-xl font-bold text-blue-900 mb-3">
                Sistema de Catalogación Automática
              </h3>
              <p className="text-gray-700 mb-4">
                Fotografíe el objeto del patrimonio parroquial. El sistema generará automáticamente 
                una ficha técnica completa que podrá revisar, editar y guardar con su imagen en la base de datos.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {CATEGORIAS_RAPIDAS.map((cat, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center"
                  >
                    <div className="text-3xl mb-1">{cat.emoji}</div>
                    <p className="font-semibold text-blue-900 text-xs">{cat.label}</p>
                    <p className="text-xs text-gray-600 mt-1">{cat.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversación */}
        {conversacion.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-lg shadow-md ${
                msg.tipo === 'usuario'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-none'
                  : msg.tipo === 'sistema'
                  ? 'bg-yellow-50 text-yellow-800 border-l-4 border-yellow-600 rounded-bl-none'
                  : 'bg-white text-gray-800 rounded-bl-none border-l-4 border-amber-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">
                  {msg.tipo === 'usuario' ? '📋' : msg.tipo === 'sistema' ? '⚙️' : '🏛️'}
                </span>
                <div className="flex-1">
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.texto}</p>
                  {msg.catalogacion && renderCatalogacion(msg.catalogacion, msg.mensajeId)}
                  <p className={`text-xs mt-2 ${
                    msg.tipo === 'usuario' ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    {msg.timestamp.toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Cargando */}
        {cargando && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-amber-600">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏛️</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Analizando objeto con IA especializada</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={mensajesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </p>
        </div>
      )}

      {/* Preview de imagen */}
      {previewImagen && (
        <div className="px-5 py-3 bg-blue-50 border-t border-blue-200">
          <div className="flex items-center gap-3">
            <img 
              src={previewImagen} 
              alt="Preview" 
              className="w-20 h-20 object-cover rounded border-2 border-blue-300"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">{imagenSeleccionada?.name}</p>
              <p className="text-xs text-blue-700">
                {(imagenSeleccionada!.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={limpiarImagen}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              ✕ Quitar
            </button>
          </div>
        </div>
      )}

      {/* ÁREA DE ENTRADA */}
      <div className="border-t-2 border-blue-100 p-5 bg-white">
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={manejarSeleccionImagen}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={cargando}
            className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg font-semibold hover:from-amber-700 hover:to-amber-800 disabled:from-gray-300 disabled:to-gray-400 flex items-center gap-2 shadow-md"
          >
            📸 Subir Foto
          </button>
          
          <input
            type="text"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            onKeyDown={manejarKeyPress}
            placeholder="Descripción adicional del objeto (opcional)..."
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800"
            disabled={cargando}
          />
          
          <button
            onClick={analizarObjeto}
            disabled={cargando || (!mensaje.trim() && !imagenSeleccionada)}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 flex items-center gap-2 shadow-md"
          >
            {cargando ? '⏳' : '🔍'} 
            <span>{cargando ? 'Analizando' : 'Analizar'}</span>
          </button>
        </div>
        
        <p className="text-xs text-gray-500 mt-3 text-center">
          💡 Suba una fotografía clara → La imagen se guardará en Supabase junto con la catalogación
        </p>
      </div>

      {/* FOOTER */}
      <div className="bg-gradient-to-r from-slate-100 to-blue-50 px-5 py-3 border-t">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>📊 <strong>1,247</strong> objetos catalogados</span>
            <span>✅ Plan: <strong className="text-green-600">FREE</strong></span>
          </div>
          <div className="flex items-center gap-4">
            <span>🤖 IA + 📸 Storage</span>
            <span>🔒 Datos protegidos</span>
          </div>
        </div>
      </div>
    </div>
  )
}