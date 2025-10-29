"use client"
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function NavBar() {
  const router = useRouter()
  return (
    <div className="w-full bg-slate-50 border-b border-slate-200 no-print safe-area-top">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3">
        <Link href="/" className="inline-flex items-center gap-2 mr-2" aria-label="Inicio">
          <Image
            src="/guadix.svg"
            alt="Diócesis de Guadix"
            width={32}
            height={32}
            priority
            className="h-8 w-8"
          />
          <span className="text-slate-700 font-medium hidden sm:inline">Diócesis de Guadix</span>
        </Link>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm"
          aria-label="Volver"
        >
          ← Volver
        </button>
        <Link
          href="/catalogo"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm"
          aria-label="Ir al catálogo"
        >
          📚 Catálogo
        </Link>
      </div>
    </div>
  )
}