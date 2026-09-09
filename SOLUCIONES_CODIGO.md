# 🛠️ SOLUCIONES RECOMENDADAS - Ejemplos de Código

## 1. IMPLEMENTAR LISTENERS DE FIRESTORE

### Antes (Sin Listeners - Problema Actual)
```javascript
// db.js línea 445-449
async getPlayersCloud() {
  if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
  const snapshot = await firebaseDb.collection(FIREBASE_COLLECTIONS.players).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
// ❌ Se llama UNA VEZ y nunca se actualiza
```

### Después (Con Listeners - Solución)
```javascript
// db.js - Agregar after line 445
let playersListeners = [];
let cachedPlayers = [];

initPlayersListener() {
  if (!this.isCloudConfigured()) return null;
  
  // Unsubscribe a listeners anteriores
  playersListeners.forEach(unsubscribe => unsubscribe());
  playersListeners = [];
  
  // Crear nuevo listener
  const unsubscribe = firebaseDb
    .collection(FIREBASE_COLLECTIONS.players)
    .onSnapshot(
      snapshot => {
        cachedPlayers = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        // Notificar a listeners locales
        this.dispatchEvent('players-updated', { players: cachedPlayers });
        console.log(`✅ ${cachedPlayers.length} jugadores actualizados`);
      },
      error => {
        console.error('Error en listener de jugadores:', error);
      }
    );
  
  playersListeners.push(unsubscribe);
  return unsubscribe;
},

async getPlayersCloud() {
  // Retorna caché si está disponible
  if (cachedPlayers.length > 0) {
    return cachedPlayers;
  }
  // Si no hay caché, hacer fetch manual
  if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
  const snapshot = await firebaseDb.collection(FIREBASE_COLLECTIONS.players).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
},

// Agregar método para dispatchear eventos
dispatchEvent(eventName, data) {
  const event = new CustomEvent(eventName, { detail: data });
  window.dispatchEvent(event);
},

// Agregar listener de eventos en UI
addEventListener(eventName, callback) {
  window.addEventListener(eventName, (e) => callback(e.detail));
}
```

### Uso en script.js
```javascript
// Inicializar listeners al cargar
document.addEventListener('DOMContentLoaded', () => {
  DB.initPlayersListener();
  DB.initChallengesListener();
  DB.initNewsListener();
  
  // Escuchar actualizaciones
  DB.addEventListener('players-updated', (data) => {
    console.log('Jugadores actualizados:', data.players);
    renderRanking(data.players); // Actualizar UI automáticamente
  });
});
```

---

## 2. ELIMINAR QUERIES DUPLICADAS EN EMAIL LOOKUP

### Antes (3 queries por búsqueda - Problema Actual)
```javascript
// db.js línea 451-490
async findPlayerByEmailCloud(email) {
  const normalized = normalizeEmailForDb(email);
  if (!normalized || !this.isCloudConfigured()) return null;

  try {
    // QUERY 1 ❌
    let snapshot = await firebaseDb
      .collection(FIREBASE_COLLECTIONS.players)
      .where('emailLower', '==', normalized)
      .limit(1)
      .get();
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    // QUERY 2 ❌
    snapshot = await firebaseDb
      .collection(FIREBASE_COLLECTIONS.players)
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    // QUERY 3 ❌
    snapshot = await firebaseDb
      .collection(FIREBASE_COLLECTIONS.players)
      .where('email', '==', normalized)
      .limit(1)
      .get();
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    console.warn('Error:', error);
  }
  return null;
}
```

