'use client'
/* eslint-disable @next/next/no-img-element */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { enviarMensajeDify, enviarImagenDifyConInputArchivo, prepararImagen } from '@/lib/dify'
import { guardarConversacion, guardarCatalogacion } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getCurrentUser, onAuthStateChange } from '@/lib/auth'
import Link from 'next/link'
import { GUADIX_PARISHES } from '@/data/guadixParishes'

// Importar iconos profesionales de Lucide
import { 
  Database, 
  Upload, 
  ScanSearch, 
  Loader2, 
  AlertTriangle, 
  X, 
  Edit, 
  Save,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  FileText
} from 'lucide-react'

// --- Definición de Interfaces (sin cambios) ---
interface Mensaje {
  tipo: 'usuario' | 'ia' | 'sistema'
  texto: string
  timestamp: Date
  catalogacion?: CatalogacionIA
  mensajeId?: string
  imagenOriginal?: File
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
  // nuevos campos para ficha completa
  inventory_number?: string
  location?: string
  parish_id?: string
}

// Categorías rápidas (con iconos personalizados)
const CATEGORIAS_RAPIDAS = [
  { image: '/icons/chalice.svg', label: 'Orfebrería', descripcion: 'Cáliz, custodia, copón...' },
  { image: '/icons/chasuble.svg', label: 'Ornamentos', descripcion: 'Casulla, estola, paño...' },
  { image: '/icons/crucifix.svg', label: 'Imaginería', descripcion: 'Imágenes, retablos...' },
  { image: '/icons/book.svg', label: 'Documentos', descripcion: 'Libros, pergaminos, actas...' },
]

// Componentes de ficha movidos a nivel superior para estabilidad de foco

