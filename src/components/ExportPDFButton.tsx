"use client"
import { useEffect, useState } from 'react'
import type { CatalogacionCompleta } from '@/lib/supabase'
import { obtenerUrlPublica } from '@/lib/supabase'
import { getCurrentUser, getSupabaseBrowser } from '@/lib/auth'

type Props = { data?: CatalogacionCompleta }

export default function ExportPDFButton({ data }: Props) {
  const [catalogadoPor, setCatalogadoPor] = useState<string>('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const user = await getCurrentUser()
        if (!user) {
          if (mounted) setCatalogadoPor('—')
          return
        }
        const metaObj = user.user_metadata as Record<string, unknown>
        const metaName = typeof metaObj['full_name'] === 'string' ? (metaObj['full_name'] as string) : undefined
        const fallback = metaName || user.email || '—'
        const sb = getSupabaseBrowser()
        if (!sb) {
          if (mounted) setCatalogadoPor(fallback)
          return
        }
        const { data: profileData, error } = await sb
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .limit(1)
        if (error) {
          if (mounted) setCatalogadoPor(fallback)
          return
        }
        const fullName = profileData && profileData[0]?.full_name
        if (mounted) setCatalogadoPor(fullName || fallback)
      } catch {
        if (mounted) setCatalogadoPor('—')
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleExport = () => {
    const fecha = new Date().toLocaleDateString('es-ES')
    const logoUrl = `${window.location.origin}/guadix.svg`
    const img1Url = (() => {
      if (!data) return null
      if (data.image_url && data.image_url.trim()) return data.image_url
      if (data.image_path && data.image_path.trim()) return obtenerUrlPublica(data.image_path)
      const first = Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : null
      if (first?.url && String(first.url).trim()) return String(first.url)
      if (first?.path && String(first.path).trim()) return obtenerUrlPublica(String(first.path))
      return null
    })()
    const img2Url = (() => {
      if (!data) return null
      const arr = Array.isArray(data.images) ? data.images : []
      const second = arr.length > 1 ? arr[1] : null
      if (second?.url && String(second.url).trim()) return String(second.url)
      if (second?.path && String(second.path).trim()) return obtenerUrlPublica(String(second.path))
      return null
    })()

    const safe = (v?: string) => (v && String(v).trim()) || '—'
    const materiales = (data?.materiales || []).join(', ')
    const tecnicas = (data?.tecnicas || []).join(', ')
    

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
          .content { padding: 14mm; transform-origin: top left; }
          .top { display:flex; align-items:center; justify-content:flex-start; gap: 6mm; margin-bottom: 6mm; }
          .logo { height: 14mm; }
          .header-copy { display:flex; flex-direction:column; }
          .header-copy .title { font-size: 13px; font-weight: 700; margin: 0; letter-spacing: 0.02em; }
          .header-copy .subtitle { font-size: 11px; color:#475569; margin-top: 1mm; }
          .grid { display:grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto 1fr; gap: 6mm; }
          .cell { border: 1px solid #e2e8f0; border-radius: 6px; padding: 4mm; min-height: 50mm; }
          .image-main { width: 100%; height: 88mm; border: 1px solid #e2e8f0; border-radius: 6px; object-fit: contain; }
          .image-secondary { width: 100%; height: 60mm; border: 1px solid #e2e8f0; border-radius: 6px; object-fit: contain; margin-top: 4mm; }
          .section-title { font-size: 12px; font-weight: 700; margin: 0 0 4mm; letter-spacing: 0.02em; }
          .field { margin-bottom: 3mm; }
          .label { font-weight: 600; color: #334155; font-size: 10.5px; }
          .value { font-size: 11px; color: #0f172a; text-align: justify; line-height: 1.35; }
          .two-col { display:grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
          .footer { margin-top: 6mm; display:flex; justify-content: space-between; font-size: 10px; color:#475569; }
          .muted { color: #475569; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="content">
            <div class="top">
              <img src="${logoUrl}" alt="Diócesis de Guadix" class="logo" />
              <div class="header-copy">
                <div class="title">FICHA DE INVENTARIO DE BIENES MUEBLES</div>
                <div class="subtitle">${safe(data?.parish_name)}</div>
              </div>
            </div>

            <div class="grid">
              <!-- Fila 1: Imagen principal y Datos de identificación -->
              <div class="cell">
                ${img1Url ? `<img id="img1" class="image-main" src="${img1Url}" alt="Imagen principal" />` : `<div class="muted">Sin imagen</div>`}
              </div>
              <div class="cell">
                <h3 class="section-title">DATOS DE IDENTIFICACIÓN</h3>
                <div class="field"><div class="label">TÍTULO O TEMA</div><div class="value">${safe(data?.name || data?.descripcion_breve || data?.tipo_objeto)}</div></div>
                <div class="two-col">
                  <div class="field"><div class="label">CLAVE DE INVENTARIO</div><div class="value">${safe(data?.inventory_number)}</div></div>
                  <div class="field"><div class="label">TIPO DE OBJETO</div><div class="value">${safe(data?.tipo_objeto)}</div></div>
                  <div class="field"><div class="label">AUTOR</div><div class="value">${safe(data?.author || data?.autor)}</div></div>
                  <div class="field"><div class="label">ÉPOCA O PERIODO</div><div class="value">${safe(data?.datacion_aproximada || data?.siglos_estimados)}</div></div>
                </div>
              </div>

              <!-- Fila 2: Datos técnicos y Datos de control + Imagen secundaria -->
              <div class="cell">
                <h3 class="section-title">DATOS TÉCNICOS Y MATERIALES</h3>
                <div class="two-col">
                  <div class="field"><div class="label">MEDIDAS</div><div class="value">${safe(data?.dimensiones_estimadas)}</div></div>
                  <div class="field"><div class="label">MATERIALES</div><div class="value">${materiales || '—'}</div></div>
                  <div class="field"><div class="label">TÉCNICA</div><div class="value">${tecnicas || '—'}</div></div>
                </div>
                <div class="field"><div class="label">DESCRIPCIÓN FORMAL</div><div class="value">${safe(data?.descripcion_detallada)}</div></div>
                <div class="field"><div class="label">OBSERVACIONES Y ESTADO DE CONSERVACIÓN</div><div class="value">${[safe(data?.observaciones), safe(data?.estado_conservacion)].filter(s=>s && s !== '—').join(' · ') || '—'}</div></div>
              </div>
              <div class="cell">
                <h3 class="section-title">DATOS DE CONTROL</h3>
                <div class="field"><div class="label">LOCALIZACIÓN ACTUAL</div><div class="value">${safe(data?.location || data?.localizacion_actual)}</div></div>
                <div class="two-col">
                  <div class="field"><div class="label">PARROQUIA</div><div class="value">${safe(data?.parish_name)}</div></div>
                  <div class="field"><div class="label">FECHA FICHA</div><div class="value">${safe(data?.published_at) || fecha}</div></div>
                </div>
                <div class="field"><div class="label">CATALOGADO POR</div><div class="value">${safe(catalogadoPor)}</div></div>
                ${img2Url ? `<img id="img2" class="image-secondary" src="${img2Url}" alt="Imagen secundaria" />` : ''}
              </div>
            </div>

            <div class="footer muted">
              <div>Exportado: ${fecha}</div>
              <div>Estado: ${safe(data?.status)}</div>
            </div>
          </div>
        </div>

        <script>
          (function(){
            function doPrint(){
              window.print();
              setTimeout(() => window.close(), 200);
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
            var img1 = document.getElementById('img1');
            var img2 = document.getElementById('img2');
            var needWait = ${img1Url ? 'true' : 'false'} || ${img2Url ? 'true' : 'false'};
            if ((img1 || img2) && needWait) {
              if ((img1 && img1.complete) && (!img2 || img2.complete)) {
                fitToPageAndPrint();
              } else {
                if (img1) { img1.onload = fitToPageAndPrint; img1.onerror = fitToPageAndPrint; }
                if (img2) { img2.onload = fitToPageAndPrint; img2.onerror = fitToPageAndPrint; }
                setTimeout(fitToPageAndPrint, 2000);
              }
            } else {
              if (document.readyState === 'complete') fitToPageAndPrint();
              else window.onload = fitToPageAndPrint;
            }
          })();
        </script>
      </body>
      </html>
    `

    const w = window.open('', 'PRINT', 'height=842,width=595')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm no-print"
      aria-label="Exportar a PDF"
    >
      ⬇️ Exportar PDF
    </button>
  )
}