### Después (1 query - Solución)
```javascript
// db.js línea 451-470 - REEMPLAZAR COMPLETAMENTE
async findPlayerByEmailCloud(email) {
  const normalized = normalizeEmailForDb(email);
  if (!normalized || !this.isCloudConfigured()) return null;

  try {
    // QUERY ÚNICA ✅ (usando índice en emailLower)
    const snapshot = await firebaseDb
      .collection(FIREBASE_COLLECTIONS.players)
      .where('emailLower', '==', normalized)
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    
    // Si no encuentra, retornar null (no buscar más)
    console.warn(`Jugador con email ${email} no encontrado en Firebase`);
    return null;
    
  } catch (error) {
    console.error('Error buscando jugador por email:', error);
    // Intentar fallback a búsqueda local si Firebase falla
    return this.getUsers().find(u => normalizeEmailForDb(u.email) === normalized) || null;
  }
}
```

### Asegurarse de que TODOS los jugadores tengan emailLower
```javascript
// Migration script para Firestore Console o Cloud Functions
async function migrateEmailLowerField() {
  const batch = firebaseDb.batch();
  const snapshot = await firebaseDb.collection('ranking_players').get();
  
  snapshot.forEach(doc => {
    const email = doc.data().email || '';
    const emailLower = normalizeEmailForDb(email);
    
    if (!doc.data().emailLower) {
      batch.update(doc.ref, { emailLower });
    }
  });
  
  await batch.commit();
  console.log('✅ Migración completada');
}
```

### Configurar índice en Firestore
En Firebase Console:
1. Ir a Firestore → Índices
2. Crear índice compuesto para:
   - Collection: `ranking_players`
   - Campos: `emailLower` (Ascending)

---

## 3. AGREGAR PAGINACIÓN A LECTURAS DE COLECCIONES

### getPlayersCloud con Paginación
```javascript
// db.js línea 445-449 - REEMPLAZAR
const PLAYERS_PAGE_SIZE = 100;
let playersLastVisible = null;
let playersPage = 1;

async getPlayersCloud(pageNum = 1) {
  if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
  
  try {
    let query = firebaseDb
      .collection(FIREBASE_COLLECTIONS.players)
      .orderBy('nombre') // Necesita índice compuesto
      .limit(PLAYERS_PAGE_SIZE);
    
    // Calcular offset para la página
    if (pageNum > 1) {
      // Opción 1: Si tenemos caché de páginas anteriores
      if (pageNum === playersPage + 1 && playersLastVisible) {
        query = query.startAfter(playersLastVisible);
      } else {
        // Opción 2: Menos eficiente pero funciona
        query = query.offset((pageNum - 1) * PLAYERS_PAGE_SIZE);
      }
    }
    
    const snapshot = await query.get();
    
    // Guardar para siguiente página
    if (!snapshot.empty) {
      playersLastVisible = snapshot.docs[snapshot.docs.length - 1];
      playersPage = pageNum;
    }
    
    return {
      players: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      hasMore: snapshot.docs.length === PLAYERS_PAGE_SIZE,
      pageNum: pageNum
    };
    
  } catch (error) {
    console.error('Error fetching players:', error);
    throw error;
  }
},

async getAllPlayersCloud() {
  // Para casos donde SÍ necesitas todos (ej: exportar a CSV)
  // Usar batch de múltiples queries
  const allPlayers = [];
  let pageNum = 1;
  let hasMore = true;
  
  while (hasMore) {
    const result = await this.getPlayersCloud(pageNum);
    allPlayers.push(...result.players);
    hasMore = result.hasMore;
    pageNum++;
  }
  
  return allPlayers;
}
```