const Seccion = React.memo(function Seccion({ 
  titulo, 
  visible, 
  toggle, 
  children 
}: { 
  titulo: string; 
  visible: boolean; 
  toggle: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div 
        className="flex items-center justify-between bg-slate-100 p-2 rounded-t-md cursor-pointer"
        onClick={toggle}
      >
        <h3 className="font-semibold text-slate-800 text-sm">{titulo}</h3>
        <button className="text-slate-600 hover:text-slate-800">
          {visible ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      
      {visible && (
        <div className="bg-white p-3 rounded-b-md border border-slate-200 grid grid-cols-2 gap-4">
          {children}
        </div>
      )}
    </div>
  );
});
Seccion.displayName = 'Seccion'

const CampoFicha = React.memo(function CampoFicha({ 
  etiqueta, 
  valor, 
  campo, 
  editando, 
  tipo = 'input',
  opcionesSelect,
  actualizarCampo,
  actualizarArray
}: {
  etiqueta: string;
  valor: string | string[];
  campo: keyof CatalogacionIA | 'materiales' | 'tecnicas' | 'deterioros_visibles';
  editando: boolean;
  tipo?: 'input' | 'textarea' | 'select' | 'array';
  opcionesSelect?: string[];
  actualizarCampo: (campo: keyof CatalogacionIA, valor: string) => void;
  actualizarArray: (campo: 'materiales' | 'tecnicas' | 'deterioros_visibles', valor: string) => void;
}) {
  const valorArray = Array.isArray(valor) ? valor.join(', ') : valor;
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (tipo === 'array') {
      actualizarArray(campo as 'materiales' | 'tecnicas' | 'deterioros_visibles', e.target.value);
    } else {
      actualizarCampo(campo as keyof CatalogacionIA, e.target.value);
    }
  }, [campo, tipo, actualizarCampo, actualizarArray]);
  
  return (
    <div className={tipo === 'textarea' ? 'col-span-2' : ''}>
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {etiqueta}
      </label>
      {!editando ? (
        <p className="text-slate-900 bg-slate-50 px-3 py-2 rounded-md min-h-[40px] whitespace-pre-wrap">
          {valorArray || <span className="text-slate-400 italic">No disponible</span>}
        </p>
      ) : (
        <>
          {tipo === 'textarea' && (
            <textarea
              value={valorArray}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              rows={4}
            />
          )}
          {tipo === 'input' && (
            <input
              type="text"
              value={valorArray}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          )}
          {tipo === 'array' && (
            <input
              type="text"
              value={valorArray}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Valores separados por comas"
            />
          )}
          {tipo === 'select' && (
            <select
              value={valorArray}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {opcionesSelect?.map(opt => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  );
});
CampoFicha.displayName = 'CampoFicha'

type FichaInventarioProps = {
  cat: CatalogacionIA;
  mensajeId?: string;
  estaEditando: boolean;
  catalogacionEditada: CatalogacionIA | null;
  guardando: boolean;
  iniciarEdicion: (mensajeId: string, cat: CatalogacionIA) => void;
  guardarEdicion: (mensajeId: string) => void;
  cancelarEdicion: () => void;
  aprobarCatalogacion: (cat: CatalogacionIA, mensajeId?: string) => void | Promise<void>;
  actualizarCampo: (campo: keyof CatalogacionIA, valor: string) => void;
  actualizarArray: (campo: 'materiales' | 'tecnicas' | 'deterioros_visibles', valor: string) => void;
  imagenOriginal?: File;
};

const FichaInventario = React.memo(function FichaInventario({
  cat,
  mensajeId,
  estaEditando,
  catalogacionEditada,
  guardando,
  iniciarEdicion,
  guardarEdicion,
  cancelarEdicion,
  aprobarCatalogacion,
  actualizarCampo,
  actualizarArray,
  imagenOriginal
}: FichaInventarioProps) {
  const [seccionVisible, setSeccionVisible] = useState({
    identificacion: true,
    tecnica: false,
    descripcion: false,
    conservacion: false
  });
  
  const datos = estaEditando ? catalogacionEditada || cat : cat;
  
  const toggleSeccion = (seccion: keyof typeof seccionVisible) => {
    setSeccionVisible(prev => ({
      ...prev,
      [seccion]: !prev[seccion]
    }));
  };

  // Selector de parroquia (desplegable con búsqueda y fallback Guadix)
  type ParishOption = { id: string; name: string; location?: string }
  const [parishOptions, setParishOptions] = useState<ParishOption[]>([])
  const [parishSelection, setParishSelection] = useState<string>('')
  const [parishSearch, setParishSearch] = useState<string>('')
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
  const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const mergeParishes = useCallback((api: ParishOption[], fallback: { name: string; location?: string }[]): ParishOption[] => {
    const byKey = new Map<string, ParishOption>()
    for (const p of api) {
      const key = normalize(`${p.name}|${p.location || ''}`)
      byKey.set(key, { id: p.id || `${p.name}|${p.location || ''}`, name: p.name, location: p.location })
    }
    for (const f of fallback) {
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
    const init = datos?.parish_id || ''
    if (isUuid(init)) {
      setParishSelection(init)
      setParishSearch('')
    } else if (init) {
      setParishSelection('')
      setParishSearch(init)
    } else {
      setParishSelection('')
      setParishSearch('')
    }
  }, [estaEditando, datos?.parish_id])
  useEffect(() => {
    const loadParishes = async () => {
      try {
        const res = await fetch('/api/parishes/list?diocese=Guadix')
        const js = await res.json()
        const apiRows: ParishOption[] = res.ok && js?.ok ? (js.parishes || []) : []
        setParishOptions(mergeParishes(apiRows, GUADIX_PARISHES))
      } catch {
        setParishOptions(mergeParishes([], GUADIX_PARISHES))
      }
    }
    if (estaEditando) loadParishes()
  }, [estaEditando, mergeParishes])
  useEffect(() => {
    const term = normalize(parishSearch)
    if (!term) return
    const found = parishOptions.find(opt => normalize(opt.name).includes(term) || normalize(opt.location || '').includes(term))
    if (found) setParishSelection(found.id)
  }, [parishSearch, parishOptions])

  const exportarPDF = () => {
    const fecha = new Date().toLocaleDateString('es-ES');
    const imgUrl = imagenOriginal ? URL.createObjectURL(imagenOriginal) : null;
    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Ficha de Inventario</title>
        <style>
          * { box-sizing: border-box; }
          html, body { width: 210mm; height: 297mm; }
          body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color: #0f172a; }
          .page { width: 210mm; height: 297mm; background: #fff; overflow: hidden; }
          .content { padding: 16mm; transform-origin: top left; }
          .header { display:flex; gap:20px; align-items:flex-start; justify-content:space-between; margin-bottom: 10mm; }
          .header-left { flex:1; }
          .title { font-size: 18px; font-weight: 700; margin: 0 0 4mm; }
          .subtitle { font-size: 11px; color: #334155; margin: 0; }
          .image { width: 70mm; height: auto; max-height: 90mm; border: 1px solid #e2e8f0; border-radius: 6px; object-fit: contain; }
          .section { margin-bottom: 6mm; page-break-inside: avoid; }
          .section h3 { font-size: 13px; color:#1f2937; margin: 0 0 3mm; }
          .row { display:grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
          .field { margin-bottom: 3mm; }
          .label { font-weight: 600; color: #334155; font-size: 10.5px; }
          .value { margin-top: 2px; font-size: 10.5px; white-space: pre-wrap; color: #0f172a; }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; color:#475569; font-size: 10px; }
          @page { size: A4 portrait; margin: 0; }
          @media print {
            .page { width: 210mm; height: 297mm; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="content">
            <div class="header">
              <div class="header-left">
                <h1 class="title">Ficha de Inventario: ${datos.tipo_objeto || ''}</h1>
                <p class="subtitle">Parroquia de Santa María de Huéscar – Fecha: ${fecha}</p>
              </div>
              ${imgUrl ? `<img id="ficha-image" class="image" src="${imgUrl}" alt="Imagen del objeto" />` : ''}
            </div>

            <div class="section">
              <h3>Datos de Identificación</h3>
              <div class="row">
                <div class="field"><div class="label">Título / Descripción breve</div><div class="value">${datos.descripcion_breve || ''}</div></div>
                <div class="field"><div class="label">Tipo de objeto</div><div class="value">${datos.tipo_objeto || ''}</div></div>
                <div class="field"><div class="label">Categoría</div><div class="value">${datos.categoria || ''}</div></div>
                <div class="field"><div class="label">Datación aproximada</div><div class="value">${datos.datacion_aproximada || ''}</div></div>
                <div class="field"><div class="label">Siglos estimados</div><div class="value">${datos.siglos_estimados || ''}</div></div>
                <div class="field"><div class="label">Estilo artístico</div><div class="value">${datos.estilo_artistico || ''}</div></div>
              </div>
            </div>

            <div class="section">
              <h3>Datos Técnicos y Materiales</h3>
              <div class="row">
                <div class="field"><div class="label">Materiales</div><div class="value">${(datos.materiales || []).join(', ')}</div></div>
                <div class="field"><div class="label">Técnicas</div><div class="value">${(datos.tecnicas || []).join(', ')}</div></div>
                <div class="field"><div class="label">Dimensiones estimadas</div><div class="value">${datos.dimensiones_estimadas || ''}</div></div>
              </div>
            </div>

            <div class="section">
              <h3>Descripción Formal e Iconografía</h3>
              <div class="field"><div class="label">Descripción detallada</div><div class="value">${datos.descripcion_detallada || ''}</div></div>
              <div class="field"><div class="label">Iconografía</div><div class="value">${datos.iconografia || ''}</div></div>
            </div>

            <div class="section">
              <h3>Conservación y Observaciones</h3>
              <div class="row">
                <div class="field"><div class="label">Estado de conservación</div><div class="value">${datos.estado_conservacion || ''}</div></div>
                <div class="field"><div class="label">Deterioros visibles</div><div class="value">${(datos.deterioros_visibles || []).join(', ')}</div></div>
                <div class="field"><div class="label">Valor artístico</div><div class="value">${datos.valor_artistico || ''}</div></div>
                <div class="field"><div class="label">Confianza del análisis</div><div class="value">${datos.confianza_analisis || ''}</div></div>
              </div>
              <div class="field"><div class="label">Observaciones</div><div class="value">${datos.observaciones || ''}</div></div>
            </div>

            <p class="mono">Documento generado automáticamente.</p>
          </div>
        </div>
        <script>
          (function(){
            var u = ${imgUrl ? '`' + imgUrl + '`' : 'null'};
            function doPrint(){
              try { window.print(); } catch(e) {}
              setTimeout(function(){
                if (u && window.URL && URL.revokeObjectURL) {
                  try { URL.revokeObjectURL(u); } catch (e) {}
                }
                window.close();
              }, 500);
            }
            function fitToPageAndPrint(){
              try {
                var page = document.querySelector('.page');
                var content = document.querySelector('.content');
                var pageH = page ? page.clientHeight : 0;
                var contentH = content ? content.scrollHeight : 0;
                if (page && content && contentH > pageH) {
                  var scale = pageH / contentH;
                  content.style.transform = 'scale(' + scale + ')';
                }
              } catch(e) {}
              doPrint();
            }
            var img = document.getElementById('ficha-image');
            if (img && u) {
              if (img.complete) {
                fitToPageAndPrint();
              } else {
                img.onload = fitToPageAndPrint;
                img.onerror = fitToPageAndPrint; // imprime aunque falle la carga
                setTimeout(fitToPageAndPrint, 2000); // Fallback
              }
            } else {
              if (document.readyState === 'complete') fitToPageAndPrint();
              else window.onload = fitToPageAndPrint;
            }
          })();
        </script>
      </body>
      </html>`;

    const w = window.open('', 'PRINT', 'height=842,width=595');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  };
  return (
    <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-slate-50 p-3 flex justify-between items-center">
        <h3 className="font-semibold text-slate-800">
          Ficha de Inventario: {cat.tipo_objeto}
        </h3>
        
        <div className="flex gap-2">
          {!estaEditando ? (
            <>
              <button
                onClick={() => iniciarEdicion(mensajeId || '', cat)}
                className="p-1.5 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 flex items-center gap-1"
              >
                <Edit className="h-3.5 w-3.5" />
                <span className="text-xs">Editar</span>
              </button>
              
              <button
                onClick={() => aprobarCatalogacion(cat, mensajeId)}
                disabled={guardando}
                className="p-1.5 bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200 flex items-center gap-1 disabled:opacity-50"
              >
                {guardando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                <span className="text-xs">Aprobar</span>
              </button>

              <button
                onClick={exportarPDF}
                className="p-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="text-xs">Exportar PDF</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => guardarEdicion(mensajeId || '')}
                className="p-1.5 bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200 flex items-center gap-1"
              >
                <Save className="h-3.5 w-3.5" />
                <span className="text-xs">Guardar</span>
              </button>
              
              <button
                onClick={cancelarEdicion}
                className="p-1.5 bg-red-100 text-red-800 rounded hover:bg-red-200 flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                <span className="text-xs">Cancelar</span>
              </button>

              <button
                onClick={exportarPDF}
                className="p-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="text-xs">Exportar PDF</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="p-3">
        <Seccion titulo="Datos de Identificación" visible={seccionVisible.identificacion} toggle={() => toggleSeccion('identificacion')}>
          <CampoFicha etiqueta="Título / Descripción breve" valor={datos.descripcion_breve} campo="descripcion_breve" editando={estaEditando} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Tipo de objeto" valor={datos.tipo_objeto} campo="tipo_objeto" editando={estaEditando} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Categoría" valor={datos.categoria} campo="categoria" editando={estaEditando} tipo="select" opcionesSelect={["pintura","escultura","talla","orfebreria","ornamentos","telas","mobiliario","documentos","otros"]} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Número de inventario" valor={datos.inventory_number || ''} campo={"inventory_number" as keyof CatalogacionIA} editando={estaEditando} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Localización" valor={datos.location || ''} campo={"location" as keyof CatalogacionIA} editando={estaEditando} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <div className="">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Parroquia</label>
            {!estaEditando ? (
              <p className="text-slate-900 bg-slate-50 px-3 py-2 rounded-md min-h-[40px] whitespace-pre-wrap">
                {datos.parish_id || ''}
              </p>
            ) : (
              <>
                <input
                  type="text"
                  value={parishSearch}
                  onChange={(e) => setParishSearch(e.target.value)}
                  placeholder="Buscar por nombre o municipio (Guadix)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <select
                  value={parishSelection}
                  onChange={(e) => {
                    const val = e.target.value
                    setParishSelection(val)
                    const selected = parishOptions.find(o => o.id === val)
                    if (selected) {
                      if (isUuid(selected.id)) {
                        actualizarCampo('parish_id', selected.id)
                      } else {
                        actualizarCampo('parish_id', selected.name)
                      }
                    }
                  }}
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="">Selecciona parroquia (Guadix)</option>
                  {parishOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}{opt.location ? ` — ${opt.location}` : ''}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          <CampoFicha etiqueta="Datación aproximada" valor={datos.datacion_aproximada} campo="datacion_aproximada" editando={estaEditando} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Siglos estimados" valor={datos.siglos_estimados} campo="siglos_estimados" editando={estaEditando} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Estilo artístico" valor={datos.estilo_artistico} campo="estilo_artistico" editando={estaEditando} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
        </Seccion>
        
        <Seccion titulo="Datos Técnicos y Materiales" visible={seccionVisible.tecnica} toggle={() => toggleSeccion('tecnica')}>
          <CampoFicha etiqueta="Materiales" valor={datos.materiales} campo="materiales" editando={estaEditando} tipo="array" actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Técnicas" valor={datos.tecnicas} campo="tecnicas" editando={estaEditando} tipo="array" actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Dimensiones estimadas" valor={datos.dimensiones_estimadas} campo="dimensiones_estimadas" editando={estaEditando} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
        </Seccion>
        
        <Seccion titulo="Descripción Formal e Iconografía" visible={seccionVisible.descripcion} toggle={() => toggleSeccion('descripcion')}>
          <CampoFicha etiqueta="Descripción detallada" valor={datos.descripcion_detallada} campo="descripcion_detallada" editando={estaEditando} tipo="textarea" actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Iconografía" valor={datos.iconografia} campo="iconografia" editando={estaEditando} tipo="textarea" actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
        </Seccion>
        
        <Seccion titulo="Conservación y Observaciones" visible={seccionVisible.conservacion} toggle={() => toggleSeccion('conservacion')}>
          <CampoFicha etiqueta="Estado de conservación" valor={datos.estado_conservacion} campo="estado_conservacion" editando={estaEditando} tipo="select" opcionesSelect={["excelente", "bueno", "regular", "deficiente", "crítico"]} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Deterioros visibles" valor={datos.deterioros_visibles} campo="deterioros_visibles" editando={estaEditando} tipo="array" actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Valor artístico" valor={datos.valor_artistico} campo="valor_artistico" editando={estaEditando} tipo="select" opcionesSelect={["muy_alto", "alto", "medio", "regular", "bajo"]} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Confianza del análisis" valor={datos.confianza_analisis} campo="confianza_analisis" editando={false} actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
          <CampoFicha etiqueta="Observaciones" valor={datos.observaciones} campo="observaciones" editando={estaEditando} tipo="textarea" actualizarCampo={actualizarCampo} actualizarArray={actualizarArray} />
        </Seccion>
      </div>
    </div>
  );
});
FichaInventario.displayName = 'FichaInventario'

// --- Componente Principal ---
export default function ChatInterface() {
  const [mensaje, setMensaje] = useState('')
  const [conversacion, setConversacion] = useState<Mensaje[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagenSeleccionada, setImagenSeleccionada] = useState<File | null>(null)
  const [previewImagen, setPreviewImagen] = useState<string | null>(null)
  
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [catalogacionEditada, setCatalogacionEditada] = useState<CatalogacionIA | null>(null)
  
  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [usuario, setUsuario] = useState<{ id: string; email?: string | null } | null>(null)

  // Helper: detectar UUID
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

  // Generador client-side básico para número de inventario
  const generarNumeroInventario = useCallback((parishId: string, categoria: string) => {
    const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const stop = new Set(['de','del','la','el','y','los','las'])
    const parishPrefix = (name: string) => {
      const words = normalize(name).trim().split(/\s+/).filter(w => w && !stop.has(w))
      if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase()
      if (words.length === 2) return (words[0][0] + words[1][0] + (words[1][1] || 'x')).toUpperCase().slice(0,3)
      const compact = normalize(name).replace(/\s+/g, '')
      return compact.slice(0,3).toUpperCase()
    }
    const catPrefix = (c: string) => (normalize(c).replace(/\s+/g,'').slice(0,3) || 'UNK').toUpperCase()
    const year = new Date().getFullYear()
    const parishPfx = isUuid(parishId) ? 'UNK' : parishPrefix(parishId)
    const cat3 = catPrefix(categoria || '')
    return `${parishPfx}-${year}-${cat3}-001`
  }, [])

  // Autorellenar inventory_number cuando hay parish_id y campo vacío
  useEffect(() => {
    const doGen = async () => {
      if (editandoId && catalogacionEditada && catalogacionEditada.parish_id && !catalogacionEditada.inventory_number) {
        try {
          const res = await fetch('/api/inventory-number/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parish_id: catalogacionEditada.parish_id, parish_name: !isUuid(catalogacionEditada.parish_id) ? catalogacionEditada.parish_id : undefined, categoria: catalogacionEditada.categoria || '' })
          })
          if (res.ok) {
            const js = await res.json()
            if (js.inventory_number) {
              setCatalogacionEditada(prev => prev ? { ...prev, inventory_number: js.inventory_number } : prev)
              return
            }
          }
          // Fallback si el endpoint falla o no devuelve número
          const generado = generarNumeroInventario(catalogacionEditada.parish_id, catalogacionEditada.categoria || '')
          setCatalogacionEditada(prev => prev ? { ...prev, inventory_number: generado } : prev)
        } catch {
          const generado = generarNumeroInventario(catalogacionEditada.parish_id, catalogacionEditada.categoria || '')
          setCatalogacionEditada(prev => prev ? { ...prev, inventory_number: generado } : prev)
        }
      }
    }
    doGen()
  }, [editandoId, catalogacionEditada, generarNumeroInventario])

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversacion])

  useEffect(() => {
    // Cargar usuario actual e inscribirse a cambios de sesión
    (async () => {
      const u = await getCurrentUser()
      setUsuario(u ? { id: u.id, email: u.email } : null)
    })()
    const unsubscribe = onAuthStateChange((_event, session) => {
      setUsuario(session?.user ? { id: session.user.id, email: session.user.email } : null)
    })
    return () => unsubscribe()
  }, [])

  const manejarSeleccionImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // Límite de 10MB (consistente con Dify)
        setError('La imagen es demasiado grande. Máximo: 10MB')
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
      ? `Imagen adjunta: ${imagenSeleccionada.name}\n${mensaje || 'Analizar objeto en la fotografía'}`
      : mensaje

    const mensajeId = Date.now().toString()
    const imagenOriginalRef = imagenSeleccionada

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

      // Pre-chequeo: requiere login si hay imagen (para subida a Supabase)
      if (imagenSeleccionada) {
        const u = await getCurrentUser()
        if (!u) {
          setError('Debes iniciar sesión para subir imágenes. Redirigiendo a /auth...')
          const aviso: Mensaje = {
            tipo: 'sistema',
            texto: 'Acceso requerido: inicia sesión para guardar imágenes en el inventario.',
            timestamp: new Date()
          }
          setConversacion(prev => [...prev, aviso])
          router.push('/auth?from=chat&reason=login-required')
          return
        }
      }
      
      let respuesta: { exito: boolean; respuesta?: string; conversationId?: string; error?: string; authWarning?: boolean }
      if (imagenSeleccionada) {
        const mensajeSistema: Mensaje = {
          tipo: 'sistema',
          texto: 'Preparando imagen para análisis...',
          timestamp: new Date()
        }
        setConversacion(prev => [...prev, mensajeSistema])
        
        const imagenPreparada = await prepararImagen(imagenSeleccionada)
        
        if (imagenPreparada.size !== imagenSeleccionada.size) {
          const mensajeCompresion: Mensaje = {
            tipo: 'sistema',
            texto: `Imagen optimizada: ${(imagenSeleccionada.size / 1024).toFixed(1)}KB → ${(imagenPreparada.size / 1024).toFixed(1)}KB`,
            timestamp: new Date()
          }
          setConversacion(prev => [...prev, mensajeCompresion])
        }
        
        respuesta = await enviarImagenDifyConInputArchivo(mensajeParaEnviar, imagenPreparada, userId)
      } else {
        respuesta = await enviarMensajeDify(mensajeParaEnviar, userId)
      }

      if (respuesta.exito && respuesta.respuesta) {
        // Si hubo advertencia de autenticación (Supabase 401), avisar y redirigir opcionalmente
        if (respuesta.authWarning) {
          setError('La imagen no se guardó en Supabase por falta de login. Inicia sesión para guardar tus imágenes.')
          const avisoAuth: Mensaje = {
            tipo: 'sistema',
            texto: 'Aviso: inicia sesión para poder guardar la imagen en el inventario.',
            timestamp: new Date()
          }
          setConversacion(prev => [...prev, avisoAuth])
          // Redirección automática a /auth
          setTimeout(() => router.push('/auth?from=chat&reason=login-required'), 600)
        }

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

        guardarConversacion(userId, mensajeParaEnviar, respuesta.respuesta)
          .catch((err: unknown) => console.error('Error al guardar:', err))
        
      } else {
        throw new Error(respuesta.error || 'Error desconocido')
      }
      
    } catch (err: unknown) {
      const mensajeError = err instanceof Error ? err.message : 'Error desconocido'
      setError(mensajeError)
      const nuevoMensajeError: Mensaje = {
        tipo: 'sistema',
        texto: 'Error al analizar el objeto. Por favor, intente nuevamente.',
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

  const actualizarCampo = useCallback(<K extends keyof CatalogacionIA>(campo: K, valor: CatalogacionIA[K]) => {
    if (!catalogacionEditada) return
    setCatalogacionEditada(prev => prev ? { ...prev, [campo]: valor } : null)
  }, [catalogacionEditada])

  const actualizarArray = useCallback((campo: 'materiales' | 'tecnicas' | 'deterioros_visibles', texto: string) => {
    if (!catalogacionEditada) return
    const valores = texto.split(',').map(v => v.trim()).filter(v => v)
    setCatalogacionEditada(prev => prev ? { ...prev, [campo]: valores } : null)
  }, [catalogacionEditada])

  const aprobarCatalogacion = async (cat: CatalogacionIA, mensajeId?: string) => {
    setGuardando(true)
    try {
      const mensajeConImagen = conversacion.find(m => 
        m.mensajeId === mensajeId || m.mensajeId === mensajeId?.replace('ia-', '')
      )
      const userId = 'usuario-huescar-catalogacion'
      const resultado = await guardarCatalogacion(
        { user_id: userId, ...cat },
        mensajeConImagen?.imagenOriginal
      )

      if (resultado) {
        const mensajeExito: Mensaje = {
          tipo: 'sistema',
          texto: 'Catalogación guardada correctamente en la base de datos.',
          timestamp: new Date()
        }
        setConversacion(prev => [...prev, mensajeExito])
      } else {
        throw new Error('No se pudo guardar')
      }
    } catch (error: unknown) {
      console.error('Error al guardar:', error)
      const mensajeError: Mensaje = {
        tipo: 'sistema',
        texto: 'Error al guardar la catalogación. Por favor, intente nuevamente.',
        timestamp: new Date()
      }
      setConversacion(prev => [...prev, mensajeError])
    } finally {
      setGuardando(false)
    }
  }


  // --- NUEVA FUNCIÓN: RENDERIZAR CAMPO DE FORMULARIO ---
  // Componentes movidos a nivel superior (Seccion, CampoFicha, FichaInventario)


  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto bg-stone-100 rounded-xl shadow-2xl overflow-hidden border border-slate-300">
      
      {/* ENCABEZADO */}
      <div className="bg-slate-800 text-white p-4 border-b-4 border-amber-600">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Database className="h-7 w-7 text-amber-500" />
              <h2 className="text-xl font-serif font-semibold">
                Inventario de Bienes Muebles
              </h2>
            </div>
            <p className="text-sm text-slate-300 ml-10">
              Parroquia de Santa María de Huéscar, Diócesis de Guadix
            </p>
          </div>
          <div className="flex items-center gap-3">
            {usuario ? (
              <>
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span className="text-sm text-slate-200">Autenticado como {usuario.email || '—'}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span className="text-sm text-slate-200">No autenticado</span>
                <button
                  onClick={() => router.push('/auth?from=chat')}
                  className="px-2 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700"
                >
                  Iniciar sesión
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ÁREA DE MENSAJES */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        
        {/* Bienvenida */}
        {conversacion.length === 0 && (
          <div className="text-center space-y-6 mt-4">
            <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <Sparkles className="h-12 w-12 text-amber-600 mx-auto mb-4" />
              <h3 className="text-xl font-serif font-semibold text-slate-800 mb-3">
                Asistente de Catalogación Patrimonial
              </h3>
              <p className="text-slate-700 mb-4">
                Suba una fotografía del objeto a catalogar. La IA generará una propuesta de ficha técnica 
                que podrá revisar, editar y guardar en la base de datos.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {CATEGORIAS_RAPIDAS.map((cat, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50 rounded-lg border border-slate-200 text-center"
                  >
                    <img src={cat.image} alt={cat.label} className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800 text-xs">{cat.label}</p>
                    <p className="text-xs text-slate-600 mt-1">{cat.descripcion}</p>
                  </div>
                ))}
              </div>

              {/* Botones para ir al catálogo */}
              <div className="mt-6 flex justify-center gap-3">
                <Link href="/catalogo" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
                  Ir al catálogo
                </Link>
                <Link href="/catalogo" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
                  Abrir catálogo en nueva pestaña
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Conversación */}
        {conversacion.map((msg, index) => (
          <div
            key={msg.mensajeId ?? index}
            className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg shadow-sm ${
                msg.tipo === 'usuario'
                  ? 'bg-slate-700 text-white rounded-br-none'
                  : msg.tipo === 'sistema'
                  ? 'bg-yellow-50 text-yellow-800 border-l-4 border-yellow-500 rounded-bl-none'
                  : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 pt-0.5">
                  {msg.tipo === 'usuario' ? <FileText className="h-4 w-4" /> : 
                   msg.tipo === 'sistema' ? <AlertTriangle className="h-4 w-4" /> : 
                   <Sparkles className="h-4 w-4 text-amber-600" />}
                </span>
                <div className="flex-1">
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.texto}</p>
                  
                  {/* AQUÍ SE RENDERIZA LA NUEVA FICHA */}
                  {msg.catalogacion && (
                    <FichaInventario
                      cat={msg.catalogacion}
                      mensajeId={msg.mensajeId}
                      estaEditando={editandoId === msg.mensajeId}
                      catalogacionEditada={catalogacionEditada}
                      guardando={guardando}
                      iniciarEdicion={iniciarEdicion}
                      guardarEdicion={guardarEdicion}
                      cancelarEdicion={cancelarEdicion}
                      aprobarCatalogacion={aprobarCatalogacion}
                      actualizarCampo={actualizarCampo}
                      actualizarArray={actualizarArray}
                      imagenOriginal={msg.imagenOriginal}
                    />
                  )}
                  
                  <p className={`text-xs mt-2 ${
                    msg.tipo === 'usuario' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    {msg.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Cargando */}
        {cargando && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                <span className="text-slate-600 text-sm">Analizando objeto...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={mensajesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-red-50 border-t border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-700 font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Preview de imagen */}
      {previewImagen && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <img 
              src={previewImagen} 
              alt="Preview" 
              className="w-16 h-16 object-cover rounded border-2 border-slate-300"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{imagenSeleccionada?.name}</p>
              <p className="text-xs text-slate-600">
                {(imagenSeleccionada!.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={limpiarImagen}
              className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700"
              aria-label="Quitar imagen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ÁREA DE ENTRADA */}
      <div className="border-t-2 border-slate-200 p-4 bg-white">
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
            className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:bg-slate-300 flex items-center gap-2 shadow-sm"
          >
            <Upload className="h-5 w-5" /> Subir Foto
          </button>
          
          <input
            type="text"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            onKeyDown={manejarKeyPress}
            placeholder="Descripción adicional del objeto (opcional)..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 shadow-sm"
            disabled={cargando}
          />
          
          <button
            onClick={analizarObjeto}
            disabled={cargando || (!mensaje.trim() && !imagenSeleccionada)}
            className="px-6 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:bg-slate-300 flex items-center gap-2 shadow-sm"
          >
            {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanSearch className="h-5 w-5" />}
            <span>{cargando ? 'Analizando' : 'Analizar'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
