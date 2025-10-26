"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import EditTriggerButton from '@/components/EditTriggerButton'
import DeleteCatalogItemButton from '@/components/DeleteCatalogItemButton'
import CatalogoEditSection from '@/components/CatalogoEditSection'
import type { CatalogacionCompleta } from '@/lib/supabase'

type Props = {
  id: string
  name: string
  initialData: CatalogacionCompleta
}

export default function AuthEditControls({ id, name, initialData }: Props) {
  const [authed, setAuthed] = useState<boolean>(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const u = await getCurrentUser()
      if (mounted) setAuthed(!!u)
    })()
    return () => { mounted = false }
  }, [])

  if (!authed) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        El catálogo puede verse sin iniciar sesión, pero no modificarse.
        <Link href="/auth?mode=login&reason=login-required" className="ml-2 text-amber-700 hover:text-amber-800 underline">
          Iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <EditTriggerButton />
        <DeleteCatalogItemButton id={String(id)} name={name} />
      </div>
      <CatalogoEditSection id={String(id)} initialData={initialData} />
    </>
  )
}