### getChallengesCloud con Paginación
```javascript
// db.js línea 567-572 - REEMPLAZAR
const CHALLENGES_PAGE_SIZE = 50;

async getChallengesCloud(pageNum = 1, filters = {}) {
  if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
  
  try {
    let query = firebaseDb
      .collection(FIREBASE_COLLECTIONS.challenges)
      .orderBy('creado', 'desc')
      .limit(CHALLENGES_PAGE_SIZE);
    
    // Aplicar filtros si se proporcionan
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters.genero) {
      query = query.where('genero', '==', filters.genero);
    }
    
    // Paginación
    if (pageNum > 1) {
      // Almacenariamos lastVisible por filtro en un Map
      // Por simplicidad, aquí usamos offset
      query = query.offset((pageNum - 1) * CHALLENGES_PAGE_SIZE);
    }
    
    const snapshot = await query.get();
    
    return {
      challenges: snapshot.docs
        .map(doc => normalizeChallengeRecord({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')),
      hasMore: snapshot.docs.length === CHALLENGES_PAGE_SIZE,
      pageNum: pageNum,
      total: snapshot.size
    };
    
  } catch (error) {
    console.error('Error fetching challenges:', error);
    throw error;
  }
}
```

### Uso en UI (script.js)
```javascript
let currentPage = 1;
const pageSize = 50;

async function loadMoreChallenges() {
  try {
    const result = await DB.getChallengesCloud(currentPage, { 
      status: 'pendiente',
      genero: 'M' 
    });
    
    // Agregar a la lista existente
    displayChallenges(result.challenges);
    
    // Mostrar botón "Más" si hay más datos
    if (result.hasMore) {
      document.getElementById('loadMoreBtn').style.display = 'block';
      currentPage++;
    } else {
      document.getElementById('loadMoreBtn').style.display = 'none';
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

## 4. OPTIMIZAR GOOGLE SHEETS LECTURA

### Antes (Lee TODO - Problema Actual)
```javascript
// apps_script_backend.js línea 528-545
function getChallenges() {
  const sheet = getChallengesSheet();
  const values = sheet.getDataRange().getValues();  // ❌ Lee TODO
  const challenges = [];
  
  values.forEach((row, i) => {
    if (i === 0) return;
    const challenge = challengeFromRow(row);
    if (!challenge.id || challenge.id === 'ID') return;
    challenges.push(challenge);
  });
  
  return { ok: true, challenges };
}
```

### Después (Lectura Limitada - Solución)
```javascript
// apps_script_backend.js línea 528-560 - REEMPLAZAR
const MAX_CHALLENGES_PER_FETCH = 500; // Limitar a 500 por fetch
const CHALLENGES_CACHE = {};
let CHALLENGES_CACHE_TIME = 0;
const CHALLENGES_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

function getChallenges(page = 1) {
  const sheet = getChallengesSheet();
  const lastRow = sheet.getLastRow();
  
  // Verificar si caché es válido
  if (CHALLENGES_CACHE.data && (Date.now() - CHALLENGES_CACHE_TIME) < CHALLENGES_CACHE_DURATION_MS) {
    Logger.log('✅ Usando caché de desafíos');
    return { ok: true, challenges: CHALLENGES_CACHE.data, fromCache: true };
  }
  
  // Calcular rango de lectura
  const headerRow = 1;
  const startRow = Math.max(2, (page - 1) * MAX_CHALLENGES_PER_FETCH + 2);
  const rowsToRead = Math.min(MAX_CHALLENGES_PER_FETCH, lastRow - startRow + 1);
  
  if (rowsToRead <= 0) {
    return { ok: true, challenges: [] };
  }
  
  // Leer SOLO el rango necesario
  const values = sheet.getRange(startRow, 1, rowsToRead, 30).getValues();
  const challenges = [];
  
  values.forEach((row, i) => {
    const challenge = challengeFromRow(row);
    if (challenge && challenge.id && challenge.id !== 'ID') {
      challenges.push(challenge);
    }
  });
  
  // Guardar en caché
  CHALLENGES_CACHE.data = challenges;
  CHALLENGES_CACHE_TIME = Date.now();
  
  return {
    ok: true,
    challenges: challenges,
    pageSize: MAX_CHALLENGES_PER_FETCH,
    pageNum: page,
    totalRows: lastRow - headerRow,
    hasMore: (page * MAX_CHALLENGES_PER_FETCH) < lastRow
  };
}

