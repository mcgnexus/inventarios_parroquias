"use client"

export default function ExportPDFButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm no-print"
      aria-label="Exportar a PDF"
    >
      ⬇️ Exportar PDF
    </button>
  )
}