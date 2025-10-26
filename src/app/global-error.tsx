"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Se produjo un error</h2>
            <p className="text-sm text-slate-600 mb-4">{error?.message || 'Error inesperado en la aplicación.'}</p>
            {error?.digest && (
              <p className="text-xs text-slate-400 mb-4">ID: {error.digest}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => reset()}
                className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
              >
                Reintentar
              </button>
              <button
                onClick={() => location.reload()}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}