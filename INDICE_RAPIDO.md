# 🗂️ ÍNDICE RÁPIDO - Ubicaciones de Problemas

## Búsqueda Rápida por Archivo

### db.js
| Línea(s) | Problema | Severidad | Documento |
|----------|----------|-----------|-----------|
| 193, 197 | localStorage de usuarios | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#6 |
| 306-441 | localStorage de sesión | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#6 |
| 447-449 | `getPlayersCloud()` sin paginación | 🟠 IMPORTANTE | ANALISIS_RENDIMIENTO.md#3 |
| 451-490 | `findPlayerByEmailCloud()` 3 queries duplicadas | 🔴 CRÍTICO | ANALISIS_RENDIMIENTO.md#2 |
| 569-572 | `getChallengesCloud()` sin paginación | 🟠 IMPORTANTE | ANALISIS_RENDIMIENTO.md#3 |
| 603-613 | `getNewsCloud()` sin paginación | 🟠 IMPORTANTE | ANALISIS_RENDIMIENTO.md#3 |
| 610 | localStorage noticias | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#6 |
| 638-642 | localStorage ranking | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#6 |
| 712-721 | localStorage challenges | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#6 |
| 785 | localStorage bookings | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#6 |

**Soluciones en:** SOLUCIONES_CODIGO.md#1 (listeners), #2 (queries), #3 (paginación)

---

### apps_script_backend.js
| Línea(s) | Problema | Severidad | Documento |
|----------|----------|-----------|-----------|
| 155-162 | `notifyChallenge()`, `notifyResult()`, `notifyDispute()` solo email | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#7 |
| 164 | `getChallenges()` endpoint | 🟠 IMPORTANTE | ANALISIS_RENDIMIENTO.md#4 |
| 211-287 | `notifyChallenge()` función | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#7 |
| 249-257 | Email comentado (no se envía) | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#7 |
| 289-338 | `notifyResult()` función | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#7 |
| 340-373 | `notifyDispute()` función | 🟡 MEDIA | ANALISIS_RENDIMIENTO.md#7 |
| 530 | `getDataRange().getValues()` lectura completa | 🟠 IMPORTANTE | ANALISIS_RENDIMIENTO.md#4 |

**Soluciones en:** SOLUCIONES_CODIGO.md#4 (Google Sheets), #7 (notificaciones)

---

### script.js
| Línea(s) | Problema | Severidad | Documento |
|----------|----------|-----------|-----------|
| 280 | `loadRanking()` fetch sin caché | 🟠 IMPORTANTE | ANALISIS_RENDIMIENTO.md#5 |
| 280 | Query string `&v=${timestamp}` fuerza bypass | 🟠 IMPORTANTE | ANALISIS_RENDIMIENTO.md#5 |
| 409 | `setInterval(fetchWeather, 60*60*1000)` OK | 🟢 MENOR | - |

**Soluciones en:** SOLUCIONES_CODIGO.md#5 (caché ranking)

---

### sw.js
| Línea(s) | Problema | Severidad | Documento |
|----------|----------|-----------|-----------|
| 1-20 | Cache-first strategy sin revalidación | 🟢 MENOR | ANALISIS_RENDIMIENTO.md#8 |

**Soluciones en:** SOLUCIONES_CODIGO.md#6 (Service Worker)

---

## Búsqueda por Funcionalidad

### 🔐 Autenticación
| Función | Archivo | Línea | Problema |
|---------|---------|-------|----------|
| `loginWithGoogle()` | db.js | 283 | Llama `findPlayerByEmailCloud()` 3 queries |
| `loginWithGoogleMock()` | db.js | 351 | Llama `findPlayerByEmailCloud()` 3 queries |
| `validateMemberAPI()` | db.js | 243 | Llama `findPlayerByEmailCloud()` 3 queries |

**Impacto:** 🔴 CRÍTICO - Cada login = 3x costo Firestore

---

### 🏆 Ranking
| Función | Archivo | Línea | Problema |
|---------|---------|-------|----------|
| `loadRanking()` | script.js | 273 | Fetch sin caché, `&v=` bypass |
| `getRanking()` (backend) | apps_script_backend.js | 141 | Llama `getChallenges()` |
| `recalcRanking()` | db.js | 690 | Lee ALL challenges/users |

**Impacto:** 🟠 IMPORTANTE - Múltiples fetches innecesarios

---

### 🎾 Desafíos
| Función | Archivo | Línea | Problema |
|---------|---------|-------|----------|
| `getChallengesCloud()` | db.js | 569 | Sin paginación, lee TODO |
| `getChallenges()` | apps_script_backend.js | 528 | Google Sheets `.getDataRange()` |
| `notifyChallenge()` | apps_script_backend.js | 211 | Solo email, sin push real-time |
| `respondChallenge()` | apps_script_backend.js | 171 | Llama `getChallenges()` |
| `submitChallengeResult()` | apps_script_backend.js | 174 | Llama `getChallenges()` |

**Impacto:** 🔴-🟠 CRÍTICO a IMPORTANTE

---

### 👤 Jugadores
| Función | Archivo | Línea | Problema |
|---------|---------|-------|----------|
| `getPlayersCloud()` | db.js | 447 | Sin paginación, lee TODO |
| `findPlayerByEmailCloud()` | db.js | 451 | 3 queries por búsqueda |
| `savePlayerCloud()` | db.js | 494 | OK (sin issues) |

