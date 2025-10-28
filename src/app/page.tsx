'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getCurrentUser, onAuthStateChange, signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { LogIn, UserPlus, FileText, PlusCircle, LogOut } from 'lucide-react'

export default function Home() {
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    let unsub: (() => void) | null = null
    ;(async () => {
      const u = await getCurrentUser()
      setUserEmail(u?.email ?? null)
    })()
    unsub = onAuthStateChange(() => {
      getCurrentUser().then(u => {
        setUserEmail(u?.email ?? null)
      })
    })
    return () => { unsub?.() }
  }, [])

  const router = useRouter()
  const handleSignOut = async () => {
    await signOut()
    setUserEmail(null)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 sm:py-10 px-3 sm:px-4">
      <div className="container mx-auto max-w-5xl">
        <header className="text-center mb-10">
          <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 sm:mb-3">FidesDigital</h1>
          <p className="text-slate-600">Inventario patrimonial asistido por IA</p>
          {userEmail && (
            <p className="mt-2 text-sm text-slate-500">Sesión: {userEmail}</p>
          )}
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Catálogo: Público */}
          <Link href="/catalogo" className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-amber-600 group-hover:text-amber-700" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">Catálogo</h3>
                  <span className="rounded-full bg-slate-100 text-slate-600 text-xs px-2 py-0.5">Público</span>
                </div>
                <p className="text-sm text-slate-500">Explora y filtra los bienes inventariados</p>
              </div>
            </div>
          </Link>

          {/* Inserción: requiere login si no hay sesión */}
          <Link href={userEmail ? '/inventario' : '/auth?mode=login&reason=login-required'} className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <PlusCircle className="h-6 w-6 text-amber-600 group-hover:text-amber-700" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">Inserción de inventario</h3>
                  {!userEmail && (
                    <span className="rounded-full bg-yellow-50 text-amber-700 border border-amber-200 text-xs px-2 py-0.5">Requiere login</span>
                  )}
                </div>
                <p className="text-sm text-slate-500">Analiza una imagen y registra el objeto</p>
              </div>
            </div>
          </Link>

          {/* Login y registro con modo explícito */}
          <Link href="/auth?mode=login" className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <LogIn className="h-6 w-6 text-amber-600 group-hover:text-amber-700" />
              <div>
                <h3 className="font-semibold text-slate-800">Iniciar sesión</h3>
                <p className="text-sm text-slate-500">Accede para guardar y gestionar inventario</p>
              </div>
            </div>
          </Link>

          <Link href="/auth?mode=register" className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <UserPlus className="h-6 w-6 text-amber-600 group-hover:text-amber-700" />
              <div>
                <h3 className="font-semibold text-slate-800">Registrarse</h3>
                <p className="text-sm text-slate-500">Crea una cuenta vinculada a tu parroquia</p>
              </div>
            </div>
          </Link>

          <button
            onClick={handleSignOut}
            disabled={!userEmail}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <LogOut className="h-6 w-6 text-amber-600" />
              <div>
                <h3 className="font-semibold text-slate-800">Salir</h3>
                <p className="text-sm text-slate-500">Cierra la sesión actual</p>
              </div>
            </div>
          </button>
        </section>

        <footer className="text-center mt-10 text-sm text-gray-500">
          <p>💡Creado por: Manuel Carrasco García</p>
        </footer>
      </div>
    </main>
  )
}