# ARQUITECTURA COMPLETA DE FIDES DIGITAL - MAPA DE DATOS Y CONEXIONES

## 🗄️ MODELO DE DATOS COMPLETO

### **1. TABLA: `parishes` (Parroquias)**
**Propósito:** Entidad principal que agrupa todos los datos de una parroquia

| Campo | Tipo | Descripción | Relaciones |
|-------|------|-------------|------------|
| `id` | UUID (PK) | Identificador único | → `profiles.parish_id`, `items.parish_id`, `subscriptions.parish_id` |
| `name` | TEXT | Nombre de la parroquia | - |
| `diocese` | TEXT | Diócesis a la que pertenece | - |
| `location` | TEXT | Ciudad/pueblo | - |
| `address` | TEXT | Dirección postal | - |
| `email` | TEXT | Email de contacto | - |
| `phone` | TEXT | Teléfono | - |
| `admin_user_id` | UUID (FK) | Usuario administrador principal | → `profiles.id` |
| `created_at` | TIMESTAMPTZ | Fecha de creación | Auto |
| `updated_at` | TIMESTAMPTZ | Última actualización | Auto (trigger) |

**Índices:**
- PK en `id`
- Index en `admin_user_id`

---

### **2. TABLA: `profiles` (Usuarios)**
**Propósito:** Perfiles de usuarios vinculados a Supabase Auth

| Campo | Tipo | Descripción | Relaciones |
|-------|------|-------------|------------|
| `id` | UUID (PK) | Mismo ID que `auth.users` | ← `parishes.admin_user_id`, → `items.created_by`, `media.uploaded_by` |
| `full_name` | TEXT | Nombre completo | - |
| `email` | TEXT | Email (sincronizado con auth.users) | - |
| `role` | TEXT | Rol del usuario | Valores: `admin`, `user`, `viewer` |
| `parish_id` | UUID (FK) | Parroquia a la que pertenece | ← `parishes.id` |
| `created_at` | TIMESTAMPTZ | Fecha de creación | Auto |
| `updated_at` | TIMESTAMPTZ | Última actualización | Auto (trigger) |

**Índices:**
- PK en `id`
- Index en `parish_id`
- Index en `email`

**Lógica de roles:**
- **admin:** Puede crear, editar, eliminar objetos y usuarios
- **user:** Puede crear y editar objetos
- **viewer:** Solo lectura

---

### **3. TABLA: `items` (Objetos del inventario)**
**Propósito:** Registro individual de cada pieza patrimonial

| Campo | Tipo | Descripción | Relaciones |
|-------|------|-------------|------------|
| `id` | UUID (PK) | Identificador único | → `media.item_id` |
| `parish_id` | UUID (FK) | Parroquia propietaria | ← `parishes.id` |
| `created_by` | UUID (FK) | Usuario que creó el registro | ← `profiles.id` |
| `name` | TEXT | Nombre del objeto | Searchable |
| `inventory_number` | TEXT | Código/número de inventario | Único por parroquia |
| `category` | TEXT | Categoría del objeto | Valores: `orfebreria`, `ornamento_liturgico`, `imagineria`, `pintura`, `escultura`, `mobiliario`, `documento`, `libro`, `textil`, `otro` |
| `description_brief` | TEXT | Descripción corta (máx 200 chars) | Searchable |
| `description_detailed` | TEXT | Descripción completa | Searchable |
| `materials` | TEXT[] | Array de materiales | Ej: `["plata", "madera dorada"]` |
| `techniques` | TEXT[] | Técnicas artísticas | Ej: `["cincelado", "repujado"]` |
| `artistic_style` | TEXT | Estilo artístico | Ej: "Barroco", "Gótico" |
| `dating_approximate` | TEXT | Datación aproximada | Ej: "Mediados del siglo XVII" |
| `centuries_estimated` | TEXT | Siglos estimados | Ej: "XVII-XVIII" |
| `iconography` | TEXT | Descripción iconográfica | Searchable |
| `conservation_state` | TEXT | Estado de conservación | Valores: `excelente`, `bueno`, `regular`, `deficiente`, `critico` |
| `visible_damage` | TEXT[] | Daños visibles | Ej: `["oxidación leve", "falta de dorado"]` |
| `location` | TEXT | Ubicación dentro de la parroquia | Ej: "Sacristía, armario 2" |
| `artistic_value` | TEXT | Valor artístico estimado | Valores: `muy_alto`, `alto`, `medio`, `regular`, `bajo` |
| `review_json` | JSONB | Propuesta completa de la IA | JSON estructurado de Dify |
| `ai_confidence` | TEXT | Confianza del análisis IA | Valores: `alta`, `media`, `baja` |
| `analyzed_at` | TIMESTAMPTZ | Fecha de análisis IA | Nullable |
| `status` | TEXT | Estado del registro | Valores: `draft`, `ai_suggested`, `validated`, `published` |
| `created_at` | TIMESTAMPTZ | Fecha de creación | Auto |
| `updated_at` | TIMESTAMPTZ | Última actualización | Auto (trigger) |
| `published_at` | TIMESTAMPTZ | Fecha de publicación | Nullable |