// Función para limpiar caché (llamar después de actualizaciones)
function invalidateChallengesCache() {
  CHALLENGES_CACHE_TIME = 0;
  Logger.log('✅ Caché de desafíos invalidado');
}
```

### Mejorar operaciones que llaman a getChallenges
```javascript
// apps_script_backend.js línea 171 - respondChallenge
function respondChallenge(data) {
  const challengeId = text(data.challengeId);
  const response = text(data.response); // 'accept' o 'reject'
  
  const result = getChallenges(1); // ✅ Ahora paginado
  if (!result.ok) return result;
  
  const challenge = result.challenges.find(c => c.id === challengeId);
  if (!challenge) return { ok: false, msg: 'Desafío no encontrado.' };
  
  // ... resto del código
  
  // Invalidar caché después de actualizar
  invalidateChallengesCache();
  
  return { ok: true, msg: 'Desafío respondido.' };
}
```

---

## 5. IMPLEMENTAR CACHÉ INTELIGENTE PARA RANKING

### Antes (Sin Caché efectivo - Problema Actual)
```javascript
// script.js línea 273-298
async function loadRanking() {
  const response = await fetch(
    `${CONFIG.API_URL}?action=get_ranking&v=${new Date().getTime()}`  // ❌ &v= fuerza bypass
  );
  const data = await response.json();
  allPlayersData = data.players;
}
```

### Después (Con Caché Smart - Solución)
```javascript
// script.js - Agregar arriba de loadRanking()
const RANKING_CACHE = {
  data: null,
  time: 0,
  duration: 5 * 60 * 1000 // 5 minutos
};

function isRankingCacheValid() {
  if (!RANKING_CACHE.data) return false;
  return (Date.now() - RANKING_CACHE.time) < RANKING_CACHE.duration;
}

function saveToCache(data) {
  RANKING_CACHE.data = data;
  RANKING_CACHE.time = Date.now();
}

function getRankingFromCache() {
  return isRankingCacheValid() ? RANKING_CACHE.data : null;
}

async function loadRanking(forceRefresh = false) {
  try {
    const lastUpdatedEl = document.getElementById('lastUpdatedDate');
    
    // ✅ Verificar caché primero
    if (!forceRefresh) {
      const cached = getRankingFromCache();
      if (cached) {
        if (lastUpdatedEl) {
          lastUpdatedEl.innerHTML = `Actualizado hace ${Math.round((Date.now() - RANKING_CACHE.time) / 1000)}s (caché)`;
        }
        allPlayersData = cached.players;
        renderTable('M', cached.players.filter(p => p.gender === 'M'));
        renderTable('F', cached.players.filter(p => p.gender === 'F'));
        return cached;
      }
    }
    
    if (lastUpdatedEl) lastUpdatedEl.innerHTML = 'Actualizando...';
    
    // Fetch sin &v= para aprovechar HTTP caché también
    const response = await fetch(`${CONFIG.API_URL}?action=get_ranking`);
    const data = await response.json();
    
    if (data.ok) {
      saveToCache(data.players); // ✅ Guardar en caché
      allPlayersData = data.players;
      
      renderTable('M', data.players.filter(p => p.gender === 'M'));
      renderTable('F', data.players.filter(p => p.gender === 'F'));
      
      if (lastUpdatedEl) {
        lastUpdatedEl.innerHTML = `Actualizado ahora (${data.players.length} jugadores)`;
      }
      
      return data;
    }
  } catch (err) {
    console.error('Error loading ranking:', err);
    document.getElementById('loadingM').innerHTML = `<div class="error-message">Error: ${err.message}</div>`;
  }
}

// Limpiar caché manualmente si es necesario
function invalidateRankingCache() {
  RANKING_CACHE.data = null;
  RANKING_CACHE.time = 0;
}

