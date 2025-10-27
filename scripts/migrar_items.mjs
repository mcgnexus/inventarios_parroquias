import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function loadEnvLocal() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch (e) {
    console.warn('No se pudo cargar .env.local:', e?.message || e)
  }
}

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.env.DRY_RUN === 'true'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan variables: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function resolveParishId({ parish_id, parish_name }) {
  if (parish_id) return parish_id
  if (!parish_name) return null
  // Intentar con alias locales
  const dynamicAliases = buildDynamicAliasesFromLocalCatalog()
  const manualAliases = loadParishAlias()
  const aliasMap = { ...dynamicAliases, ...manualAliases }
  let candidateName = aliasMap[normalize(parish_name)] || parish_name
  // Intentar ajustar al nombre canónico del catálogo local (usando localidad)
  const canon = pickCanonicalFromLocalCatalog(candidateName)
  if (canon) candidateName = canon

  // Intento directo por ilike
  {
    const { data, error } = await supabase
      .from('parishes')
      .select('id,name')
      .ilike('name', candidateName)
      .limit(1)
    if (!error && data?.[0]?.id) return data[0].id
  }

  // Intento por lista completa con normalización
  {
    const { data, error } = await supabase
      .from('parishes')
      .select('id,name')
    if (error || !data) return null
    const normalizedTarget = normalize(candidateName)
    for (const row of data) {
      const n = normalize(row.name || '')
      if (!n) continue
      if (n === normalizedTarget) return row.id
      // Partial contains (evita falsos positivos muy cortos)
      if (normalizedTarget.length >= 5 && (n.includes(normalizedTarget) || normalizedTarget.includes(n))) {
        return row.id
      }
    }
    // Fallback difuso: escoger mejor coincidencia por Levenshtein si es suficientemente similar
    const best = pickBestFuzzy(normalizedTarget, data.map(r => ({ id: r.id, name: normalize(r.name || '') })))
    if (best?.id) return best.id
  }
  return null
}

function normalizeStatus(parsed) {
  const status = (parsed?.status || '').toLowerCase()
  const approved = !!parsed?.approved_at || status === 'approved'
  const published = !!parsed?.published_at || status === 'published'
  const hasImage = !!(parsed?.image_url && String(parsed.image_url).trim())
  if (approved && hasImage) return 'approved'
  if (approved && !hasImage) return 'published'
  if (published) return 'published'
  return 'draft'
}

function passesRule(parsed) {
  const status = normalizeStatus(parsed)
  return status !== 'draft'
}

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function loadParishAlias() {
  try {
    const p = path.resolve(process.cwd(), 'scripts/parishes-map.json')
    if (!fs.existsSync(p)) return {}
    const json = JSON.parse(fs.readFileSync(p, 'utf8'))
    const aliases = json?.aliases || {}
    const out = {}
    for (const k of Object.keys(aliases)) {
      out[normalize(k)] = aliases[k]
    }
    return out
  } catch {
    return {}
  }
}

// Distancia de Levenshtein simple y selector de mejor candidato
function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }
  return dp[m][n]
}

function pickBestFuzzy(target, candidates) {
  let best = null
  let bestScore = Infinity
  for (const c of candidates) {
    const d = levenshtein(target, c.name)
    const maxLen = Math.max(target.length, c.name.length)
    const ratio = maxLen ? d / maxLen : 1
    if (ratio < 0.25 && d < bestScore) {
      bestScore = d
      best = c
    }
  }
  return best
}

function pickCanonicalFromLocalCatalog(candidateName) {
  try {
    const catalogPath = path.resolve(process.cwd(), 'scripts/guadixParishes.json')
    if (!fs.existsSync(catalogPath)) return null
    const arr = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
    const target = normalize(candidateName)
    let best = null
    for (const rec of arr) {
      const nName = normalize(rec.name || '')
      const nLoc = normalize(rec.location || '')
      const combo = normalize(`${rec.name} ${rec.location}`)
      if (target === combo || target === nName || (nLoc && target.includes(nLoc) && target.includes(nName))) {
        best = rec.name
        break
      }
    }
    return best
  } catch {
    return null
  }
}

function buildDynamicAliasesFromLocalCatalog() {
  try {
    const catalogPath = path.resolve(process.cwd(), 'scripts/guadixParishes.json')
    if (!fs.existsSync(catalogPath)) return {}
    const arr = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
    const out = {}
    for (const rec of arr) {
      const name = (rec.name || '').trim()
      const loc = (rec.location || '').trim()
      if (!name) continue
      const variants = new Set([
        name,
        loc ? `${name} (${loc})` : name,
        loc ? `${name} - ${loc}` : name,
        loc ? `${name}, ${loc}` : name,
        loc ? `${name} ${loc}` : name,
      ])
      for (const v of variants) {
        out[normalize(v)] = name
      }
    }
    return out
  } catch {
    return {}
  }
}

function slugify(str) {
  return normalize(str).replace(/\s+/g, '-')
}

function extractInventoryNumber(parsed, row, parishNameOrId) {
  const direct = String(parsed?.inventory_number || '').trim()
  if (direct) return direct

  const candidates = [
    parsed?.descripcion_breve,
    parsed?.observaciones,
    parsed?.name,
    parsed?.descripcion_detallada,
  ].filter(Boolean)

  const patterns = [
    /(?:inventario|n[ºo]|num(?:ero)?)[\s:\-]*([A-Z0-9][A-Z0-9\-_/]{2,})/i,
    /\b([A-Z]{2,5}-\d{2,6})\b/, // Ej: ABC-1234
    /\b(\d{4,})\b/ // solo dígitos largos
  ]

  for (const text of candidates) {
    const t = String(text)
    for (const re of patterns) {
      const m = t.match(re)
      if (m && m[1]) return m[1]
    }
  }

  // Sintético estable si no encontramos nada
  const base = parishNameOrId ? slugify(parishNameOrId) : 'sin-parroquia'
  return `AUTO-${base}-${String(row.id || '').slice(0,8)}`
}

