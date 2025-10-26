"use client"
import { useEffect, useState } from 'react'
import EditableCatalogForm, { type CatalogInitialData } from '@/components/EditableCatalogForm'

interface Props {
  id: string
  initialData: CatalogInitialData
}

export default function CatalogoEditSection({ id, initialData }: Props) {
  const [editing, setEditing] = useState(false)

  const handleSaveSuccess = () => {
    setEditing(false)
  }

  useEffect(() => {
    const onToggle = () => setEditing(true)
    if (typeof window !== 'undefined') {
      window.addEventListener('catalogo:toggle-edit', onToggle as EventListener)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('catalogo:toggle-edit', onToggle as EventListener)
      }
    }
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      {!editing ? (
        <div className="text-sm text-slate-700">Pulsa &quot;Editar ficha&quot; en el encabezado para mostrar los campos de modificación.</div>
      ) : (
        <EditableCatalogForm id={id} initialData={initialData} onSaveSuccess={handleSaveSuccess} />
      )}
    </div>
  )
}