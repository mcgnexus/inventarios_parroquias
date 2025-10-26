'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/auth';

export default function TestAuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const testLogin = async () => {
    console.log('[TestAuth] Iniciando testLogin');
    console.log('[TestAuth] Email:', email);
    console.log('[TestAuth] Password:', password ? 'presente' : 'vacío');
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      console.log('[TestAuth] Obteniendo cliente Supabase');
      const supabase = getSupabaseBrowser();
      console.log('[TestAuth] Cliente Supabase:', supabase ? 'Sí' : 'No');
      
      if (!supabase) {
        throw new Error('No se pudo crear el cliente Supabase');
      }
      
      console.log('[TestAuth] Intentando login con:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      console.log('[TestAuth] Resultado - data:', data);
      console.log('[TestAuth] Resultado - error:', error);
      
      if (error) {
        throw error;
      }
      
      if (!data.session) {
        throw new Error('No se pudo crear la sesión');
      }
      
      setSuccess('Login exitoso!');
      console.log('[TestAuth] Login exitoso completado');
      
    } catch (err) {
      console.log('[TestAuth] Error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
      console.log('[TestAuth] Test finalizado');
    }
  };

  const testSimpleClick = () => {
    console.log('[TestAuth] Botón simple clickeado');
    setSuccess('Botón simple funcionando!');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 w-full max-w-md">
        <h1 className="text-xl font-semibold text-slate-800 mb-6">Test de Autenticación</h1>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded px-3 py-2"
              placeholder="usuario@parroquia.org"
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded px-3 py-2"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-600">
            {success}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={testLogin}
            disabled={loading}
            className="w-full px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-slate-300"
          >
            {loading ? 'Procesando...' : 'Test Login'}
          </button>
          
          <button
            onClick={testSimpleClick}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Botón Simple
          </button>
        </div>
        
        <div className="mt-4 text-xs text-slate-500">
          <p>Abre la consola del navegador (F12) para ver los logs detallados.</p>
        </div>
      </div>
    </div>
  );
}