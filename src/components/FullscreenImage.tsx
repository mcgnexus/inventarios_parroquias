"use client"
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useCallback, useRef } from 'react'

type ImageItem = { src: string; alt?: string }

type Props = {
  src: string
  alt?: string
  images?: Array<string | ImageItem>
  startIndex?: number
  imgClassName?: string
  containerClassName?: string
}

export default function FullscreenImage({ src, alt, images, startIndex = 0, imgClassName, containerClassName }: Props) {
  const slides: ImageItem[] = (images && images.length > 0)
    ? images.map(i => typeof i === 'string' ? ({ src: i }) : i)
    : [{ src, alt }]

  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(Math.min(Math.max(0, startIndex), slides.length - 1))
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const overlayImgRef = useRef<HTMLImageElement | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const touchDeltaRef = useRef<{ x: number; y: number } | null>(null)
  const touchMovedRef = useRef<boolean>(false)
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(null)

  const close = useCallback(() => setOpen(false), [])

  const resetTransform = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (slides.length > 1) {
        if (e.key === 'ArrowRight') next()
        if (e.key === 'ArrowLeft') prev()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slides.length])

  useEffect(() => {
    // al cerrar, resetear zoom y posición
    if (!open) resetTransform()
  }, [open, resetTransform])

  useEffect(() => {
    // al cambiar de slide, resetear zoom y posición
    resetTransform()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Capturamos 'wheel' con listener no pasivo para permitir preventDefault
  useEffect(() => {
    if (!open || !overlayImgRef.current) return
    const el = overlayImgRef.current
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      setScale(prev => Math.max(1, Math.min(6, prev * factor)))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [open])
  
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    draggingRef.current = true
    lastPosRef.current = { x: e.clientX, y: e.clientY }
  }, [])
  
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!draggingRef.current) return
    const last = lastPosRef.current
    if (!last) return
    const dx = e.clientX - last.x
    const dy = e.clientY - last.y
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }, [])
  
  const endDrag = useCallback(() => {
    draggingRef.current = false
    lastPosRef.current = null
  }, [])

  const next = useCallback(() => {
    if (slides.length <= 1) return
    setIndex(i => (i + 1) % slides.length)
  }, [slides.length])

  const prev = useCallback(() => {
    if (slides.length <= 1) return
    setIndex(i => (i - 1 + slides.length) % slides.length)
  }, [slides.length])

  const current = slides[index]
  const canZoomIn = scale < 6
  const canZoomOut = scale > 1

  return (
    <div className={containerClassName}>
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        style={{ cursor: 'zoom-in' }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      />

      {open && (
         <div
           role="dialog"
           aria-modal="true"
           className="fixed inset-0 z-50 bg-slate-900/80"
           style={{ overscrollBehavior: 'contain' }}
           onClick={close}
         >
           <div className="absolute top-4 right-4 flex items-center gap-2">
             <button
               aria-label="Alejar (Zoom −)"
               className="bg-white/90 text-slate-900 rounded-full w-9 h-9 shadow text-lg font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
               disabled={!canZoomOut}
               onClick={(e) => { e.stopPropagation(); setScale(prev => Math.max(1, prev / 1.2)) }}
             >
               <span aria-hidden="true">−</span>
             </button>
             <button
               aria-label="Acercar (Zoom +)"
               className="bg-white/90 text-slate-900 rounded-full w-9 h-9 shadow text-lg font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
               disabled={!canZoomIn}
               onClick={(e) => { e.stopPropagation(); setScale(prev => Math.min(6, prev * 1.2)) }}
             >
               <span aria-hidden="true">+</span>
             </button>
             <span className="bg-white/90 text-slate-900 rounded px-2 py-1 text-xs font-semibold select-none">
               {Math.round(scale * 100)}%
             </span>
             <button
               aria-label="Cerrar"
               className="bg-white/90 text-slate-900 rounded px-3 py-1.5 shadow text-sm font-medium"
               onClick={(e) => { e.stopPropagation(); close() }}
             >
               Cerrar
             </button>
           </div>

           {slides.length > 1 && (
             <>
               <button
                 aria-label="Anterior"
                 className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-900 rounded-full w-10 h-10 shadow text-xl font-bold flex items-center justify-center"
                 onClick={(e) => { e.stopPropagation(); prev() }}
               >
                 <span aria-hidden="true">‹</span>
               </button>
               <button
                 aria-label="Siguiente"
                 className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-900 rounded-full w-10 h-10 shadow text-xl font-bold flex items-center justify-center"
                 onClick={(e) => { e.stopPropagation(); next() }}
               >
                 <span aria-hidden="true">›</span>
               </button>
             </>
           )}

           <div className="w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
             <div className="max-w-[95vw] max-h-[90vh] bg-slate-100 flex items-center justify-center"
                 style={{ touchAction: 'none' }}
                 onTouchStart={(e) => {
                   if (e.touches.length === 2) {
                     const t1 = e.touches[0]
                     const t2 = e.touches[1]
                     const dx = t1.clientX - t2.clientX
                     const dy = t1.clientY - t2.clientY
                     const dist = Math.sqrt(dx * dx + dy * dy)
                     pinchRef.current = { startDistance: dist, startScale: scale }
                     touchStartRef.current = null
                     touchMovedRef.current = false
                     e.preventDefault()
                     return
                   }
                   if (e.touches.length !== 1) return
                   const t = e.touches[0]
                   touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
                   touchDeltaRef.current = { x: 0, y: 0 }
                   touchMovedRef.current = false
                 }}
                 onTouchMove={(e) => {
                   if (e.touches.length === 2 && pinchRef.current) {
                     const t1 = e.touches[0]
                     const t2 = e.touches[1]
                     const dx = t1.clientX - t2.clientX
                     const dy = t1.clientY - t2.clientY
                     const dist = Math.sqrt(dx * dx + dy * dy)
                     const factor = dist / pinchRef.current.startDistance
                     const nextScale = Math.max(1, Math.min(6, pinchRef.current.startScale * factor))
                     setScale(nextScale)
                     touchMovedRef.current = true
                     e.preventDefault()
                     return
                   }
                   if (!touchStartRef.current || e.touches.length !== 1) return
                   const t = e.touches[0]
                   const dx = t.clientX - touchStartRef.current.x
                   const dy = t.clientY - touchStartRef.current.y
                   touchDeltaRef.current = { x: dx, y: dy }
                   if (Math.abs(dx) > 8 || Math.abs(dy) > 8) touchMovedRef.current = true
                   e.preventDefault()
                 }}
                onTouchEnd={() => {
                  const start = touchStartRef.current
                  const delta = touchDeltaRef.current
                  touchStartRef.current = null
                  touchDeltaRef.current = null
                  if (pinchRef.current) {
                    pinchRef.current = null
                    return
                  }
                  if (!start || !delta || !touchMovedRef.current) return
                  const absX = Math.abs(delta.x)
                  const absY = Math.abs(delta.y)
                  const threshold = 50
                  if (scale === 1 && slides.length > 1 && absX > threshold && absX > absY) {
                    if (delta.x < 0) { next() } else { prev() }
                 }
                 touchMovedRef.current = false
               }}
               >
              <img ref={overlayImgRef} src={current.src} alt={current.alt} className="object-contain max-w-[95vw] max-h-[90vh]" 
                 style={{
                   cursor: scale > 1 ? (draggingRef.current ? 'grabbing' : 'grab') : 'zoom-in',
                   transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                   transition: draggingRef.current ? 'none' : 'transform 60ms linear',
                   willChange: 'transform'
                 }}
                 draggable={false}
                 onMouseDown={onMouseDown}
                 onMouseMove={onMouseMove}
                 onMouseUp={endDrag}
                 onMouseLeave={endDrag}
                 onDoubleClick={() => { setScale(1); setOffset({ x: 0, y: 0 }) }}
               />
             </div>
           </div>

           <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none">
-            <div className="px-3 py-1 rounded bg-black/60 text-white text-xs font-medium">Rueda para zoom · Arrastra para mover · Doble clic para reset</div>
+            <div className="px-3 py-1 rounded bg-black/60 text-white text-xs font-medium">Rueda para zoom · Arrastra para mover · Pinza para zoom · Doble clic para reset</div>
             {slides.length > 1 && (
               <div className="px-2 py-1 rounded bg-black/50 text-white text-xs font-semibold tracking-wide">
                 {index + 1} / {slides.length}
               </div>
             )}
           </div>
         </div>
       )}
      
    </div>
  )
}