**Índices:**
- PK en `id`
- Index en `parish_id`
- Index en `created_by`
- Index compuesto en `(parish_id, status)`
- Index compuesto en `(parish_id, category)`
- Index GIN en `materials` (búsqueda en arrays)
- Index GIN en `techniques` (búsqueda en arrays)
- Index GIN en `visible_damage` (búsqueda en arrays)
- **Full-text search index** en español sobre `name || ' ' || description_brief || ' ' || description_detailed || ' ' || iconography`

**Flujo de estados:**
1. `draft` → Usuario crea objeto manualmente sin IA
2. `ai_suggested` → IA ha analizado imagen y propuesto catalogación
3. `validated` → Usuario ha revisado y aprobado propuesta IA
4. `published` → Objeto finalizado y visible en inventario

---

### **4. TABLA: `media` (Archivos multimedia)**
**Propósito:** Gestión de imágenes y archivos adjuntos

| Campo | Tipo | Descripción | Relaciones |
|-------|------|-------------|------------|
| `id` | UUID (PK) | Identificador único | - |
| `item_id` | UUID (FK) | Objeto al que pertenece | ← `items.id` (CASCADE DELETE) |
| `file_name` | TEXT | Nombre original del archivo | - |
| `file_type` | TEXT | MIME type | Ej: `image/jpeg`, `image/png` |
| `storage_path` | TEXT | Ruta en Supabase Storage | Ej: `items/{parish_id}/{item_id}/{timestamp}_{filename}` |
| `public_url` | TEXT | URL pública firmada | Generada por Supabase |
| `media_type` | TEXT | Tipo de medio | Valores: `photo`, `document`, `video`, `other` |
| `width` | INTEGER | Ancho en píxeles | Nullable |
| `height` | INTEGER | Alto en píxeles | Nullable |
| `display_order` | INTEGER | Orden de visualización | Default: 0 |
| `is_primary` | BOOLEAN | ¿Es la imagen principal? | Solo una por `item_id` (trigger) |
| `caption` | TEXT | Descripción/pie de foto | Nullable |
| `uploaded_by` | UUID (FK) | Usuario que subió el archivo | ← `profiles.id` |
| `created_at` | TIMESTAMPTZ | Fecha de subida | Auto |

**Índices:**
- PK en `id`
- Index en `item_id`
- Index compuesto en `(item_id, is_primary)` (para buscar imagen principal rápido)
- Index en `uploaded_by`

**Trigger especial:**
- Al marcar `is_primary = true`, automáticamente desmarca otras fotos del mismo item

**Estructura en Storage:**
```
bucket: inventario/
└── items/
    └── {parish_id}/
        └── {item_id}/
            ├── 1234567890_foto1.jpg
            ├── 1234567891_foto2.jpg
            └── 1234567892_detalle.jpg
```

---

### **5. TABLA: `subscriptions` (Suscripciones)**
**Propósito:** Control de planes y límites de uso