**Impacto:** 🔴 CRÍTICO - Queries duplicadas

---

### 📰 Noticias
| Función | Archivo | Línea | Problema |
|---------|---------|-------|----------|
| `getNewsCloud()` | db.js | 610 | Sin paginación, lee TODO |

**Impacto:** 🟢 MENOR (pocas noticias típicamente)

---

### 🗓️ Reservas
| Función | Archivo | Línea | Problema |
|---------|---------|-------|----------|
| `getBookings()` | db.js | 785 | localStorage solo (sin Firebase) |
| `getAvailableSlots()` | apps_script_backend.js | 143 | OK (sin issues identificados) |

**Impacto:** 🟢 MENOR - Sistema local aparentemente funciona

---

## 📊 Tabla Consolidada: Problemas + Ubicaciones

```
SEVERIDAD | # | PROBLEMA | db.js | apps_script | script.js | sw.js
──────────┼───┼──────────┼───────┼─────────────┼───────────┼──────
🔴 CRÍTICO │1 │ No listeners│447,569,610│     -    │    -    │  -
    │2 │ Queries dup  │451-490  │     -    │    -    │  -
🟠 IMPORT. │3 │ No paginación│447,569,610│    -    │    -    │  -
    │4 │ GSheets full │  -    │   530   │    -    │  -
    │5 │ Fetch no cache│  -    │     -    │   280   │  -
🟡 MEDIA  │6 │ localStorage│193-785  │     -    │    -    │  -
    │7 │ Email notif  │  -    │  211,289,340│    -    │  -
🟢 MENOR  │8 │ SW cache │  -    │     -    │    -    │ 1-20

KEY: Número de línea o rango
```

---

## 🔧 Matriz de Soluciones

| Problema | Solución Recomendada | Complejidad | Tiempo | Documento |
|----------|----------------------|-------------|--------|-----------|
| 1. No listeners | Implementar `onSnapshot()` | Media | 8h | SOLUCIONES_CODIGO.md#1 |
| 2. Queries dup | Refactor a query única | Baja | 2h | SOLUCIONES_CODIGO.md#2 |
| 3. No paginación | Agregar `limit()` + offset | Media | 6h | SOLUCIONES_CODIGO.md#3 |
| 4. GSheets full | Limitar lectura con `getRange()` | Baja | 3h | SOLUCIONES_CODIGO.md#4 |
| 5. Fetch no cache | Caché local con TTL | Baja | 4h | SOLUCIONES_CODIGO.md#5 |
| 6. localStorage sync | Usar como caché temporal | Media | 5h | SOLUCIONES_CODIGO.md#6 |
| 7. Email notif | Combinar + push real-time | Alta | 12h | SOLUCIONES_CODIGO.md#7 |
| 8. SW cache | Network-first strategy | Media | 4h | SOLUCIONES_CODIGO.md#6 |

---

## ⏱️ Orden de Implementación Recomendado

### SEMANA 1 (Fase 1 - CRÍTICA)
1. **Problema #2** (2h) - Queries duplicadas → ROI inmediato
2. **Problema #1** (8h) - Listeners Firestore → Experiencia de usuario

### SEMANA 2-3 (Fase 2 - IMPORTANTE)
3. **Problema #3** (6h) - Paginación
4. **Problema #4** (3h) - Google Sheets
5. **Problema #5** (4h) - Caché ranking

### SEMANA 4+ (Fase 3 - MEJORA CONTINUA)
6. **Problema #6** (5h) - localStorage refactor
7. **Problema #7** (12h) - Notificaciones real-time
8. **Problema #8** (4h) - Service Worker

---

## 🎯 Quick Start

### Comenzar AHORA (5 minutos)
1. Leer: [RESUMEN_EJECUTIVO.md](RESUMEN_EJECUTIVO.md) (10 min)
2. Leer: [ANALISIS_RENDIMIENTO.md](ANALISIS_RENDIMIENTO.md) - Solo secciones críticas (15 min)

### Comenzar IMPLEMENTACIÓN (30 minutos)
1. Crear rama: `git checkout -b fix/firestore-queries`
2. Abrir [SOLUCIONES_CODIGO.md](SOLUCIONES_CODIGO.md)#2 (Problema #2 es más rápido)
3. Copiar código de ejemplo en db.js

### Testing (1 hora)
1. Abrir 2 navegadores con aplicación
2. Login en ambos
3. Cambiar desafío en Tab 1
4. Verificar que Tab 2 NO ve el cambio (problema actual)
5. Después de implementar listeners, verificar que SÍ vea cambio

---

## 📞 Contacto para Preguntas

- **Problemas técnicos:** Revisar ANALISIS_RENDIMIENTO.md#[número]
- **Código de ejemplo:** Ver SOLUCIONES_CODIGO.md#[número]
- **Impacto empresarial:** Ver RESUMEN_EJECUTIVO.md
- **Este documento:** Busca en índices arriba

---

## 📅 Fechas Clave

- **Análisis realizado:** Junio 2, 2026
- **Fase 1 recomendada:** Junio 5 - Junio 19, 2026
- **Fase 2 recomendada:** Junio 20 - Julio 3, 2026
- **Revisión post-implementación:** Julio 4, 2026

---

**Documento de Referencia Rápida**  
*Última actualización: Junio 2, 2026*  
*Para detalles, ver documentos específicos listados arriba*