// Intenta sanear cadenas que parecen JSON pero tienen errores comunes
function sanitizeJson(str) {
  try {
    let s = String(str || '').trim()
    if (!s) return null
    // Normalizar comillas tipográficas
    s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    // Eliminar BOM si existiera
    s = s.replace(/^\uFEFF/, '')
    // Quitar comas finales antes de cierre de objeto/array
    s = s.replace(/,\s*([}\]])/g, '$1')
    // Convertir claves con comillas simples a dobles
    s = s.replace(/'([A-Za-z0-9_]+)'\s*:/g, '"$1":')
    // Convertir valores con comillas simples a dobles (conservador)
    s = s.replace(/:\s*'([^']*)'/g, ': "$1"')
    // Normalizar booleanos y null estilo Python
    s = s.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
    return s
  } catch {
    return null
  }
}

async function migrateBatch(offset = 0, limit = 1000) {
  const { data, error } = await supabase
    .from('conversaciones')
    .select('*')
    .order('fecha', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  const rows = data || []

  let migrated = 0
  let skipped = 0
  const issues = []

  for (const row of rows) {
    let parsed
    try { parsed = JSON.parse(row.respuesta) } catch {
      const sanitized = sanitizeJson(row.respuesta)
      try { parsed = sanitized ? JSON.parse(sanitized) : null } catch { parsed = null }
    }
    if (!parsed || typeof parsed !== 'object') { skipped++; issues.push({ id: row.id, reason: 'respuesta no parseable', parish_name: null, status: null, has_image: null }); continue }
    if (!(parsed.tipo_objeto || parsed.name)) { skipped++; issues.push({ id: row.id, reason: 'faltan campos clave (tipo_objeto/name)', parish_name: parsed?.parish_name || null, status: normalizeStatus(parsed), has_image: !!parsed?.image_url }); continue }
    if (!passesRule(parsed)) { skipped++; issues.push({ id: row.id, reason: 'no cumple regla de visibilidad (aprobado requiere imagen)', parish_name: parsed?.parish_name || null, status: normalizeStatus(parsed), has_image: !!parsed?.image_url }); continue }

    const parishId = await resolveParishId({ parish_id: parsed.parish_id, parish_name: parsed.parish_name })
    const parishNameOrId = parsed.parish_name || parsed.parish_id || parishId
    if (!parishId) { skipped++; issues.push({ id: row.id, reason: 'parish_id no resolvible', parish_name: parsed?.parish_name || null, status: normalizeStatus(parsed), has_image: !!parsed?.image_url }); continue }

    const inventory_number = extractInventoryNumber(parsed, row, parishNameOrId)
    if (!inventory_number || !String(inventory_number).trim()) { skipped++; issues.push({ id: row.id, reason: 'inventory_number no derivable', parish_name: parsed?.parish_name || null, status: normalizeStatus(parsed), has_image: !!parsed?.image_url }); continue }

    const payload = {
      parish_id: parishId,
      inventory_number: String(inventory_number).trim(),
      status: normalizeStatus(parsed),
      image_url: parsed.image_url || null,
      user_id: parsed.user_id || row.user_id || null,
      parish_name: parsed.parish_name || null,
      data: parsed,
      published_at: parsed.published_at || null,
      approved_at: parsed.approved_at || null,
    }

    if (DRY_RUN) {
      migrated++
      continue
    }

    const { error: upsertError } = await supabase
      .from('items')
      .upsert([payload], { onConflict: 'parish_id,inventory_number' })
    if (upsertError) {
      skipped++
      issues.push({ id: row.id, reason: `upsert error: ${upsertError.message || upsertError}`, parish_name: parsed?.parish_name || null, status: normalizeStatus(parsed), has_image: !!parsed?.image_url })
    } else {
      migrated++
    }
  }

  return { migrated, skipped, issues, processed: rows.length }
}

async function main() {
  let offset = 0
  const limit = 500
  let totalMigrated = 0
  let totalSkipped = 0
  const allIssues = []

  while (true) {
    const { migrated, skipped, issues, processed } = await migrateBatch(offset, limit)
    totalMigrated += migrated
    totalSkipped += skipped
    allIssues.push(...issues)
    if (processed < limit) break
    offset += limit
  }

  console.log(`Migración completada${DRY_RUN ? ' (DRY RUN)' : ''}:`)
  console.log(`  ✅ Migrados: ${totalMigrated}`)
  console.log(`  ⚠️  Omitidos: ${totalSkipped}`)
  if (allIssues.length) {
    console.log('  Detalle de incidencias (primeras 20):')
    for (const issue of allIssues.slice(0, 20)) {
      console.log(`   - id=${issue.id} · ${issue.reason}`)
    }
  }

  // Escribir reporte detallado para diagnóstico y correcciones
  try {
    const report = {
      dryRun: DRY_RUN,
      migrated_count: totalMigrated,
      skipped_count: totalSkipped,
      issues: allIssues,
      generated_at: new Date().toISOString(),
    }
    const outPath = path.resolve(process.cwd(), 'scripts/migration-report.json')
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
    console.log(`  📄 Reporte guardado en scripts/migration-report.json`)
  } catch (e) {
    console.warn('  ⚠️ No se pudo escribir migration-report.json:', e?.message || e)
  }
}

main().catch(err => {
  console.error('Error en migración:', err?.message || err)
  process.exit(1)
})