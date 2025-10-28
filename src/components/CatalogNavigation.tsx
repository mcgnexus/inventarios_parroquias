"use client"
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'

interface CatalogNavigationProps {
  currentId: string
  allItems: Array<{ id: string; data: { descripcion_breve?: string; tipo_objeto?: string } }>
  queryString?: string
}

export default function CatalogNavigation({ currentId, allItems, queryString = '' }: CatalogNavigationProps) {
  const currentIndex = allItems.findIndex(item => item.id === currentId)
  const hasIndex = currentIndex !== -1

  const previousItem = hasIndex && currentIndex > 0 ? allItems[currentIndex - 1] : null
  const nextItem = hasIndex && currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

  // Soporte para navegación con teclado
  useEffect(() => {
    if (!hasIndex) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && previousItem) {
        window.location.href = `/catalogo/${previousItem.id}${queryString}`
      } else if (event.key === 'ArrowRight' && nextItem) {
        window.location.href = `/catalogo/${nextItem.id}${queryString}`
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hasIndex, previousItem, nextItem, queryString])

  if (!hasIndex) {
    return null
  }

  return (
    <div className="fixed top-1/2 left-0 right-0 transform -translate-y-1/2 pointer-events-none z-30 print:hidden">
      <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
        {/* Flecha izquierda - Anterior */}
        {previousItem ? (
          <Link
            href={`/catalogo/${previousItem.id}${queryString}`}
            className="pointer-events-auto bg-white/90 hover:bg-white border border-slate-200 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            title={`Anterior: ${previousItem.data.descripcion_breve || previousItem.data.tipo_objeto}`}
            aria-label="Ir a la ficha anterior"
          >
            <ChevronLeft className="h-6 w-6 text-slate-600 group-hover:text-slate-800" />
          </Link>
        ) : (
          <div className="pointer-events-auto bg-white/70 border border-slate-200 rounded-full p-3 shadow-lg opacity-50 cursor-not-allowed">
            <ChevronLeft className="h-6 w-6 text-slate-400" />
          </div>
        )}

        {/* Contador de posición */}
        <div className="pointer-events-auto bg-white/90 border border-slate-200 rounded-full px-4 py-2 shadow-lg">
          <span className="text-sm font-medium text-slate-600">
            {currentIndex + 1} de {allItems.length}
          </span>
        </div>

        {/* Flecha derecha - Siguiente */}
        {nextItem ? (
          <Link
            href={`/catalogo/${nextItem.id}${queryString}`}
            className="pointer-events-auto bg-white/90 hover:bg-white border border-slate-200 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            title={`Siguiente: ${nextItem.data.descripcion_breve || nextItem.data.tipo_objeto}`}
            aria-label="Ir a la siguiente ficha"
          >
            <ChevronRight className="h-6 w-6 text-slate-600 group-hover:text-slate-800" />
          </Link>
        ) : (
          <div className="pointer-events-auto bg-white/70 border border-slate-200 rounded-full p-3 shadow-lg opacity-50 cursor-not-allowed">
            <ChevronRight className="h-6 w-6 text-slate-400" />
          </div>
        )}
      </div>
      
      {/* Indicador de navegación con teclado */}
      <div className="absolute left-1/2 transform -translate-x-1/2 pointer-events-auto" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="bg-black/70 text-white text-xs px-3 py-1 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300">
          Usa ← → para navegar
        </div>
      </div>
    </div>
  )
}