| Campo | Tipo | Descripción | Relaciones |
|-------|------|-------------|------------|
| `id` | UUID (PK) | Identificador único | - |
| `parish_id` | UUID (FK) | Parroquia suscrita | ← `parishes.id` (UNIQUE) |
| `plan` | TEXT | Plan contratado | Valores: `free`, `basic`, `premium` |
| `status` | TEXT | Estado de la suscripción | Valores: `active`, `canceled`, `past_due`, `trialing` |
| `max_items` | INTEGER | Límite de objetos | `free`: 20, `basic`: NULL, `premium`: NULL |
| `max_ai_analyses` | INTEGER | Análisis IA por mes | `free`: 10, `basic`: 50, `premium`: NULL |
| `ai_analyses_used` | INTEGER | Análisis usados en periodo actual | Resetea cada mes |
| `stripe_customer_id` | TEXT | ID en Stripe | Nullable |
| `stripe_subscription_id` | TEXT | ID de suscripción en Stripe | Nullable |
| `current_period_start` | TIMESTAMPTZ | Inicio del periodo actual | - |
| `current_period_end` | TIMESTAMPTZ | Fin del periodo actual | - |
| `created_at` | TIMESTAMPTZ | Fecha de creación | Auto |
| `updated_at` | TIMESTAMPTZ | Última actualización | Auto (trigger) |

**Índices:**
- PK en `id`
- Index UNIQUE en `parish_id`
- Index en `stripe_customer_id`
- Index en `stripe_subscription_id`

**Límites por plan:**

| Plan | Max Items | Max AI/mes | Precio |
|------|-----------|------------|--------|
| **FREE** | 20 | 10 | €0 |
| **BASIC** | ∞ | 50 | €9.99/mes |
| **PREMIUM** | ∞ | ∞ | €19.99/mes |

---

## 🔗 MAPA DE RELACIONES

```
auth.users (Supabase Auth)
    ↓ 1:1
profiles
    ├── parish_id → parishes
    └── id ← parishes.admin_user_id
              ↑
              │ parish_id
         ┌────┴────┬──────────────┐
         │         │              │
      items   subscriptions   profiles (otros usuarios)
         ├── created_by → profiles
         └── id → media.item_id
                      └── uploaded_by → profiles
```

### **Relaciones detalladas:**

1. **`auth.users` → `profiles`** (1:1)
   - Cada usuario autenticado tiene un perfil
   - `profiles.id` = `auth.users.id`

2. **`parishes` ↔ `profiles`** (1:N)
   - Una parroquia tiene múltiples usuarios
   - `profiles.parish_id` → `parishes.id`
   - Una parroquia tiene un admin principal
   - `parishes.admin_user_id` → `profiles.id`

3. **`parishes` → `items`** (1:N)
   - Una parroquia tiene múltiples objetos
   - `items.parish_id` → `parishes.id`
   - **RLS:** Usuarios solo ven items de su parroquia

4. **`profiles` → `items`** (1:N)
   - Un usuario crea múltiples objetos
   - `items.created_by` → `profiles.id`

5. **`items` → `media`** (1:N)
   - Un objeto tiene múltiples fotos/archivos
   - `media.item_id` → `items.id`
   - **Cascade delete:** Al borrar item, se borran sus fotos

6. **`profiles` → `media`** (1:N)
   - Un usuario sube múltiples archivos
   - `media.uploaded_by` → `profiles.id`

7. **`parishes` → `subscriptions`** (1:1)
   - Una parroquia tiene una suscripción
   - `subscriptions.parish_id` → `parishes.id` (UNIQUE)

---

## 🔒 ROW LEVEL SECURITY (RLS)

### **Política general para todas las tablas:**
```sql
-- SELECT: Solo datos de tu parroquia
CREATE POLICY "Users see only their parish data"
ON table_name FOR SELECT
USING (parish_id = (SELECT parish_id FROM profiles WHERE id = auth.uid()));

-- INSERT: Solo en tu parroquia
CREATE POLICY "Users insert only in their parish"
ON table_name FOR INSERT
WITH CHECK (parish_id = (SELECT parish_id FROM profiles WHERE id = auth.uid()));

-- UPDATE: Solo admins y users
CREATE POLICY "Admins and users can update"
ON table_name FOR UPDATE
USING (
  parish_id = (SELECT parish_id FROM profiles WHERE id = auth.uid())
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'user')
);

-- DELETE: Solo admins
CREATE POLICY "Only admins can delete"
ON table_name FOR DELETE
USING (
  parish_id = (SELECT parish_id FROM profiles WHERE id = auth.uid())
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
```

### **Políticas especiales:**

**`profiles`:**
- SELECT: Ver todos los usuarios de tu parroquia
- UPDATE: Solo admins pueden cambiar roles

**`media`:**
- SELECT: Ver fotos de objetos de tu parroquia (join con items)
- DELETE: Solo admins o el usuario que subió la foto