// Invalidar caché al enviar un resultado
async function submitChallengeResult(data) {
  // ... enviar resultado
  invalidateRankingCache(); // ✅ Limpiar caché cuando datos cambian
  await loadRanking(true); // Recargar con forceRefresh=true
}
```

---

## 6. MEJORAR LOCALSTORAGE CON VALIDACIÓN

### Crear abstracción de caché con TTL
```javascript
// db.js - Agregar nuevo módulo de caché
const DB_CACHE = {
  // Prefix para diferenciar de otros datos en localStorage
  PREFIX: 'uct_cache_',
  
  // Guardar con expiry
  set(key, value, ttlMinutes = 60) {
    try {
      const cacheKey = this.PREFIX + key;
      const expiry = Date.now() + (ttlMinutes * 60 * 1000);
      const data = JSON.stringify({ value, expiry });
      localStorage.setItem(cacheKey, data);
      return true;
    } catch (error) {
      console.warn(`No se pudo guardar caché ${key}:`, error);
      return false;
    }
  },
  
  // Obtener si no ha expirado
  get(key) {
    try {
      const cacheKey = this.PREFIX + key;
      const data = localStorage.getItem(cacheKey);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      if (Date.now() > parsed.expiry) {
        // Ha expirado, eliminar
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      return parsed.value;
    } catch (error) {
      console.warn(`Error leyendo caché ${key}:`, error);
      return null;
    }
  },
  
  // Eliminar manualmente
  remove(key) {
    try {
      const cacheKey = this.PREFIX + key;
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn(`Error eliminando caché ${key}:`, error);
    }
  },
  
  // Limpiar TODO el caché
  clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log('✅ Caché limpiado');
    } catch (error) {
      console.warn('Error limpiando caché:', error);
    }
  }
};

// Usar en lugar de localStorage directo
// Antes:
// localStorage.setItem('uctenis_ranking_m', JSON.stringify(players));
// allPlayersData = JSON.parse(localStorage.getItem('uctenis_ranking_m'));

// Después:
DB_CACHE.set('ranking_m', players, 30); // 30 minutos TTL
allPlayersData = DB_CACHE.get('ranking_m'); // Retorna null si expiró

// En logout:
DB.logout = function() {
  DB_CACHE.clear(); // Limpiar TODO el caché
  localStorage.removeItem('uctenis_session');
  // ... resto del logout
}
```

---

## 7. CHECKLIST DE IMPLEMENTACIÓN

```markdown
## Implementación Paso a Paso

### Fase 1: CRÍTICA (Semana 1-2)

- [ ] 1.1. Backup de producción
- [ ] 1.2. Crear rama `feature/firestore-listeners`
- [ ] 1.3. Implementar `DB.initPlayersListener()`
- [ ] 1.4. Implementar `DB.initChallengesListener()`
- [ ] 1.5. Actualizar handlers de eventos en script.js
- [ ] 1.6. Pruebas de multi-usuario (2 navegadores)
- [ ] 1.7. Refactor `findPlayerByEmailCloud()` - query única
- [ ] 1.8. Merge a main

### Fase 2: IMPORTANTE (Semana 3-4)

- [ ] 2.1. Agregar índices en Firestore
- [ ] 2.2. Implementar paginación en `getPlayersCloud()`
- [ ] 2.3. Implementar paginación en `getChallengesCloud()`
- [ ] 2.4. Optimizar Google Sheets lectura
- [ ] 2.5. Implementar DB_CACHE module
- [ ] 2.6. Pruebas de carga (1000+ registros)

### Fase 3: OPTIMIZACIÓN (Semana 5+)

- [ ] 3.1. Implementar Cloud Functions para lógica pesada
- [ ] 3.2. Agregar Cloud Messaging (push notifications)
- [ ] 3.3. Monitoreo de Firestore (Firebase Console)
- [ ] 3.4. Optimizar índices basado en usage patterns
```

---

**Nota:** Estos ejemplos de código son punto de partida. Adaptar según arquitectura específica del proyecto.
