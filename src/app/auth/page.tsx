"use client"
import { useEffect, useState, Suspense } from 'react'
import { getCurrentUser, signOut, onAuthStateChange, signUpWithProfile, getSupabaseBrowser } from '@/lib/auth'
import { useSearchParams, useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import type { PostgrestError } from '@supabase/supabase-js'
import type { AuthResponse } from '@supabase/supabase-js'

type ParishOption = { id: string; name: string }
export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  )
}

function AuthPageContent() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [parishId, setParishId] = useState('')
  const [parishOptions, setParishOptions] = useState<{ id: string; name: string }[]>([])
  const [parishOpen, setParishOpen] = useState(false)
  const [parishLoading, setParishLoading] = useState(false)
  const [selectedParishId, setSelectedParishId] = useState<string | null>(null)
  const [role, setRole] = useState('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const urlMode = searchParams.get('mode')
  const router = useRouter()
  useEffect(() => {
    console.log('[Auth] Componente montado, urlMode:', urlMode)
    if (urlMode === 'register' || urlMode === 'login') {
      setMode(urlMode as 'login' | 'register')
    }
  }, [urlMode])

  // Capturar errores globales
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[Auth] Error global capturado:', event.error)
    }
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    ;(async () => {
      const user = await getCurrentUser()
      setUserId(user?.id ?? null)
    })()
    unsubscribe = onAuthStateChange(async () => {
      const user = await getCurrentUser()
      setUserId(user?.id ?? null)
    })
    return () => { unsubscribe?.() }
  }, [])

  useEffect(() => {
    const q = parishId.trim()
    setSelectedParishId(null)
    if (mode === 'register' && q.length >= 2) {
      const sb = getSupabaseBrowser()
      if (!sb) return
      setParishLoading(true)
      sb
        .from('parishes')
        .select('id,name')
        .ilike('name', `%${q}%`)
        .limit(5)
        .then(({ data, error }: { data: ParishOption[] | null; error: PostgrestError | null }) => {
          if (error) {
            console.warn('Error buscando parroquias:', error.message)
            setParishOptions([])
            setParishOpen(false)
            return
          }
          setParishOptions(data || [])
          setParishOpen(!!(data && data.length))
        })
        .finally(() => setParishLoading(false))
    } else {
      setParishOptions([])
      setParishOpen(false)
    }
  }, [parishId, mode])

  const handleSelectParish = (opt: { id: string; name: string }) => {
    setParishId(opt.name)
    setSelectedParishId(opt.id)
    setParishOpen(false)
  }

  const handleSignIn = async () => {
    console.log('[Auth] Iniciando handleSignIn');
    setError('');
    setLoading(true);
    
    try {
      // Intentar con la API route (más confiable para establecer cookies del servidor)
      console.log('[Auth] Intentando login con API route...');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Importante: incluir cookies en la petición
        body: JSON.stringify({ email, password }),
      });

      console.log('[Auth] Respuesta API:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('[Auth] Login exitoso vía API');
        
        if (result.session) {
          console.log('[Auth] Login exitoso - sesión establecida en el servidor');
          console.log('[Auth] Iniciando sincronización de sesión...');

          // Sincronizar sesión del cliente (localStorage) con los tokens devueltos por la API
          try {
            console.log('[Auth] Obteniendo cliente Supabase...');
            const supabase = getSupabaseBrowser();
            if (supabase) {
              console.log('[Auth] Cliente obtenido, llamando setSession...');
              // Lanzar setSession en segundo plano para no bloquear la navegación
              void supabase.auth.setSession({
                access_token: result.session.access_token,
                refresh_token: result.session.refresh_token,
              }).then(({ data: setData, error: setError }: AuthResponse) => {
                console.log('[Auth] setSession resultado:', { setData, setError });
                if (setError) {
                  console.warn('[Auth] setSession error:', setError.message);
                } else {
                  console.log('[Auth] Sesión sincronizada correctamente');
                }
              }).catch((e: unknown) => {
                console.warn('[Auth] Error al sincronizar sesión:', e);
              });
            } else {
              console.warn('[Auth] No se pudo obtener cliente Supabase para setSession');
            }
          } catch (sessionError) {
            console.warn('[Auth] Error al sincronizar sesión:', sessionError);
            // Continuar con la redirección aunque falle la sincronización
          }

          console.log('[Auth] Preparando redirección...');
          
          // Decidir destino: si venimos por "login-required", ir a Inventario
          const dest = reason === 'login-required' ? '/inventario' : '/';
          console.log('[Auth] Destino calculado:', dest, 'reason:', reason);

          // Redirigir inmediatamente usando reemplazo de ubicación
          console.log('[Auth] Redirigiendo con window.location.replace...', dest);
          window.location.replace(dest);
          
        } else {
          console.warn('[Auth] No se recibió sesión en la respuesta de la API');
          setError('No se recibió información de sesión');
        }
        return;
      } else {
        const errorData = await response.json();
        console.log('[Auth] Error en API route:', errorData.error);
        throw new Error(errorData.error || 'Error de autenticación');
      }
      
    } catch (err) {
      console.log('[Auth] Error en login con API, error:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      console.log('[Auth] Finalizando handleSignIn');
      setLoading(false);
    }
  }

  const handleSignUp = async () => {
    if (!email.trim() || !password || !fullName.trim()) {
      setError('Completa nombre, email y contraseña')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const user = await signUpWithProfile({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
        parishId: selectedParishId || (parishId.trim() || undefined),
      })
      setUserId(user?.id ?? null)
      // Redirigir si hay sesión activa tras registro
      const sb = getSupabaseBrowser()
      if (sb) {
        const { data } = await sb.auth.getSession()
        if (data?.session) {
          router.push('/inventario')
        } else {
          setMode('login')
        }
      } else {
        setMode('login')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al registrar usuario'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    setError(null)
    try {
      await signOut()
      setUserId(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cerrar sesión'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Autenticación</h1>

      {reason === 'login-required' && (
        <div className="mb-4 px-3 py-2 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded">
          Se requiere iniciar sesión para subir imágenes desde el chat.
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setMode('login')}
          className={`px-3 py-1.5 rounded text-sm border ${mode === 'login' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-300'}`}
        >Iniciar sesión</button>
        <button
          onClick={() => setMode('register')}
          className={`px-3 py-1.5 rounded text-sm border ${mode === 'register' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-300'}`}
        >Registrarse</button>
      </div>

      {mode === 'login' ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded px-3 py-1.5"
              placeholder="usuario@parroquia.org"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                console.log('[Auth] Botón clickeado - Email:', email.trim(), 'Password:', password ? 'presente' : 'vacío');
                if (!email.trim() || !password) {
                  console.log('[Auth] Validación fallida - campos vacíos');
                  setError('Por favor completa email y contraseña');
                  return;
                }
                console.log('[Auth] Validación pasada - llamando a handleSignIn');
                handleSignIn();
              }}
              disabled={loading}
              className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:bg-slate-300"
              aria-busy={loading}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loading || !userId}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200 disabled:bg-slate-300"
            >
              Cerrar sesión
            </button>
            <button
              type="button"
              onClick={() => console.log('[Auth] Botón de prueba clickeado')}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              Test
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded px-3 py-1.5"
              placeholder="Nombre y apellidos"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded px-3 py-1.5"
              placeholder="usuario@parroquia.org"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Confirmar contraseña</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Parroquia (ID o nombre)</label>
            <div className="relative">
              <input
                type="text"
                value={parishId}
                onChange={(e) => setParishId(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded px-3 py-1.5"
                placeholder="Escribe para buscar por nombre (opcional)"
                onFocus={() => parishOptions.length && setParishOpen(true)}
              />
              {parishOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm">
                  {parishLoading ? (
                    <div className="px-3 py-2 text-xs text-slate-500">Buscando...</div>
                  ) : parishOptions.length ? (
                    parishOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectParish(opt)}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
                      >
                        {opt.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-slate-500">Sin resultados</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="text-sm border border-slate-300 rounded px-2 py-1 bg-white"
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:bg-slate-300"
            >
              Registrarse
            </button>
            <button
              onClick={() => setMode('login')}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
            >
              Ya tengo cuenta
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="text-xs font-semibold text-slate-600">Usuario actual</div>
        <div className="text-sm text-slate-800">{userId ? userId : 'No autenticado'}</div>
        <div className="mt-2 text-xs text-slate-600">Tras iniciar sesión, prueba a subir una imagen en el chat para verificar que `/api/upload` deriva tu usuario desde cookies.</div>
      </div>
      <footer className="text-center mt-10 text-sm text-gray-500">
        <p>💡Creado por: Manuel Carrasco García</p>
      </footer>
    </div>
  )
}