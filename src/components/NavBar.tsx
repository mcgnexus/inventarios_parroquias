"use client"
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function NavBar() {
  const router = useRouter()
  return (
    <div className="w-full bg-slate-50 border-b border-slate-200 no-print">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm"
          aria-label="Volver"
        >
          ← Volver
        </button>
        <Link
          href="/catalogo"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm"
          aria-label="Ir al catálogo"
        >
          📚 Catálogo
        </Link>
      </div>
    </div>
  )
}