**`subscriptions`:**
- SELECT: Solo admins ven los datos de suscripción
- UPDATE/DELETE: Solo service role (webhooks de Stripe)

**Storage bucket `inventario`:**
- SELECT: Público (cualquiera con URL puede ver)
- INSERT: Solo usuarios autenticados
- UPDATE: Solo usuarios autenticados
- DELETE: Solo admins

---

## 🔧 FUNCIONES POSTGRESQL PERSONALIZADAS

### **1. `check_item_limit(p_parish_id UUID)`**
**Propósito:** Verificar si una parroquia puede añadir más objetos

```sql
RETURNS BOOLEAN
```

**Lógica:**
1. Obtiene el plan actual de `subscriptions`
2. Si plan = `free`, cuenta items existentes
3. Retorna `false` si ya alcanzó límite (20)
4. Retorna `true` si puede añadir más

**Uso en aplicación:**
- Antes de INSERT en `items`, llamar esta función
- Si retorna `false`, mostrar mensaje "Upgrade plan"

---

### **2. `increment_ai_usage(p_parish_id UUID)`**
**Propósito:** Registrar uso de análisis IA

```sql
RETURNS VOID
```

**Lógica:**
1. Incrementa `ai_analyses_used` en `subscriptions`
2. Si alcanza límite (`max_ai_analyses`), lanza excepción
3. Resetea contador si el periodo ha expirado

**Uso en aplicación:**
- Después de llamar a Dify, ejecutar esta función
- Si lanza excepción, mostrar "Límite alcanzado"

---

### **3. `get_parish_stats(p_parish_id UUID)`**
**Propósito:** Obtener estadísticas completas de una parroquia

```sql
RETURNS JSON
```

**Retorna:**
```json
{
  "total_items": 150,
  "items_by_category": {
    "orfebreria": 25,
    "imagineria": 40,
    "ornamento_liturgico": 30
  },
  "items_by_status": {
    "draft": 5,
    "ai_suggested": 10,
    "validated": 50,
    "published": 85
  },
  "conservation_summary": {
    "excelente": 20,
    "bueno": 80,
    "regular": 40,
    "deficiente": 8,
    "critico": 2
  },
  "subscription": {
    "plan": "basic",
    "items_used": 150,
    "items_limit": null,
    "ai_used": 35,
    "ai_limit": 50
  }
}
```

**Uso en aplicación:**
- Dashboard principal
- Gráficos y KPIs

---

### **4. `search_items(...)`**
**Propósito:** Búsqueda avanzada con full-text y filtros

```sql
search_items(
  p_parish_id UUID,
  p_query TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_conservation TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF items
```

**Lógica:**
1. Full-text search en español sobre nombre, descripción, iconografía
2. Filtros opcionales por categoría, estado, conservación
3. Ordenado por relevancia (ts_rank)
4. Paginación con LIMIT/OFFSET

**Uso en aplicación:**
- Barra de búsqueda del inventario
- Filtros avanzados

---

### **5. `delete_item_complete(p_item_id UUID)`**
**Propósito:** Eliminación completa con limpieza de archivos

```sql
RETURNS VOID
```

**Lógica:**
1. Verifica permisos (solo admin)
2. Obtiene paths de archivos en Storage de `media`
3. Borra registros de `media` (trigger cascade)
4. Borra archivos físicos en Storage
5. Borra registro de `items`

**Uso en aplicación:**
- Botón "Eliminar" en detalle de objeto
- Confirmación de eliminación

---

## 📊 VISTAS PREDEFINIDAS

### **1. Vista: `items_with_media`**
```sql
SELECT 
  i.*,
  m.public_url as primary_image_url,
  m.file_name as primary_image_name
FROM items i
LEFT JOIN media m ON i.id = m.item_id AND m.is_primary = true;
```

**Uso:** Lista de objetos con imagen principal

---

### **2. Vista: `items_complete`**
```sql
SELECT 
  i.*,
  p.name as parish_name,
  p.diocese,
  pr.full_name as created_by_name,
  COALESCE(
    json_agg(
      json_build_object(
        'id', m.id,
        'url', m.public_url,
        'type', m.media_type,
        'is_primary', m.is_primary
      )
      ORDER BY m.is_primary DESC, m.display_order
    ) FILTER (WHERE m.id IS NOT NULL),
    '[]'
  ) as media_files
FROM items i
JOIN parishes p ON i.parish_id = p.id
JOIN profiles pr ON i.created_by = pr.id
LEFT JOIN media m ON i.item_id = m.item_id
GROUP BY i.id, p.id, pr.id;
```

