"use client"
import type { CatalogacionCompleta } from '@/lib/supabase'
import { obtenerUrlPublica } from '@/lib/supabase'

type Props = { data?: CatalogacionCompleta }

export default function ExportPDFButton({ data }: Props) {
  const handleExport = () => {
    const fecha = new Date().toLocaleDateString('es-ES')
    const logoUrl = `${window.location.origin}/escudo-guadix.jpg`
    const imgUrl = (() => {
      if (!data) return null
      if (data.image_url && data.image_url.trim()) return data.image_url
      if (data.image_path && data.image_path.trim()) return obtenerUrlPublica(data.image_path)
      return null
    })()

    const safe = (v?: string) => (v && String(v).trim()) || '—'
    const materiales = (data?.materiales || []).join(', ')
    const tecnicas = (data?.tecnicas || []).join(', ')
    const deterioros = (data?.deterioros_visibles || []).join(', ')

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
          .logo { height: 18mm; margin-bottom: 4mm; }
          .title { font-size: 18px; font-weight: 700; margin: 0 0 4mm; }
          .subtitle { font-size: 11px; color: #334155; margin: 0; }
          .image { width: 70mm; height: auto; max-height: 90mm; border: 1px solid #e2e8f0; border-radius: 6px; object-fit: contain; }
          .section { margin-bottom: 6mm; page-break-inside: avoid; }
          .section h3 { font-size: 13px; color:#1f2937; margin: 0 0 3mm; }
          .row { display:grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
          .field { margin-bottom: 3mm; }
          .label { font-weight: 600; color: #334155; font-size: 10.5px; }
          .value { font-size: 11px; color: #0f172a; }
          .footer { position: absolute; bottom: 14mm; left: 16mm; right: 16mm; display:flex; justify-content: space-between; font-size: 10px; color:#475569; }
          .muted { color: #475569; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="content">
            <div class="header">
              <div class="header-left">
                <img src="${logoUrl}" alt="Escudo Guadix" class="logo" />
                <h1 class="title">Ficha de Inventario</h1>
                <p class="subtitle">Fecha: ${fecha}</p>
                <p class="subtitle">Parroquia: ${safe(data?.parish_name)}</p>
                <p class="subtitle">Número de inventario: ${safe(data?.inventory_number)}</p>
              </div>
              ${imgUrl ? `<img id="ficha-image" class="image" src="${imgUrl}" alt="Imagen de la pieza" />` : ''}
            </div>

            <div class="section">
              <h3>Datos principales</h3>
              <div class="row">
                <div class="field"><div class="label">Nombre</div><div class="value">${safe(data?.name || data?.descripcion_breve || data?.tipo_objeto)}</div></div>
                <div class="field"><div class="label">Autor</div><div class="value">${safe(data?.author || data?.autor)}</div></div>
                <div class="field"><div class="label">Localización</div><div class="value">${safe(data?.location || data?.localizacion_actual)}</div></div>
                <div class="field"><div class="label">Categoría</div><div class="value">${safe(data?.categoria)}</div></div>
              </div>
            </div>

            <div class="section">
              <h3>Descripción</h3>
              <div class="field"><div class="label">Tipo</div><div class="value">${safe(data?.tipo_objeto)}</div></div>
              <div class="field"><div class="label">Datación</div><div class="value">${safe(data?.datacion_aproximada || data?.siglos_estimados)}</div></div>
              <div class="field"><div class="label">Estilo</div><div class="value">${safe(data?.estilo_artistico)}</div></div>
              <div class="field"><div class="label">Descripción detallada</div><div class="value">${safe(data?.descripcion_detallada)}</div></div>
              <div class="field"><div class="label">Iconografía</div><div class="value">${safe(data?.iconografia)}</div></div>
            </div>

            <div class="section">
              <h3>Características</h3>
              <div class="row">
                <div class="field"><div class="label">Materiales</div><div class="value">${materiales || '—'}</div></div>
                <div class="field"><div class="label">Técnicas</div><div class="value">${tecnicas || '—'}</div></div>
                <div class="field"><div class="label">Dimensiones</div><div class="value">${safe(data?.dimensiones_estimadas)}</div></div>
                <div class="field"><div class="label">Estado de conservación</div><div class="value">${safe(data?.estado_conservacion)}</div></div>
                <div class="field"><div class="label">Deterioros visibles</div><div class="value">${deterioros || '—'}</div></div>
              </div>
            </div>

            <div class="section">
              <h3>Valoración</h3>
              <div class="field"><div class="label">Valor artístico</div><div class="value">${safe(data?.valor_artistico)}</div></div>
              <div class="field"><div class="label">Observaciones</div><div class="value">${safe(data?.observaciones)}</div></div>
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
            var img = document.getElementById('ficha-image');
            var u = ${imgUrl ? 'true' : 'false'};
            if (img && u) {
              if (img.complete) {
                fitToPageAndPrint();
              } else {
                img.onload = fitToPageAndPrint;
                img.onerror = fitToPageAndPrint;
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