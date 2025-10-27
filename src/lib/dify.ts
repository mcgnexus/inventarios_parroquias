import axios from 'axios'
// Esta función la importas de tu archivo supabase.ts
// ¡Ahora sí la vamos a usar!
import { subirImagen } from './supabase'

const DIFY_API_URL = process.env.NEXT_PUBLIC_DIFY_API_URL || 'https://api.dify.ai/v1'
const DIFY_API_KEY = process.env.NEXT_PUBLIC_DIFY_API_KEY || ''

// Tamaño máximo de imagen: 10MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB en bytes

export interface RespuestaDify {
  exito: boolean
  respuesta?: string
  conversationId?: string
  error?: string
  authWarning?: boolean
  supabaseImage?: { url: string; path: string } | null
}

/**
 * Genera un ID corto para trazar los logs de una solicitud
 */
function generarTraceId(): string {
  return Date.now().toString(36).slice(-6)
}

/**
 * Función para enviar SOLO TEXTO a Dify
 */
export async function enviarMensajeDify(
  mensaje: string,
  userId: string
): Promise<RespuestaDify> {
  const traceId = generarTraceId()
  
  try {
    console.log(`[${traceId}] 📤 Enviando mensaje de SOLO TEXTO a Dify...`)
    
    if (!DIFY_API_KEY) {
      throw new Error('DIFY_API_KEY no configurada')
    }
    
    const response = await axios.post(
      `${DIFY_API_URL}/chat-messages`,
      {
        inputs: {},
        query: mensaje,
        user: userId,
        response_mode: 'blocking'
      },
      {
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    console.log(`[${traceId}] ✅ Respuesta de TEXTO recibida de Dify`)
    
    return {
      exito: true,
      respuesta: response.data.answer,
      conversationId: response.data.conversation_id
    }
    
  } catch (error) {
    console.error(`[${traceId}] ❌ Error al comunicarse con Dify (Texto):`, error)
    
    let mensajeError = 'No se pudo obtener respuesta de la IA.'
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        mensajeError = 'Error de autenticación. Verifica tu API Key de Dify.'
      } else if (error.response?.status === 404) {
        mensajeError = 'Endpoint no encontrado. Verifica la URL de Dify.'
      } else if (error.response?.data?.message) {
        mensajeError = error.response.data.message
      }
    }
    
    return {
      exito: false,
      error: mensajeError
    }
  }
}

/**
 * Función para SUBIR ARCHIVO a Dify y obtener file_id
 * Esta es una función auxiliar necesaria.
 */
