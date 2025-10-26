"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteCatalogItemButton({ id, name }: { id: string; name?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const onDelete = async () => {
    setError(null)
    const label = name && name.trim() ? `\u201C${name.trim()}\u201D` : 'esta ficha'
    const ok = window.confirm(`¿Seguro que quieres borrar ${label}? Esta acción no se puede deshacer.`)
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch('/api/catalogo/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error((json as { error?: string })?.error || `Error HTTP ${res.status}`)
      }
      router.push('/catalogo')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error inesperado al borrar'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDelete}
        disabled={loading}
        className={`px-3 py-1.5 rounded text-sm border ${loading ? 'bg-slate-200 text-slate-500' : 'bg-red-600 text-white hover:bg-red-700'} border-red-700`}
      >
        {loading ? 'Borrando…' : 'Eliminar ficha'}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  )
}