**Uso:** Detalle completo de objeto con todas sus relaciones

---

### **3. Vista: `parish_usage`**
```sql
SELECT 
  p.id as parish_id,
  p.name as parish_name,
  s.plan,
  s.status,
  COUNT(i.id) as items_count,
  s.max_items as items_limit,
  s.ai_analyses_used,
  s.max_ai_analyses as ai_limit,
  CASE 
    WHEN s.max_items IS NULL THEN NULL
    ELSE (COUNT(i.id)::FLOAT / s.max_items * 100)
  END as items_usage_percent
FROM parishes p
JOIN subscriptions s ON p.id = s.parish_id
LEFT JOIN items i ON p.id = i.parish_id
GROUP BY p.id, s.id;
```

**Uso:** Monitoreo de uso de límites por plan

---

## 🤖 INTEGRACIÓN CON DIFY (IA)

### **Flujo de análisis IA:**

```
1. Usuario sube imagen → Supabase Storage
                          ↓
2. Frontend obtiene public_url
                          ↓
3. POST /api/catalog/analyze
   Body: { imageUrl, itemId }
                          ↓
4. Next.js API Route:
   - Llama a Dify API
   - Envía imagen + prompt
   - Recibe JSON estructurado
                          ↓
5. Validación con Zod:
   - Verifica estructura
   - Sanitiza datos
                          ↓
6. Guarda en Supabase:
   UPDATE items SET
     review_json = {...},
     analyzed_at = NOW(),
     status = 'ai_suggested',
     ai_confidence = 'alta|media|baja'
                          ↓
7. Frontend muestra propuesta
   (Doble columna: IA ↔ Usuario)
                          ↓
8. Usuario revisa y aprueba
                          ↓
9. PUT /api/items/{id}/validate
   - Copia campos de review_json a campos definitivos
   - Actualiza status = 'validated'
   - Incrementa ai_analyses_used
```

### **Estructura del JSON de la IA (`review_json`):**

```json
{
  "tipo_objeto": "Cáliz",
  "categoria": "orfebreria",
  "descripcion_breve": "Cáliz de plata sobredorada con decoración barroca",
  "descripcion_detallada": "Pieza de plata de ley...",
  "materiales": ["plata", "oro", "esmalte"],
  "tecnicas": ["cincelado", "repujado", "esmaltado"],
  "estilo_artistico": "Barroco",
  "datacion_aproximada": "Segunda mitad del siglo XVII",
  "siglos_estimados": "XVII",
  "iconografia": "Motivos vegetales, querubines...",
  "estado_conservacion": "bueno",
  "deterioros_visibles": ["desgaste del dorado", "pequeñas abolladuras"],
  "dimensiones_estimadas": "Altura: 25 cm, diámetro: 12 cm",
  "valor_artistico": "alto",
  "observaciones": "Requiere limpieza profesional...",
  "confianza_analisis": "alta"
}
```

---

## 🎯 FLUJO COMPLETO DE USO

### **Caso de uso: Catalogar un nuevo objeto**

**PASO 1: Login**
```
Usuario → /login
        → Supabase Auth
        → Redirect a /dashboard
```

**PASO 2: Crear nuevo item**
```
Usuario → /inventory/new
        → Formulario básico:
           - Nombre
           - Número de inventario
           - Ubicación
```

**PASO 3: Subir imágenes**
```
Usuario → Selecciona archivos
        → Upload a Storage:
           bucket: inventario
           path: items/{parish_id}/{item_id}/{timestamp}_{filename}
        → INSERT en media:
           - item_id
           - storage_path
           - public_url
           - is_primary = true (primera foto)
```

**PASO 4: Análisis con IA (OPCIONAL)**
```
Usuario → Click "Analizar con IA"
        → POST /api/catalog/analyze
           Body: { 
             imageUrl: media.public_url,
             itemId: items.id 
           }
        → Dify API:
           - GPT-4o Mini con visión
           - Prompt especializado
           - Retorna JSON
        → Validación Zod
        → UPDATE items:
             review_json = {...}
             analyzed_at = NOW()
             status = 'ai_suggested'
        → Frontend muestra doble columna
```