async function subirArchivoDify(
  archivo: File, 
  userId: string, 
  traceId: string
): Promise<string | null> {
  try {
    console.log(`[${traceId}] 📤 Subiendo archivo a Dify (files/upload)...`)
    
    if (archivo.size > MAX_IMAGE_SIZE) {
      throw new Error(`La imagen es demasiado grande. Máximo permitido: 10MB. Tamaño actual: ${(archivo.size / 1024 / 1024).toFixed(2)}MB`)
    }
    
    const formData = new FormData()
    formData.append('file', archivo)
    formData.append('user', userId)
    
    const response = await axios.post(
      `${DIFY_API_URL}/files/upload`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`
        }
      }
    )

    console.log(`[${traceId}] ✅ Archivo subido a Dify. file_id: ${response.data.id}`)
    
    return response.data.id
    
  } catch (error) {
    console.error(`[${traceId}] ❌ Error al subir archivo a Dify:`, error)
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 413) {
        throw new Error('La imagen es demasiado grande. Máximo: 10MB')
      } else if (error.response?.data?.message) {
        throw new Error(error.response.data.message)
      }
    }
    
    throw new Error('No se pudo subir la imagen a Dify')
  }
}


/**
 * MÉTODO PRINCIPAL: Enviar IMAGEN como adjunto 'local_file'
 * Esta es la única forma correcta de enviar una imagen para Visión en Dify.
 * AHORA TAMBIÉN SUBE A SUPABASE.
 */
export async function enviarImagenDifyConInputArchivo(
  mensaje: string,
  imagen: File,
  userId: string
): Promise<RespuestaDify> {
  const traceId = generarTraceId()
  console.log(`[${traceId}] 🚀 INICIO: Enviando imagen con 'local_file' (Método Correcto)`)

  let authWarning = false

  try {
    if (!DIFY_API_KEY) throw new Error('DIFY_API_KEY no configurada')
    if (!imagen.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen')
    if (imagen.size > MAX_IMAGE_SIZE) throw new Error(`La imagen es demasiado grande. Máximo: 10MB.`)

    // =================================================================
    // INICIO DE LA MODIFICACIÓN
    // =================================================================

    console.log(`[${traceId}] 🔄 Iniciando subidas paralelas a Dify y Supabase...`);

    // Ejecutamos ambas subidas en paralelo y esperamos a que terminen
    const [difyUploadResult, supabaseUploadResult] = await Promise.allSettled([
      subirArchivoDify(imagen, userId, traceId), // Sube a Dify
      subirImagen(imagen, userId)                 // Sube a Supabase
    ]);

    // 1. Comprobar la subida a Dify (es la CRÍTICA)
    let fileId: string | null = null;
    if (difyUploadResult.status === 'fulfilled' && difyUploadResult.value) {
      fileId = difyUploadResult.value;
      console.log(`[${traceId}] ✅ Subida a Dify OK.`);
    } else {
      // Si Dify falla, no podemos continuar
      if (difyUploadResult.status === 'rejected') {
        console.error(`[${traceId}] ❌ Falló la subida a Dify (crítico):`, difyUploadResult.reason);
      } else {
        console.error(`[${traceId}] ❌ Falló la subida a Dify (crítico): subida incompleta sin valor`);
      }
      throw new Error('Falló la subida de archivo a Dify.');
    }

    // 2. Comprobar la subida a Supabase (es SECUNDARIA)
    let supabaseImage: { url: string; path: string } | null = null
    if (supabaseUploadResult.status === 'fulfilled' && supabaseUploadResult.value?.url) {
      console.log(`[${traceId}] ✅ Subida a Supabase OK. URL: ${supabaseUploadResult.value.url}`);
      supabaseImage = { url: supabaseUploadResult.value.url, path: supabaseUploadResult.value.path }
    } else {
      // Si Supabase falla, solo lo advertimos, pero continuamos
      console.warn(`[${traceId}] ⚠️ Falló la subida a Supabase. (Continuamos...)`);
      if (supabaseUploadResult.status === 'rejected') {
        console.warn(`[${traceId}] 📄 Razón fallo Supabase:`, supabaseUploadResult.reason);
        if (supabaseUploadResult.reason instanceof Error && supabaseUploadResult.reason.message === 'AUTH_401') {
          authWarning = true
        }
      }
    }
    
    // =================================================================
    // FIN DE LA MODIFICACIÓN
    // =================================================================


    console.log(`[${traceId}] 📄 file_id para adjunto obtenido: ${fileId}. Enviando a chat-messages...`)

    // 3. Enviar el mensaje de chat con el ID de Dify en el array 'files'
    const response = await axios.post(
      `${DIFY_API_URL}/chat-messages`,
      {
        inputs: {}, // IMPORTANTE: El objeto 'inputs' va vacío
        query: mensaje || 'Analiza este objeto del patrimonio parroquial',
        user: userId,
        response_mode: 'blocking',
        files: [
          {
            type: 'image',
            transfer_method: 'local_file',
            upload_file_id: fileId
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    console.log(`[${traceId}] ✅ Éxito con 'local_file'. El LLM ahora debería ver la imagen.`)

    return {
      exito: true,
      respuesta: response.data.answer,
      conversationId: response.data.conversation_id,
      authWarning,
      supabaseImage
    }

  } catch (error) {
    console.error(`[${traceId}] ❌ Error en 'enviarImagenDifyConInputArchivo':`, error)
    let mensajeError = 'No se pudo analizar la imagen.'

    if (error instanceof Error) {
      mensajeError = error.message
    } else if (axios.isAxiosError(error)) {
       console.error(`[${traceId}] 📄 Detalle del error:`, error.response?.data)
      if (error.response?.status === 401) {
        mensajeError = 'Error de autenticación con Dify.'
      } else if (error.response?.data?.message) {
        mensajeError = error.response.data.message
      }
    }

    return { exito: false, error: mensajeError, authWarning }
  }
}

/**
 * Función para COMPRIMIR imagen si es mayor a MAX_IMAGE_SIZE
 */
export async function comprimirImagen(
  archivo: File, 
  maxSize: number = MAX_IMAGE_SIZE,
  traceId?: string
): Promise<File> {
  const logId = traceId || generarTraceId()
  
  return new Promise((resolve, reject) => {
    if (archivo.size <= maxSize) {
      resolve(archivo)
      return
    }

    console.log(`[${logId}] 🔧 Comprimiendo imagen (tamaño: ${(archivo.size / 1024 / 1024).toFixed(2)}MB)...`)

    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        const maxDimension = 4096 // Límite de píxeles
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension)
            width = maxDimension
          } else {
            width = Math.round((width / height) * maxDimension)
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('No se pudo crear contexto de canvas'))
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        const originalType = archivo.type || 'image/jpeg'
        let outputType = originalType
        
        if (originalType === 'image/png') {
          outputType = 'image/png'
        }

        let quality = 0.95

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('No se pudo comprimir la imagen'))
                return
              }
              
              if (blob.size > maxSize && quality > 0.6) {
                quality -= 0.05
                tryCompress() // Recursión para bajar calidad
                return
              }

              const archivoComprimido = new File([blob], archivo.name, {
                type: outputType,
                lastModified: Date.now()
              })

              console.log(`[${traceId}] ✅ Imagen optimizada: ${(archivo.size / 1024 / 1024).toFixed(2)}MB → ${(archivoComprimido.size / 1024 / 1024).toFixed(2)}MB`)

              resolve(archivoComprimido)
            },
            outputType,
            quality
          )
        }
        tryCompress()
      }
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(archivo)
  })
}

/**
 * Función para validar y preparar imagen antes de enviar
 */
export async function prepararImagen(archivo: File): Promise<File> {
  const traceId = generarTraceId()
  console.log(`[${traceId}] 🕵️ Preparando imagen: ${archivo.name} (${(archivo.size / 1024 / 1024).toFixed(2)}MB)`)
  
  if (!archivo.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen (JPG, PNG, WEBP, etc.)')
  }

  const extensionesPermitidas = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  const extension = archivo.name.split('.').pop()?.toLowerCase()

  if (!extension || !extensionesPermitidas.includes(extension)) {
    throw new Error(`Formato no permitido. Usa: ${extensionesPermitidas.join(', ').toUpperCase()}`)
  }

  if (archivo.size > MAX_IMAGE_SIZE) {
    console.log(`[${traceId}] ⚠️ Imagen supera ${MAX_IMAGE_SIZE / 1024 / 1024}MB. Comprimiendo...`)
    return await comprimirImagen(archivo, MAX_IMAGE_SIZE, traceId)
  }
  
  console.log(`[${traceId}] ✅ Imagen válida y dentro del límite. Lista.`)
  return archivo
}

