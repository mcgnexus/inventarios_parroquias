"use client"
import { useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default function CatalogoUserFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const currentUserParam = searchParams.get('user') || ''

  const goAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('user')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const goMine = useCallback(async () => {
    const user = await getCurrentUser()
    if (!user) {
      router.push('/auth?mode=login&reason=login-required&from=catalogo')
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('user', user.id)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const isMine = !!currentUserParam

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={goAll}
        className={`px-3 py-1.5 rounded text-sm border ${!isMine ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
        title="Ver todas las piezas"
      >
        Todas
      </button>
      <button
        onClick={goMine}
        className={`px-3 py-1.5 rounded text-sm border ${isMine ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50'}`}
        title="Ver solo mis piezas"
      >
        Mis piezas
      </button>
    </div>
  )
}