**PASO 5: Revisión y validación**
```
Usuario → Revisa propuesta IA
        → Edita campos si es necesario
        → Click "Validar y publicar"
        → PUT /api/items/{id}/validate
           Body: { ...campos editados }
        → UPDATE items:
             ...campos definitivos
             status = 'validated'
        → increment_ai_usage(parish_id)
```

**PASO 6: Objeto en inventario**
```
Usuario → /inventory
        → Lista de objetos con:
           - Imagen principal
           - Nombre
           - Categoría
           - Estado de conservación
        → Click en objeto → Detalle completo
```

---

## 📱 ESTRUCTURA DE PERMISOS

### **Matriz de permisos por rol:**

| Acción | Admin | User | Viewer |
|--------|-------|------|--------|
| **Ver objetos de su parroquia** | ✅ | ✅ | ✅ |
| **Ver objetos de otras parroquias** | ❌ | ❌ | ❌ |
| **Crear objetos** | ✅ | ✅ | ❌ |
| **Editar objetos** | ✅ | ✅ | ❌ |
| **Eliminar objetos** | ✅ | ❌ | ❌ |
| **Subir imágenes** | ✅ | ✅ | ❌ |
| **Eliminar imágenes** | ✅ | ❌ | ❌ |
| **Usar análisis IA** | ✅ | ✅ | ❌ |
| **Ver estadísticas** | ✅ | ✅ | ✅ |
| **Gestionar usuarios** | ✅ | ❌ | ❌ |
| **Ver datos de suscripción** | ✅ | ❌ | ❌ |
| **Exportar inventario** | ✅ | ✅ | ✅ |

---

## 🔑 VARIABLES DE ENTORNO NECESARIAS

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # Solo server-side

# Dify IA
DIFY_API_KEY=app-xxx
DIFY_WORKFLOW_ENDPOINT=https://api.dify.ai/v1/workflows/run

# Stripe (futuro)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 📈 DIAGRAMA ENTIDAD-RELACIÓN SIMPLIFICADO

```
┌─────────────────┐
│   auth.users    │ (Supabase Auth)
│  (Autenticación)│
└────────┬────────┘
         │ 1:1
         ↓
┌─────────────────┐
│    profiles     │
│  - id (PK=FK)   │
│  - full_name    │
│  - email        │
│  - role         │
│  - parish_id(FK)│
└────────┬────────┘
         │
         │ N:1
         ↓
┌─────────────────┐           ┌──────────────────┐
│    parishes     │───────────│  subscriptions   │
│  - id (PK)      │    1:1    │  - parish_id(FK) │
│  - name         │           │  - plan          │
│  - diocese      │           │  - max_items     │
│  - location     │           │  - ai_limit      │
│  - admin_user_id│           └──────────────────┘
└────────┬────────┘
         │ 1:N
         ↓
┌─────────────────┐
│      items      │
│  - id (PK)      │
│  - parish_id(FK)│
│  - created_by(FK)
│  - name         │
│  - category     │
│  - description  │
│  - materials[]  │
│  - status       │
│  - review_json  │
└────────┬────────┘
         │ 1:N
         ↓
┌─────────────────┐
│      media      │
│  - id (PK)      │
│  - item_id (FK) │
│  - storage_path │
│  - public_url   │
│  - is_primary   │
│  - uploaded_by  │
└─────────────────┘
```

---

## 🎓 RESUMEN EJECUTIVO

**Fides Digital** es un SaaS de inventario parroquial que utiliza:

1. **Base de datos relacional** (PostgreSQL/Supabase) con 5 tablas principales
2. **Seguridad multinivel** (RLS) que aísla datos por parroquia
3. **IA para catalogación** (GPT-4o Mini) que analiza imágenes y genera metadatos
4. **Sistema de suscripciones** con límites por plan (free/basic/premium)
5. **Storage organizado** para archivos multimedia
6. **Funciones custom** que encapsulan lógica de negocio compleja
7. **Vistas optimizadas** para queries frecuentes

**Flujo principal:**
Usuario sube foto → IA analiza → Usuario valida → Objeto catalogado

**Ventaja competitiva:**
Sistema diseñado específicamente para arte sacro católico, con terminología especializada y conocimiento del dominio eclesial.

---

*Documento generado para facilitar el entendimiento completo de la arquitectura de Fides Digital por parte de cualquier LLM o desarrollador.*
