/* UCTenis - Base de datos local + Firebase */

if (typeof window.CONFIG === 'undefined') {
  window.CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbzlzQPYAW_pz4IKdrZqNwjzkKSkvX5gJ6-2_MNteGWW_fDPNPPkkyFBVpy3gpRlV2TG/exec"
  };
}

// =========================================================================
// ⚙️ CONFIGURACIÓN DE FIREBASE (Creado desde uctenisclub@gmail.com)
// =========================================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDxNdwD8hHQmN2efhRwflL7RkpC-RFs3ow",
  authDomain: "uctenis-club.firebaseapp.com",
  projectId: "uctenis-club",
  storageBucket: "uctenis-club.firebasestorage.app",
  messagingSenderId: "223552986034",
  appId: "1:223552986034:web:13b34a6a246fb254eca2ab",
  measurementId: "G-2NKXS8BMNC"
};

let firebaseAuth = null;
let firebaseDb = null;
if (typeof firebase !== 'undefined') {
  if (FIREBASE_CONFIG.apiKey !== "TU_API_KEY") {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      firebaseAuth = firebase.auth();
      if (typeof firebase.firestore === 'function') {
        firebaseDb = firebase.firestore();
      }
      console.log("Firebase Auth inicializado correctamente.");
    } catch (e) {
      console.error("Error al inicializar Firebase:", e);
    }
  } else {
    console.warn("Firebase no configurado. El sistema funcionará en Modo Simulación/Demo para pruebas locales.");
  }
}

// El SDK de Firebase restaura la sesión persistida de forma asíncrona tras
// cargar la página; sin esperar esto, getIdToken() puede devolver null por
// una carrera con la carga (no por una sesión realmente vencida).
let _authReadyResolve;
const _authReadyPromise = new Promise(resolve => { _authReadyResolve = resolve; });
if (firebaseAuth) {
  firebaseAuth.onAuthStateChanged(user => { _authReadyResolve(user); });
} else {
  _authReadyResolve(null);
}

const FIREBASE_COLLECTIONS = {
  players: 'ranking_players',
  challenges: 'ranking_challenges',
  news: 'ranking_news',
  staff: 'uct_staff',           // Funcionarios UCT (solo reservas, sin ranking)
  config: 'uct_config',         // Parámetros editables por el admin (horarios, anticipación, etc.)
  bookings: 'court_bookings'    // Fuente principal; Google Calendar es su proyección
};

// ── Horarios y parámetros de reserva por defecto ────────────────────────────
// Reflejan lo que hoy está hardcodeado en apps_script_backend.js (CONFIG.SLOTS,
// CONFIG.COURT_SLOTS, MAX_ADVANCE_MS). Se usan para prellenar el panel de admin
// cuando todavía no existe un documento uct_config/schedule en Firestore, y el
// backend cae a estos mismos valores si Firestore no responde.
const DEFAULT_SLOTS = ['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00'];
const DEFAULT_COURT_SLOTS = {
  cec1: { 1:['18:00','19:30','21:00'], 2:['18:00','19:30','21:00'], 3:['18:00','19:30','21:00'], 4:['18:00','19:30','21:00'], 5:['18:00','19:30','21:00'], 6:DEFAULT_SLOTS, 0:[] },
  cec2: { 1:['18:00','19:30','21:00'], 2:['18:00','19:30','21:00'], 3:['18:00','19:30','21:00'], 4:['18:00','19:30','21:00'], 5:['18:00','19:30','21:00'], 6:DEFAULT_SLOTS, 0:[] },
  cjp1: { 1:['20:00'], 2:['18:00','19:30','21:00'], 3:['18:00','19:30','21:00'], 4:['18:00','19:30','21:00'], 5:['20:00'], 6:DEFAULT_SLOTS, 0:[] },
  cjp2: { 1:['20:00'], 2:['18:00','19:30','21:00'], 3:['18:00','19:30','21:00'], 4:['18:00','19:30','21:00'], 5:['20:00'], 6:DEFAULT_SLOTS, 0:[] }
};
const DEFAULT_MAX_ADVANCE_DAYS = { admin: 7, socio: 7, funcionario: 2 };
const DEFAULT_MAX_BOOKINGS_PER_DAY = 1;
window.DEFAULT_SLOTS = DEFAULT_SLOTS;
window.DEFAULT_COURT_SLOTS = DEFAULT_COURT_SLOTS;
window.DEFAULT_MAX_ADVANCE_DAYS = DEFAULT_MAX_ADVANCE_DAYS;
window.DEFAULT_MAX_BOOKINGS_PER_DAY = DEFAULT_MAX_BOOKINGS_PER_DAY;

// ── Anticipación máxima de reserva por tipo de usuario ──────────────────────
const MAX_ADVANCE_MS = {
  admin:       7 * 24 * 60 * 60 * 1000,   // 7 días
  socio:       7 * 24 * 60 * 60 * 1000,   // 7 días
  funcionario: 48 * 60 * 60 * 1000        // 48 horas
};
window.MAX_ADVANCE_MS = MAX_ADVANCE_MS;

const DB_FIREBASE_ADMIN_EMAILS = ['uctenisclub@gmail.com', 'dsilva@uct.cl'];
const DB_PURE_ADMIN_EMAILS     = ['uctenisclub@gmail.com'];

function normalizeEmailForDb(email) {
  return String(email || '').trim().toLowerCase();
}

const DB_STATIC_ACCESS_PLAYERS = [
  { id: 'm001', nombre: 'David Silva', email: 'dsilva@uct.cl', genero: 'M', categoria: '3ra', foto: 'fotos/m001.png' },
  { id: 'm002', nombre: 'Ismael Devia', email: 'idevia@uct.cl', genero: 'M', categoria: '3ra', foto: 'fotos/m002.png' },
  { id: 'm005', nombre: 'Miguel Escalona', email: 'mescalon@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m005.png' },
  { id: 'm004', nombre: 'Luis Otth', email: 'lotth@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m004.png' },
  { id: 'm009', nombre: 'Gustavo Curaqueo', email: 'gcuraqueo@uct.cl', genero: 'M', categoria: 'Principiante', foto: 'fotos/m009.png' },
  { id: 'm011', nombre: 'Jaime Castillo', email: 'jcastill@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m011.png' },
  { id: 'm007', nombre: 'Matias Caceres', email: 'mcaceres@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m007.png' },
  { id: 'm006', nombre: 'Rodrigo Castro', email: 'rcastro@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m006.png' },
  { id: 'm017', nombre: 'Klaus Hennicke', email: 'khennicke@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m017.png' },
  { id: 'm016', nombre: 'Jose Melgarejo', email: 'jmelgarejo@uct.cl', genero: 'M', categoria: '3ra', foto: 'fotos/m016.png' },
  { id: 'm008', nombre: 'Juan Maripillan', email: 'jmaripillan@uct.cl', genero: 'M', categoria: '', foto: 'fotos/m008.png' },
  { id: 'm010', nombre: 'Cristian Rebolledo', email: 'crebolledo@uct.cl', genero: 'M', categoria: 'Principiante', foto: 'fotos/m010.png' },
  { id: 'm003', nombre: 'Francisco Encina', email: 'fencina@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m003.png' },
  { id: 'm012', nombre: 'Cristian Farias', email: 'cristian.farias@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m012.png' },
  { id: 'm015', nombre: 'Miguel Angulo', email: 'miguel.angulo@uct.cl', genero: 'M', categoria: '3ra', foto: 'fotos/m015.png' },
  { id: 'm018', nombre: 'Roberto Bermudez', email: 'profesorbermudez@gmail.com', genero: 'M', categoria: '1ra', foto: 'fotos/m018.png' },
  { id: 'm013', nombre: 'Francisco Munoz', email: 'francisco.munoz@uct.cl', genero: 'M', categoria: '', foto: 'fotos/m013.png' },
  { id: 'm014', nombre: 'Pablo Lagos', email: 'pablo.lagos@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m014.png' },
  { id: 'm031', nombre: 'Paulo Garrido', email: 'pgarrido@uct.cl', genero: 'M', categoria: '4ta', foto: 'fotos/m031.png' },
  { id: 'f002', nombre: 'Violeta Moreno', email: 'vmoreno@uct.cl', genero: 'F', categoria: 'Principiante', foto: 'fotos/f002.png' },
  { id: 'f001', nombre: 'Sofia Silva', email: 'ssilvacastillo08@gmail.com', genero: 'F', categoria: 'Principiante', foto: 'fotos/f001.png' },
  { id: 'f006', nombre: 'Rocio Hernandez', email: 'rocio.hernandez@uct.cl', genero: 'F', categoria: 'Principiante', foto: 'fotos/f006.png' },
  { id: 'f003', nombre: 'Fernanda Silva', email: 'ferniwendy@gmail.com', genero: 'F', categoria: 'Principiante', foto: 'fotos/f003.png' },
  { id: 'f005', nombre: 'Baleria Schatter', email: 'vschatter@uct.cl', genero: 'F', categoria: 'Principiante', foto: 'fotos/f005.png' },
  { id: 'f004', nombre: 'Sandra Arenas', email: 'sarenas@uct.cl', genero: 'F', categoria: '', foto: 'fotos/f004.png' },
  { id: 'f008', nombre: 'Carolina Cardenas', email: 'ccardeneas@uct.cl', genero: 'F', categoria: 'Principiante', foto: 'fotos/f008.png' },
  { id: 'f011', nombre: 'Carla Iglesias', email: 'ciglesias@uct.cl', genero: 'F', categoria: 'Principiante', foto: 'fotos/f011.png' }
];

function isAccessPlayerActive(player) {
  if (!player) return false;
  return player.activo !== false &&
    player.activo !== 'false';
}

function cleanFirestoreData(data) {
  const out = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

const CHALLENGE_RESPONSE_MS = 48 * 60 * 60 * 1000;
const CHALLENGE_RESULT_CONFIRM_MS = 48 * 60 * 60 * 1000;
const CHALLENGE_ACTIVE_STATUSES = ['pendiente', 'aceptado', 'resultado_pendiente'];
const CHALLENGE_HISTORY_STATUSES = ['completado', 'wo_retador', 'wo_retado', 'vencido', 'rechazado'];
const CHALLENGE_OFFICIAL_STATUSES = [
  ...CHALLENGE_ACTIVE_STATUSES,
  ...CHALLENGE_HISTORY_STATUSES
];

window.UCTENNIS_CHALLENGE_RULES = {
  RESPONSE_MS: CHALLENGE_RESPONSE_MS,
  RESULT_CONFIRM_MS: CHALLENGE_RESULT_CONFIRM_MS,
  ACTIVE_STATUSES: CHALLENGE_ACTIVE_STATUSES,
  HISTORY_STATUSES: CHALLENGE_HISTORY_STATUSES,
  OFFICIAL_STATUSES: CHALLENGE_OFFICIAL_STATUSES
};

function hasRecordedChallengeResult(challenge) {
  return Boolean(
    String(challenge?.marcador || '').trim() ||
    String(challenge?.ganadorId || '').trim()
  );
}

function challengeTimestamp(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

function isChallengeResultDisputed(challenge) {
  return Boolean(
    challenge?.resultadoReclamado === true ||
    challenge?.resultadoReclamado === 'true' ||
    String(challenge?.reclamoResultado || '').trim()
  );
}

function normalizeChallengeRecord(challenge) {
  const normalized = { ...(challenge || {}) };
  const now = Date.now();

  if (!normalized.status) {
    normalized.status = hasRecordedChallengeResult(normalized) ? 'completado' : 'pendiente';
  } else if (normalized.status === 'terminado') {
    normalized.status = hasRecordedChallengeResult(normalized) ? 'completado' : 'aceptado';
  }

  if (!CHALLENGE_OFFICIAL_STATUSES.includes(normalized.status) && normalized.status !== 'eliminado') {
    normalized.status = hasRecordedChallengeResult(normalized) ? 'completado' : 'pendiente';
  }

  if (hasRecordedChallengeResult(normalized) && !normalized.fechaResultado) {
    normalized.fechaResultado = normalized.actualizado || normalized.updatedAt || normalized.creado || new Date().toISOString();
  }

  if (normalized.status === 'pendiente') {
    const createdAt = challengeTimestamp(normalized.creado || normalized.createdAt || normalized.actualizado);
    if (createdAt && now - createdAt >= CHALLENGE_RESPONSE_MS) {
      normalized.status = 'vencido';
      normalized.actualizado = normalized.actualizado || new Date().toISOString();
    }
  }

  if (normalized.status === 'resultado_pendiente' && !isChallengeResultDisputed(normalized)) {
    const resultAt = challengeTimestamp(normalized.fechaResultado || normalized.actualizado);
    if (resultAt && now - resultAt >= CHALLENGE_RESULT_CONFIRM_MS) {
      normalized.status = 'completado';
      normalized.confirmadoAutomaticamente = true;
      normalized.fechaConfirmacion = normalized.fechaConfirmacion || new Date().toISOString();
      normalized.actualizado = normalized.fechaConfirmacion;
    }
  }

  return normalized;
}

function makeFirebaseDocId(value, prefix = 'doc') {
  const base = String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `${prefix}-${Date.now()}`;
}

function formatPhoneNumber(num) {
  let cleaned = String(num || '').replace(/[^0-9]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('569')) {
    return '+' + cleaned;
  }
  if (cleaned.length === 9 && cleaned.startsWith('9')) {
    return '+56' + cleaned;
  }
  if (cleaned.length === 8) {
    return '+569' + cleaned;
  }
  if (cleaned.startsWith('56')) {
    return '+' + cleaned;
  }
  return '+569' + cleaned;
}

function playerToSessionUser(player, current = {}) {
  const email = player.email || current.email || '';
  const isPermanentAdmin = DB_FIREBASE_ADMIN_EMAILS.some(adminEmail =>
    normalizeEmailForDb(adminEmail) === normalizeEmailForDb(email)
  );
  return {
    ...(current || {}),
    id: player.id || current.id || '',
    nombre: player.nombre || current.nombre || '',
    email,
    genero: player.genero || player.gender || current.genero || '',
    categoria: normalizeCategoryForDb(player.categoria || current.categoria || 'Principiante'),
    mano: player.mano || player.manoHabil || current.mano || 'Derecha',
    reves: player.reves || current.reves || 'Dos manos',
    foto: player.foto || current.foto || '',
    telefono: player.telefono || current.telefono || '',
    rut: player.rut || current.rut || '',
    userType: player.userType || current.userType || 'socio',
    unidad: player.unidad || current.unidad || '',
    isAdmin: isPermanentAdmin || player.isAdmin === true ||
      (player.isAdmin === undefined && current.isAdmin === true),
    readOnly: false,
    password: current.password || 'google-auth-no-pass'
  };
}

function normalizeCategoryForDb(value) {
  const raw = String(value || '').trim();
  return raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'abierta'
    ? 'Principiante'
    : raw;
}

// ──────────────── VARIABLES GLOBALES PARA LISTENERS ────────────────
let playersListeners = [];
let challengesListeners = [];
let newsListeners = [];
let staffListeners = [];
let cachedPlayers = [];
let cachedChallenges = [];
let cachedNews = [];
let cachedStaff = [];

// Caché en memoria de disponibilidad de canchas por fecha (Apps Script tiene
// latencia alta, hasta unos segundos por cold start). TTL corto para no mostrar
// horarios desactualizados si alguien más reserva en ese rango.
const SLOTS_CACHE_TTL_MS = 30 * 1000;
const slotsCache = new Map();

const DB = {

  // ──────────────── USUARIOS ────────────────
  getUsers() {
    return JSON.parse(localStorage.getItem('uctenis_users') || '[]')
      .map(user => ({ ...user, categoria: normalizeCategoryForDb(user.categoria || 'Principiante') }));
  },
  saveUsers(users) {
    localStorage.setItem('uctenis_users', JSON.stringify(users));
  },
  upsertUserLocal(user) {
    const users = this.getUsers();
    const email = normalizeEmailForDb(user.email);
    const idx = users.findIndex(item =>
      item.id === user.id ||
      (email && normalizeEmailForDb(item.email) === email)
    );
    if (idx >= 0) users[idx] = { ...users[idx], ...user };
    else users.push(user);
    this.saveUsers(users);
    return user;
  },
  registerUser(data) {
    const users = this.getUsers();
    if (users.find(u => u.email === data.email)) return { ok: false, msg: 'El correo ya está registrado.' };

    let targetId = data.id;
    if (!targetId) {
      const prefix = String(data.genero || '').trim().toUpperCase() === 'F' ? 'f' : 'm';
      let max = 0;

      // 1. Buscar en cachedPlayers (si están cargados)
      if (typeof cachedPlayers !== 'undefined' && Array.isArray(cachedPlayers)) {
        cachedPlayers.forEach(p => {
          const match = String(p.id || '').match(new RegExp('^' + prefix + '(\\d+)$', 'i'));
          if (match) max = Math.max(max, Number(match[1]));
        });
      }

      // 2. Buscar en los usuarios locales
      users.forEach(p => {
        const match = String(p.id || '').match(new RegExp('^' + prefix + '(\\d+)$', 'i'));
        if (match) max = Math.max(max, Number(match[1]));
      });

      // 3. Buscar en el ranking estático oficial
      if (typeof OFFICIAL_STATIC_RANKING !== 'undefined') {
        const list = [
          ...(OFFICIAL_STATIC_RANKING.M || []),
          ...(OFFICIAL_STATIC_RANKING.F || [])
        ];
        list.forEach(p => {
          const match = String(p.id || '').match(new RegExp('^' + prefix + '(\\d+)$', 'i'));
          if (match) max = Math.max(max, Number(match[1]));
        });
      }

      targetId = prefix + String(max + 1).padStart(3, '0');
    }

    const user = {
      id: targetId,
      nombre: data.nombre,
      email: data.email,
      password: data.password || 'google-auth-no-pass',
      genero: data.genero, // 'M' o 'F'
      categoria: normalizeCategoryForDb(data.categoria || 'Principiante'),
      mano: data.mano || 'Derecha',
      reves: data.reves || 'Dos manos',
      foto: data.foto || '',
      telefono: data.telefono || '',
      rut: data.rut || '',
      userType: data.userType || 'socio',
      unidad: data.unidad || '',
      creado: new Date().toISOString()
    };
    users.push(user);
    this.saveUsers(users);
    return { ok: true, user };
  },

  // ──────────────── REGISTRO Y VALIDACIÓN CON FIREBASE ────────────────
  isCloudConfigured() {
    return firebaseDb !== null;
  },

  isAllowedAccessEmail(email) {
    const normalized = normalizeEmailForDb(email);
    return DB_FIREBASE_ADMIN_EMAILS.some(adm => normalizeEmailForDb(adm) === normalized);
  },

  findStaticAccessPlayerByEmail(email) {
    const normalized = normalizeEmailForDb(email);
    if (!normalized) return null;

    const official = [];
    if (typeof OFFICIAL_STATIC_RANKING !== 'undefined') {
      official.push(...(OFFICIAL_STATIC_RANKING.M || []), ...(OFFICIAL_STATIC_RANKING.F || []));
    }

    return [...official, ...DB_STATIC_ACCESS_PLAYERS]
      .find(player => normalizeEmailForDb(player.email) === normalized && isAccessPlayerActive(player)) || null;
  },

  async validateMemberBackend(email) {
    if (!window.CONFIG?.API_URL || !email) return null;

    try {
      const params = new URLSearchParams({ action: 'validate_member', email });
      const response = await fetch(`${window.CONFIG.API_URL}?${params.toString()}`);
      const data = await response.json().catch(() => null);
      if (data && data.ok) return data;
    } catch (error) {
      console.warn('No se pudo validar correo contra Apps Script:', error);
    }

    return null;
  },

  async validateMemberAPI(email) {
    if (!email) return { ok: false, msg: 'Correo no proporcionado.' };
    
    // Usar getUserAccess para resolver el tipo de acceso y perfil
    const access = await this.getUserAccess(email);
    if (access.allowed) {
      if (access.userType === 'admin') {
        return { ok: true, source: 'admin', isAdmin: true };
      }
      if (access.userType === 'invitado') {
        return { ok: true, source: 'uct_domain', userType: 'invitado', readOnly: true, isAdmin: false };
      }
      return {
        ok: true,
        source: access.userType === 'socio' ? 'firebase' : 'staff',
        player: access.profile,
        userType: access.userType,
        isAdmin: false
      };
    }

    const localUser = this.getUsers().find(user => normalizeEmailForDb(user.email) === normalizeEmailForDb(email));
    if (localUser && isAccessPlayerActive(localUser)) {
      return { ok: true, source: 'local', player: localUser, userType: localUser.userType || 'socio' };
    }

    return { ok: false, msg: 'Acceso restringido a jugadores UCTenis registrados en Firebase.' };
  },

  async registerUserAPI(data) {
    const validation = await this.validateMemberAPI(data.email);
    if (!validation.ok) return validation;
    return this.registerUser(data);
  },

  // ──────────────── INGRESO CON GOOGLE Y SESIONES ────────────────
  isFirebaseConfigured() {
    return firebaseAuth !== null;
  },

  isProfileComplete(user) {
    if (!user) return false;
    if (user.isAdmin) return true; // El admin principal no requiere completar ranking
    if (user.userType === 'invitado') return true; // Acceso de solo lectura, no requiere ficha de jugador

    // Campos comunes requeridos para todos (Socio y Funcionario)
    if (!user.nombre || !user.email || !user.genero || !user.telefono || !user.rut) {
      return false;
    }
    
    // Limpieza de espacios
    if (!String(user.nombre).trim() || !String(user.telefono).trim() || !String(user.rut).trim()) {
      return false;
    }

    const userType = user.userType || 'socio';
    if (userType === 'socio') {
      if (!user.categoria || !user.mano || !user.reves) {
        return false;
      }
    } else if (userType === 'funcionario') {
      if (!user.unidad || !String(user.unidad).trim()) {
        return false;
      }
    }
    return true;
  },

  async loginWithGoogle() {
    if (!this.isFirebaseConfigured()) {
      return { ok: false, demo: true, msg: 'Firebase no configurado. Abre la consola de desarrollo o edita db.js para conectar tu Firebase real.' };
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebaseAuth.signInWithPopup(provider);
      const user = result.user;

      const isConfiguredAdmin = DB_FIREBASE_ADMIN_EMAILS.some(adm => normalizeEmailForDb(adm) === normalizeEmailForDb(user.email));
      if (isConfiguredAdmin) {
        const playerProfile = this.findStaticAccessPlayerByEmail(user.email);
        const adminUser = playerProfile
          ? playerToSessionUser(playerProfile, {
              email: user.email,
              nombre: user.displayName || playerProfile.nombre,
              foto: user.photoURL || playerProfile.foto || ''
            })
          : {
              id: makeFirebaseDocId(user.email, 'admin'),
              nombre: user.displayName || 'Administrador UCTenis',
              email: user.email,
              genero: 'M',
              categoria: 'Primera',
              foto: user.photoURL || '',
              telefono: '',
              userType: 'admin'
            };
        adminUser.isAdmin = true;
        adminUser.readOnly = false;
        adminUser.userType = playerProfile ? 'socio' : 'admin';
        this.upsertUserLocal(adminUser);
        localStorage.setItem('uctenis_session', JSON.stringify(adminUser));
        return { ok: true, user: adminUser, isNew: false };
      }

      const validation = await this.validateMemberAPI(user.email);
      if (!validation.ok) {
        await firebaseAuth.signOut();
        return { ok: false, msg: validation.msg };
      }

      if (validation.userType === 'invitado') {
        const guestUser = {
          id: makeFirebaseDocId(user.email, 'guest'),
          nombre: user.displayName || '',
          email: user.email,
          foto: user.photoURL || '',
          userType: 'invitado',
          readOnly: true
        };
        localStorage.setItem('uctenis_session', JSON.stringify(guestUser));
        return { ok: true, user: guestUser, isNew: false, readOnly: true };
      }

      const localUsers = this.getUsers();
      let localUser = localUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase());

      const cloudPlayer = validation.player;
      if (cloudPlayer) {
        const userType = cloudPlayer.userType || validation.userType || 'socio';
        localUser = playerToSessionUser(cloudPlayer, {
          ...(localUser || {}),
          email: user.email,
          nombre: user.displayName || cloudPlayer.nombre || (localUser && localUser.nombre) || '',
          foto: user.photoURL || cloudPlayer.foto || (localUser && localUser.foto) || '',
          userType: userType
        });
        if (userType === 'funcionario') {
          localUser.unidad = cloudPlayer.unidad || '';
        }
        this.upsertUserLocal(localUser);
        localStorage.setItem('uctenis_session', JSON.stringify(localUser));
        return { ok: true, user: localUser, isNew: false };
      }

      if (localUser) {
        localStorage.setItem('uctenis_session', JSON.stringify(localUser));
        return { ok: true, user: localUser, isNew: false };
      }

      // Si fue validado por Sheets/Ranking pero no existe ficha en Firebase aún, permitir registro/vinculación
      return {
        ok: true,
        isNew: true,
        email: user.email,
        nombre: user.displayName || '',
        foto: user.photoURL || ''
      };
    } catch (error) {
      console.error('Error en Google Sign-in:', error);
      return { ok: false, msg: 'Error de autenticación con Google: ' + error.message };
    }
  },

  async loginWithGoogleMock(email, nombre) {
    const normalized = normalizeEmailForDb(email);
    const isConfiguredAdmin = DB_FIREBASE_ADMIN_EMAILS.some(adm => normalizeEmailForDb(adm) === normalized);
    if (isConfiguredAdmin) {
      const playerProfile = this.findStaticAccessPlayerByEmail(email);
      const adminUser = playerProfile
        ? playerToSessionUser(playerProfile, { email, nombre: nombre || playerProfile.nombre })
        : {
            id: makeFirebaseDocId(email, 'admin'),
            nombre: nombre || 'Administrador UCTenis',
            email: email,
            genero: 'M',
            categoria: 'Primera',
            foto: '',
            telefono: '',
            userType: 'admin'
          };
      adminUser.isAdmin = true;
      adminUser.readOnly = false;
      adminUser.userType = playerProfile ? 'socio' : 'admin';
      this.upsertUserLocal(adminUser);
      localStorage.setItem('uctenis_session', JSON.stringify(adminUser));
      return { ok: true, user: adminUser, isNew: false };
    }

    const validation = await this.validateMemberAPI(email);
    if (!validation.ok) {
      return { ok: false, msg: validation.msg };
    }

    if (validation.userType === 'invitado') {
      const guestUser = {
        id: makeFirebaseDocId(email, 'guest'),
        nombre: nombre || email.split('@')[0],
        email: email,
        foto: '',
        userType: 'invitado',
        readOnly: true
      };
      localStorage.setItem('uctenis_session', JSON.stringify(guestUser));
      return { ok: true, user: guestUser, isNew: false, readOnly: true };
    }

    const localUsers = this.getUsers();
    let localUser = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    const cloudPlayer = validation.player;
    if (cloudPlayer) {
      const userType = cloudPlayer.userType || validation.userType || 'socio';
      localUser = playerToSessionUser(cloudPlayer, {
        ...(localUser || {}),
        email,
        nombre: nombre || cloudPlayer.nombre || (localUser && localUser.nombre) || '',
        userType: userType
      });
      if (userType === 'funcionario') {
        localUser.unidad = cloudPlayer.unidad || '';
      }
      this.upsertUserLocal(localUser);
      localStorage.setItem('uctenis_session', JSON.stringify(localUser));
      return { ok: true, user: localUser, isNew: false };
    }

    if (localUser) {
      localStorage.setItem('uctenis_session', JSON.stringify(localUser));
      return { ok: true, user: localUser, isNew: false };
    }

    return {
      ok: true,
      isNew: true,
      email: email,
      nombre: nombre || 'Usuario UCTenis',
      foto: ''
    };
  },

  completeGoogleRegistration(data) {
    const users = this.getUsers();
    const emailLower = String(data.email || '').trim().toLowerCase();
    let user = users.find(u => String(u.email || '').trim().toLowerCase() === emailLower);

    if (user) {
      // Si el usuario ya existe en local (porque se creó al iniciar sesión con Google),
      // actualizamos sus datos de perfil en lugar de intentar un nuevo registro que fallará por duplicado.
      user.nombre = data.nombre;
      user.genero = data.genero;
      user.categoria = normalizeCategoryForDb(data.categoria);
      user.mano = data.mano || 'Derecha';
      user.reves = data.reves || 'Dos manos';
      if (data.foto) user.foto = data.foto;
      user.telefono = data.telefono || '';
      user.rut = data.rut || '';
      user.userType = data.userType || 'socio';
      user.unidad = data.unidad || '';

      const idx = users.findIndex(u => String(u.email || '').trim().toLowerCase() === emailLower);
      users[idx] = user;
      this.saveUsers(users);
      localStorage.setItem('uctenis_session', JSON.stringify(user));
      return { ok: true, user };
    }

    const result = this.registerUser({
      nombre: data.nombre,
      email: data.email,
      password: 'google-auth-no-pass',
      genero: data.genero,
      categoria: normalizeCategoryForDb(data.categoria),
      mano: data.mano || 'Derecha',
      reves: data.reves || 'Dos manos',
      foto: data.foto || '',
      telefono: data.telefono || '',
      rut: data.rut || '',
      userType: data.userType || 'socio',
      unidad: data.unidad || ''
    });
    if (result.ok) {
      result.user.userType = data.userType || 'socio';
      result.user.unidad = data.unidad || '';
      localStorage.setItem('uctenis_session', JSON.stringify(result.user));
    }
    return result;
  },

  loginUser(email, password) {
    const user = this.getUsers().find(u => u.email === email && u.password === password);
    if (!user) return { ok: false, msg: 'Correo o contraseña incorrectos.' };
    localStorage.setItem('uctenis_session', JSON.stringify(user));
    return { ok: true, user };
  },
  getSession() {
    const session = JSON.parse(localStorage.getItem('uctenis_session') || 'null');
    if (!session) return null;

    const normalized = normalizeEmailForDb(session.email);
    const isConfiguredAdmin = DB_FIREBASE_ADMIN_EMAILS.some(adm => normalizeEmailForDb(adm) === normalized);
    if (!isConfiguredAdmin) return session;

    // Repara sesiones antiguas donde un administrador secundario quedó
    // guardado localmente como funcionario y era enviado a completar perfil.
    const playerProfile = this.findStaticAccessPlayerByEmail(session.email);
    const repaired = playerProfile
      ? playerToSessionUser(playerProfile, session)
      : { ...session, userType: 'admin' };
    repaired.isAdmin = true;
    repaired.readOnly = false;
    repaired.userType = playerProfile ? 'socio' : 'admin';
    this.upsertUserLocal(repaired);
    localStorage.setItem('uctenis_session', JSON.stringify(repaired));
    return repaired;
  },
  logout() {
    // ✅ Limpiar listeners en tiempo real
    this.cleanupListeners();
    localStorage.removeItem('uctenis_session');
    if (this.isFirebaseConfigured()) {
      firebaseAuth.signOut().catch(err => console.error("Error al cerrar sesión de Firebase:", err));
    }
  },

  /** Resuelve cuando el SDK de Firebase terminó de restaurar (o no) la
   * sesión persistida tras cargar la página. */
  authReady() {
    return _authReadyPromise;
  },

  /** ID token de Firebase del usuario actual, para que el backend (Apps
   * Script) pueda verificar acciones de administrador contra Google en vez
   * de confiar en un correo que el propio cliente declara. */
  async getIdToken(forceRefresh = false) {
    try {
      await this.authReady();
      if (firebaseAuth && firebaseAuth.currentUser) {
        return await firebaseAuth.currentUser.getIdToken(forceRefresh);
      }
    } catch (e) { console.warn('No se pudo obtener idToken:', e); }
    return null;
  },

  /** Obtiene un token fresco. Si la sesión local sigue activa pero Firebase
   * perdió su sesión, abre Google para reautenticar sin borrar el formulario
   * ni expulsar al administrador del panel. */
  async getIdTokenOrReauth() {
    this.lastAuthError = '';

    const token = await this.getIdToken(true);
    if (token) return token;

    const session = this.getSession();
    if (!session || !this.isFirebaseConfigured()) {
      this.lastAuthError = 'No hay una sesión de Google activa.';
      return null;
    }

    try {
      const expectedEmail = normalizeEmailForDb(session.email);
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
        login_hint: session.email || ''
      });
      const result = await firebaseAuth.signInWithPopup(provider);
      const authenticatedEmail = normalizeEmailForDb(result.user && result.user.email);

      if (!authenticatedEmail || authenticatedEmail !== expectedEmail) {
        await firebaseAuth.signOut();
        this.lastAuthError = 'Debes seleccionar la misma cuenta administradora: ' + (session.email || 'la cuenta actual') + '.';
        return null;
      }

      return await result.user.getIdToken(true);
    } catch (error) {
      console.warn('No se pudo renovar la sesión de administrador:', error);
      if (error && error.code === 'auth/popup-closed-by-user') {
        this.lastAuthError = 'La ventana de Google se cerró antes de completar el ingreso.';
      } else if (error && error.code === 'auth/popup-blocked') {
        this.lastAuthError = 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo nuevamente.';
      } else if (error && error.code === 'auth/unauthorized-domain') {
        this.lastAuthError = 'Este dominio no está autorizado en Firebase. Abre la aplicación desde su dirección publicada o agrega el dominio en Firebase Authentication.';
      } else {
        this.lastAuthError = 'No se pudo renovar la sesión con Google: ' + (error && error.message ? error.message : 'error desconocido');
      }
      return null;
    }
  },

  /** Clasifica el resultado de loginWithGoogle()/loginWithGoogleMock() para
   * que las 3 páginas (index/reservas/ranking) manejen login exitoso, perfil
   * incompleto/usuario nuevo y error de la misma forma en vez de cada una
   * con su propia lógica divergente. */
  resolveLoginOutcome(result) {
    if (!result) return { kind: 'error', msg: 'Respuesta de autenticación vacía.' };
    if (!result.ok) return { kind: 'error', msg: result.msg || 'No se pudo iniciar sesión.' };
    if (result.isNew) {
      return { kind: 'needsProfile', user: { email: result.email, nombre: result.nombre, foto: result.foto } };
    }
    if (!this.isProfileComplete(result.user)) {
      return { kind: 'needsProfile', user: result.user };
    }
    return { kind: 'ok', user: result.user };
  },

  /** Lleva la identidad de un login isNew/incompleto a través de la
   * navegación hacia reservas.html?completeProfile=1. sessionStorage (no
   * localStorage) para que se autolimpie si el usuario abandona el flujo. */
  stashPendingProfile(user) {
    try { sessionStorage.setItem('uctenis_pending_profile', JSON.stringify(user || {})); } catch (e) {}
  },
  getPendingProfile() {
    try { return JSON.parse(sessionStorage.getItem('uctenis_pending_profile') || 'null'); } catch (e) { return null; }
  },
  clearPendingProfile() {
    try { sessionStorage.removeItem('uctenis_pending_profile'); } catch (e) {}
  },

  /** Lee la configuración editable de horarios/parámetros de reserva.
   * Retorna null si no existe aún (el llamador debe usar los DEFAULT_*). */
  async getScheduleConfigCloud() {
    if (!this.isCloudConfigured()) return null;
    try {
      const doc = await firebaseDb.collection(FIREBASE_COLLECTIONS.config).doc('schedule').get();
      return doc.exists ? doc.data() : null;
    } catch (e) {
      console.warn('No se pudo leer la configuración de horarios:', e);
      return null;
    }
  },

  // Nota: guardar uct_config/schedule ya no se hace con un write directo del
  // SDK de Firestore (chocaba con las reglas de seguridad, "Missing or
  // insufficient permissions") — ver la acción 'save_schedule_config' del
  // backend, usada desde saveScheduleConfigAll() en ranking.html.

  updateUser(updatedUser) {
    const users = this.getUsers().map(u => u.id === updatedUser.id ? updatedUser : u);
    this.saveUsers(users);
    localStorage.setItem('uctenis_session', JSON.stringify(updatedUser));
  },

  // ──────────────── FIREBASE: JUGADORES ────────────────
  async getPlayersCloud() {
    // ✅ OPTIMIZACIÓN: Retorna caché en tiempo real si listener está activo
    if (cachedPlayers.length > 0) {
      return cachedPlayers;
    }
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    // Si no hay caché, hacer fetch manual
    const snapshot = await firebaseDb.collection(FIREBASE_COLLECTIONS.players).get();
    cachedPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return cachedPlayers;
  },

  /** Lee la caché de jugadores del listener en tiempo real sin disparar una
   * consulta nueva a Firestore si todavía está vacía (a diferencia de
   * getPlayersCloud). La usa el ranking para su primer pintado: si el
   * listener ya entregó su snapshot en ese momento, evita mostrar una copia
   * vieja que luego "flashea" al reemplazarse por el dato real. */
  getCachedPlayersSnapshot() {
    return cachedPlayers.length > 0 ? cachedPlayers : null;
  },

  // ✅ NUEVO: Inicializar listener de jugadores en tiempo real
  initPlayersListener() {
    if (!this.isCloudConfigured()) return null;
    
    // Desuscribir listeners anteriores
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
          this.dispatchEvent('players-updated', { count: cachedPlayers.length });
          console.log(`✅ ${cachedPlayers.length} jugadores actualizados en tiempo real`);
        },
        error => {
          console.error('❌ Error en listener de jugadores:', error);
        }
      );
    
    playersListeners.push(unsubscribe);
    return unsubscribe;
  },

  async findPlayerByEmailCloud(email) {
    const normalized = normalizeEmailForDb(email);
    if (!normalized || !this.isCloudConfigured()) return null;

    try {
      const collection = firebaseDb.collection(FIREBASE_COLLECTIONS.players);
      const queries = [
        { field: 'emailLower', value: normalized },
        { field: 'email', value: String(email || '').trim() },
        { field: 'email', value: normalized }
      ].filter((query, index, list) =>
        query.value && list.findIndex(item => item.field === query.field && item.value === query.value) === index
      );

      for (const query of queries) {
        const snapshot = await collection
          .where(query.field, '==', query.value)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const player = { id: doc.id, ...doc.data() };
          if (isAccessPlayerActive(player)) return player;
        }
      }

      const players = await this.getPlayersCloud();
      const byEmail = players.find(player =>
        normalizeEmailForDb(player.email) === normalized &&
        isAccessPlayerActive(player)
      );
      if (byEmail) {
        return byEmail;
      }
    } catch (error) {
      console.warn('No se pudo buscar jugador por correo en Firebase:', error);
    }
    return null;
  },

  async savePlayerCloud(player, actor = {}) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const id = player.id || makeFirebaseDocId(player.nombre || player.email, 'player');
    const now = new Date().toISOString();
    const emailLower = normalizeEmailForDb(player.email);
    const isActivo = player.activo !== undefined ? (player.activo !== false && player.activo !== 'false') : 
                     (player.participaRanking !== undefined ? (player.participaRanking !== false && player.participaRanking !== 'false') : true);
    const isParticipa = player.participaRanking !== undefined ? (player.participaRanking !== false && player.participaRanking !== 'false') : isActivo;
    const data = cleanFirestoreData({
      ...player,
      id,
      genero: player.genero || player.gender || '',
      activo: isActivo,
      participaRanking: isParticipa,
      telefono: formatPhoneNumber(player.telefono),
      emailLower,
      updatedAt: now,
      updatedBy: actor.email || actor.adminEmail || actor.actorEmail || ''
    });
    // El RUT es sensible y esta colección es de lectura pública para el
    // ranking: nunca se guarda aquí. Se persiste aparte con acceso
    // restringido — ver saveRutCloud() en ranking.html.
    delete data.rut;

    await firebaseDb.collection(FIREBASE_COLLECTIONS.players).doc(id).set(data, { merge: true });
    return { ...data, rut: player.rut || '' };
  },

  async savePlayersCloud(players, actor = {}) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const batch = firebaseDb.batch();
    const now = new Date().toISOString();
    const saved = [];

    players.forEach(player => {
      const id = player.id || makeFirebaseDocId(player.nombre || player.email, 'player');
      const isActivo = player.activo !== undefined ? (player.activo !== false && player.activo !== 'false') : 
                       (player.participaRanking !== undefined ? (player.participaRanking !== false && player.participaRanking !== 'false') : true);
      const isParticipa = player.participaRanking !== undefined ? (player.participaRanking !== false && player.participaRanking !== 'false') : isActivo;
      const data = cleanFirestoreData({
        ...player,
        id,
        genero: player.genero || player.gender || '',
        activo: isActivo,
        participaRanking: isParticipa,
        telefono: formatPhoneNumber(player.telefono),
        emailLower: normalizeEmailForDb(player.email),
        updatedAt: now,
        updatedBy: actor.email || actor.adminEmail || actor.actorEmail || ''
      });
      delete data.rut; // ver nota de privacidad en savePlayerCloud()
      const ref = firebaseDb.collection(FIREBASE_COLLECTIONS.players).doc(id);
      batch.set(ref, data, { merge: true });
      saved.push({ ...data, rut: player.rut || '' });
    });

    if (saved.length) await batch.commit();
    return saved;
  },

  /** Lee el RUT de un jugador vía el backend (colección privada, acceso
   * restringido al dueño o a un admin). Retorna '' si no está guardado o
   * si falla la consulta — nunca lanza, para no romper la carga de la
   * ficha por un dato secundario. */
  async getRutCloud(playerId) {
    if (!this.isCloudConfigured() || !window.CONFIG?.API_URL || !playerId) return '';
    try {
      const idToken = await this.getIdTokenOrReauth();
      if (!idToken) return '';
      const res = await fetch(window.CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_player_rut', playerId, idToken })
      });
      const data = await res.json();
      return data && data.ok ? (data.rut || '') : '';
    } catch (e) {
      console.warn('No se pudo leer el RUT:', e);
      return '';
    }
  },

  /** Guarda el RUT de un jugador vía el backend (ver getRutCloud). */
  async saveRutCloud(playerId, rut) {
    if (!this.isCloudConfigured() || !window.CONFIG?.API_URL || !playerId) {
      throw new Error('No se pudo guardar el RUT: falta configuración de Firestore.');
    }
    const idToken = await this.getIdTokenOrReauth();
    if (!idToken) throw new Error(this.lastAuthError || 'Tu sesión venció.');
    const res = await fetch(window.CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'save_player_rut', playerId, rut: rut || '', idToken })
    });
    const data = await res.json();
    if (!data || !data.ok) throw new Error((data && data.msg) || 'No se pudo guardar el RUT.');
    return true;
  },

  async setPlayerActiveCloud(player, active, actor = {}) {
    const id = typeof player === 'string' ? player : player?.id;
    if (!id) throw new Error('Jugador sin ID.');
    const patch = {
      ...(typeof player === 'string' ? {} : player),
      id,
      activo: Boolean(active),
      participaRanking: Boolean(active),
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email || actor.adminEmail || actor.actorEmail || ''
    };
    if (!active) patch.posicion = '';
    return this.savePlayerCloud(patch, actor);
  },

  async deletePlayerCloud(id) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    if (!id) throw new Error('Se requiere el ID del jugador para eliminarlo.');
    await firebaseDb.collection(FIREBASE_COLLECTIONS.players).doc(id).delete();
  },

  // ──────────────── FIREBASE: FUNCIONARIOS UCT ────────────────

  /**
   * Determina el tipo de acceso de un email.
   * Retorna: { allowed, userType: 'admin'|'socio'|'funcionario'|null, profile }
   */
  async getUserAccess(email) {
    const normalized = normalizeEmailForDb(email);
    if (!normalized) return { allowed: false, userType: null, profile: null };

    // 1. ¿Es admin puro?
    if (DB_PURE_ADMIN_EMAILS.some(a => normalizeEmailForDb(a) === normalized)) {
      return { allowed: true, userType: 'admin', profile: null };
    }
    // 2. ¿Es admin secundario?
    if (DB_FIREBASE_ADMIN_EMAILS.some(a => normalizeEmailForDb(a) === normalized)) {
      return { allowed: true, userType: 'admin', profile: null };
    }

    if (this.isCloudConfigured()) {
      // 3. ¿Es socio UCTenis? (ranking_players)
      try {
        const socioSnap = await firebaseDb
          .collection(FIREBASE_COLLECTIONS.players)
          .where('emailLower', '==', normalized)
          .where('activo', '==', true)
          .limit(1)
          .get();
        if (!socioSnap.empty) {
          return { allowed: true, userType: 'socio', profile: { id: socioSnap.docs[0].id, ...socioSnap.docs[0].data() } };
        }
        // fallback: buscar sin emailLower
        const socioSnap2 = await firebaseDb
          .collection(FIREBASE_COLLECTIONS.players)
          .where('email', '==', String(email).trim())
          .limit(1)
          .get();
        if (!socioSnap2.empty) {
          const p = { id: socioSnap2.docs[0].id, ...socioSnap2.docs[0].data() };
          if (isAccessPlayerActive(p)) return { allowed: true, userType: 'socio', profile: p };
        }
      } catch (e) { console.warn('getUserAccess socio query error:', e); }

      // 4. ¿Es funcionario UCT? (uct_staff)
      try {
        const staffSnap = await firebaseDb
          .collection(FIREBASE_COLLECTIONS.staff)
          .where('emailLower', '==', normalized)
          .where('activo', '==', true)
          .limit(1)
          .get();
        if (!staffSnap.empty) {
          return { allowed: true, userType: 'funcionario', profile: { id: staffSnap.docs[0].id, ...staffSnap.docs[0].data() } };
        }
      } catch (e) { console.warn('getUserAccess staff query error:', e); }
    }

    // 5. Respaldo: listas estáticas (socios)
    const staticPlayer = this.findStaticAccessPlayerByEmail(email);
    if (staticPlayer) return { allowed: true, userType: 'socio', profile: staticPlayer };

    // 6. Cualquier correo institucional @uct.cl obtiene acceso de solo lectura
    // aunque aún no esté cargado como socio/funcionario (debe activarlo un admin).
    if (normalized.endsWith('@uct.cl')) {
      return { allowed: true, userType: 'invitado', profile: null, readOnly: true };
    }

    return { allowed: false, userType: null, profile: null };
  },

  /** Crea o actualiza un funcionario en uct_staff (solo admin) */
  async saveStaffCloud(staff, actor = {}) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const id = staff.id || 'stf_' + makeFirebaseDocId(staff.email || staff.nombre, 'staff');
    const now = new Date().toISOString();
    const emailLower = normalizeEmailForDb(staff.email);
    const data = cleanFirestoreData({
      ...staff,
      id,
      userType: 'funcionario',
      emailLower,
      activo: staff.activo !== false,
      createdAt: staff.createdAt || now,
      updatedAt: now,
      creadoPor: staff.creadoPor || actor.email || '',
      updatedBy: actor.email || ''
    });
    await firebaseDb.collection(FIREBASE_COLLECTIONS.staff).doc(id).set(data, { merge: true });
    cachedStaff = cachedStaff.filter(s => s.id !== id);
    cachedStaff.push(data);
    return data;
  },

  /** Lista todos los funcionarios (admin) */
  async getStaffCloud() {
    if (cachedStaff.length > 0) return cachedStaff;
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const snap = await firebaseDb.collection(FIREBASE_COLLECTIONS.staff).orderBy('nombre').get();
    cachedStaff = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return cachedStaff;
  },

  /** Busca un funcionario por email */
  async findStaffByEmailCloud(email) {
    const normalized = normalizeEmailForDb(email);
    if (!normalized || !this.isCloudConfigured()) return null;
    try {
      const snap = await firebaseDb
        .collection(FIREBASE_COLLECTIONS.staff)
        .where('emailLower', '==', normalized)
        .limit(1).get();
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (e) { console.warn('findStaffByEmailCloud error:', e); }
    return null;
  },

  /** Activa/desactiva un funcionario */
  async setStaffActiveCloud(staffId, active, actor = {}) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const patch = { activo: Boolean(active), updatedAt: new Date().toISOString(), updatedBy: actor.email || '' };
    await firebaseDb.collection(FIREBASE_COLLECTIONS.staff).doc(staffId).update(patch);
    cachedStaff = cachedStaff.map(s => s.id === staffId ? { ...s, ...patch } : s);
    return patch;
  },

  /** Elimina un funcionario permanentemente */
  async deleteStaffCloud(staffId) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    await firebaseDb.collection(FIREBASE_COLLECTIONS.staff).doc(staffId).delete();
    cachedStaff = cachedStaff.filter(s => s.id !== staffId);
  },

  /**
   * Migra un usuario de tipo:
   *   'socio'  → 'funcionario' (mueve de ranking_players a uct_staff)
   *   'funcionario' → 'socio'  (mueve de uct_staff a ranking_players)
   * Retorna { ok, msg }
   */
  async migrateUserType(email, fromType, toType, actor = {}) {
    const normalized = normalizeEmailForDb(email);
    if (!this.isCloudConfigured()) return { ok: false, msg: 'Firestore no disponible.' };
    if (fromType === toType) return { ok: false, msg: 'El usuario ya es de ese tipo.' };

    if (fromType === 'funcionario' && toType === 'socio') {
      const staff = await this.findStaffByEmailCloud(normalized);
      if (!staff) return { ok: false, msg: 'Funcionario no encontrado.' };
      // Crear en ranking_players
      await this.savePlayerCloud({
        id: 'p_' + makeFirebaseDocId(staff.nombre || email, 'player'),
        nombre: staff.nombre,
        email: staff.email,
        emailLower: normalized,
        genero: staff.genero || '',
        categoria: staff.categoria || 'Principiante',
        telefono: staff.telefono || '',
        foto: staff.foto || '',
        activo: true,
        participaRanking: false, // admin activa en ranking manualmente
        userType: 'socio',
        migratedFrom: 'funcionario',
        migratedAt: new Date().toISOString()
      }, actor);
      // Eliminar de uct_staff
      await this.deleteStaffCloud(staff.id);
      return { ok: true, msg: `${staff.nombre} convertido a Socio UCTenis. Actívalo en el ranking cuando corresponda.` };
    }

    if (fromType === 'socio' && toType === 'funcionario') {
      const player = await this.findPlayerByEmailCloud(normalized);
      if (!player) return { ok: false, msg: 'Socio no encontrado.' };
      // Crear en uct_staff
      await this.saveStaffCloud({
        nombre: player.nombre,
        email: player.email,
        emailLower: normalized,
        genero: player.genero || '',
        telefono: player.telefono || '',
        foto: player.foto || '',
        activo: true,
        unidad: '',
        migratedFrom: 'socio',
        migratedAt: new Date().toISOString()
      }, actor);
      // Eliminar de ranking_players
      await this.deletePlayerCloud(player.id);
      return { ok: true, msg: `${player.nombre} convertido a Funcionario UCT. Ha perdido su posición en el ranking.` };
    }

    return { ok: false, msg: 'Conversión de tipo no soportada.' };
  },

  /** Listener en tiempo real para uct_staff */
  initStaffListener() {
    if (!this.isCloudConfigured()) return null;
    staffListeners.forEach(u => u());
    staffListeners = [];
    const unsubscribe = firebaseDb
      .collection(FIREBASE_COLLECTIONS.staff)
      .orderBy('nombre')
      .onSnapshot(
        snap => {
          cachedStaff = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          this.dispatchEvent('staff-updated', { count: cachedStaff.length });
        },
        err => console.error('❌ Error en listener de funcionarios:', err)
      );
    staffListeners.push(unsubscribe);
    return unsubscribe;
  },

  // ──────────────── FIREBASE: DESAFÍOS ────────────────
  async getChallengesCloud() {
    // ✅ OPTIMIZACIÓN: Retorna caché en tiempo real si listener está activo
    if (cachedChallenges.length > 0) {
      return cachedChallenges;
    }
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    // Si no hay caché, hacer fetch manual
    const snapshot = await firebaseDb.collection(FIREBASE_COLLECTIONS.challenges).get();
    cachedChallenges = snapshot.docs
      .map(doc => normalizeChallengeRecord({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (b.creado || '').localeCompare(a.creado || ''));
    return cachedChallenges;
  },

  // ✅ NUEVO: Inicializar listener de desafíos en tiempo real
  initChallengesListener() {
    if (!this.isCloudConfigured()) return null;
    
    // Desuscribir listeners anteriores
    challengesListeners.forEach(unsubscribe => unsubscribe());
    challengesListeners = [];
    
    // Crear nuevo listener
    const unsubscribe = firebaseDb
      .collection(FIREBASE_COLLECTIONS.challenges)
      .onSnapshot(
        snapshot => {
          cachedChallenges = snapshot.docs
            .map(doc => normalizeChallengeRecord({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (b.creado || '').localeCompare(a.creado || ''));
          
          // Guardar a localStorage para mantener sincronizado
          this.saveChallenges(cachedChallenges);
          
          this.dispatchEvent('challenges-updated', { count: cachedChallenges.length });
          console.log(`✅ ${cachedChallenges.length} desafíos actualizados en tiempo real`);
        },
        error => {
          console.error('❌ Error en listener de desafíos:', error);
        }
      );
    
    challengesListeners.push(unsubscribe);
    return unsubscribe;
  },

  async saveChallengeCloud(challenge) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const id = challenge.id || makeFirebaseDocId(`challenge-${Date.now()}`, 'challenge');
    const now = new Date().toISOString();
    const data = cleanFirestoreData(normalizeChallengeRecord({
      ...challenge,
      id,
      status: challenge.status || 'pendiente',
      creado: challenge.creado || now,
      actualizado: now
    }));
    await firebaseDb.collection(FIREBASE_COLLECTIONS.challenges).doc(id).set(data, { merge: true });
    return data;
  },

  async updateChallengeCloud(id, patch) {
    const current = this.getChallenges().find(challenge => challenge.id === id) || {};
    return this.saveChallengeCloud({ ...current, ...patch, id });
  },

  async deleteChallengeCloud(id) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    if (!id) throw new Error('Se requiere el ID del desafío para eliminarlo.');
    await firebaseDb.collection(FIREBASE_COLLECTIONS.challenges).doc(id).delete();
  },

  // ──────────────── FIREBASE: NOVEDADES ────────────────
  getNews() {
    return JSON.parse(localStorage.getItem('uctenis_news') || '[]');
  },
  saveNews(list) {
    localStorage.setItem('uctenis_news', JSON.stringify(list || []));
  },
  async getNewsCloud() {
    // ✅ OPTIMIZACIÓN: Retorna caché en tiempo real si listener está activo
    if (cachedNews.length > 0) {
      return cachedNews;
    }
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    // Si no hay caché, hacer fetch manual
    const snapshot = await firebaseDb.collection(FIREBASE_COLLECTIONS.news).get();
    cachedNews = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.date || b.creado || '').localeCompare(a.date || a.creado || ''));
    return cachedNews;
  },

  // ✅ NUEVO: Inicializar listener de noticias en tiempo real
  initNewsListener() {
    if (!this.isCloudConfigured()) return null;
    
    // Desuscribir listeners anteriores
    newsListeners.forEach(unsubscribe => unsubscribe());
    newsListeners = [];
    
    // Crear nuevo listener
    const unsubscribe = firebaseDb
      .collection(FIREBASE_COLLECTIONS.news)
      .onSnapshot(
        snapshot => {
          cachedNews = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.date || b.creado || '').localeCompare(a.date || a.creado || ''));
          
          // Guardar a localStorage para mantener sincronizado
          this.saveNews(cachedNews);
          
          this.dispatchEvent('news-updated', { count: cachedNews.length });
          console.log(`✅ ${cachedNews.length} noticias actualizadas en tiempo real`);
        },
        error => {
          console.error('❌ Error en listener de noticias:', error);
        }
      );
    
    newsListeners.push(unsubscribe);
    return unsubscribe;
  },
  async saveNewsCloud(newsItem, actor = {}) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const id = newsItem.id || makeFirebaseDocId(newsItem.title || `news-${Date.now()}`, 'news');
    const now = new Date().toISOString();
    const data = cleanFirestoreData({
      ...newsItem,
      id,
      creado: newsItem.creado || now,
      actualizado: now,
      updatedBy: actor.email || actor.adminEmail || actor.actorEmail || ''
    });
    await firebaseDb.collection(FIREBASE_COLLECTIONS.news).doc(id).set(data, { merge: true });
    return data;
  },
  async deleteNewsCloud(id) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    if (!id) throw new Error('Se requiere el ID de la novedad para eliminarla.');
    await firebaseDb.collection(FIREBASE_COLLECTIONS.news).doc(id).delete();
  },

  // ✅ UTILIDAD: Disparar eventos personalizados
  dispatchEvent(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data });
    window.dispatchEvent(event);
  },

  // ✅ UTILIDAD: Escuchar eventos de actualización en tiempo real
  addEventListener(eventName, callback) {
    window.addEventListener(eventName, (e) => callback(e.detail));
  },

  // ✅ UTILIDAD: Limpiar todos los listeners (para logout)
  cleanupListeners() {
    playersListeners.forEach(unsubscribe => unsubscribe());
    challengesListeners.forEach(unsubscribe => unsubscribe());
    newsListeners.forEach(unsubscribe => unsubscribe());
    staffListeners.forEach(unsubscribe => unsubscribe());
    playersListeners = [];
    challengesListeners = [];
    newsListeners = [];
    staffListeners = [];
    cachedPlayers = [];
    cachedChallenges = [];
    cachedNews = [];
    cachedStaff = [];
    console.log('✅ Listeners limpios');
  },

  // ──────────────── RANKING ────────────────
  getRanking(genero) {
    const key = genero === 'M' ? 'uctenis_ranking_m' : 'uctenis_ranking_f';
    return JSON.parse(localStorage.getItem(key) || '[]');
  },
  saveRanking(genero, list) {
    const key = genero === 'M' ? 'uctenis_ranking_m' : 'uctenis_ranking_f';
    localStorage.setItem(key, JSON.stringify(list));
  },
  recalcRanking(genero) {
    const users = this.getUsers().filter(u => u.genero === genero);
    const challenges = this.getChallenges().filter(c =>
      ['completado', 'wo_retado'].includes(c.status) &&
      c.genero === genero &&
      c.tipo !== 'amistoso' &&
      c.tipo !== 'campeonato'
    );

    // Build ladder baseline from users. If a user has an explicit position (pos or posicion), respect it.
    const ranking = users.map((user, index) => {
      const explicitPos = Number.isFinite(user.pos) && user.pos > 0
        ? Number(user.pos)
        : (Number.isFinite(user.posicion) && user.posicion > 0 ? Number(user.posicion) : null);
      return { id: user.id, nombre: user.nombre, pos: explicitPos ?? (index + 1) };
    });

    // If any explicit positions were provided, sort by them to establish the baseline order.
    const hasExplicit = ranking.some(r => Number.isFinite(r.pos) && r.pos > 0 && users.some(u => Number.isFinite(u.pos) || Number.isFinite(u.posicion)));
    if (hasExplicit) {
      ranking.sort((a, b) => (a.pos || 9999) - (b.pos || 9999) || String(a.id).localeCompare(String(b.id)));
    }
    const findIndex = id => ranking.findIndex(item => item.id === id);

    const sortedChallenges = [...challenges].sort((a, b) => {
      const getTime = challenge => {
        const dateValue = challenge.actualizado || challenge.creado;
        const parsed = dateValue ? new Date(dateValue).getTime() : NaN;
        return Number.isFinite(parsed) ? parsed : 0;
      };
      const timeA = getTime(a);
      const timeB = getTime(b);
      return timeA - timeB || String(a.id).localeCompare(String(b.id));
    });

    sortedChallenges.forEach(challenge => {
      if (challenge.status === 'wo_retador') return;
      const winnerId = challenge.ganadorId;
      const loserId = winnerId === challenge.retadorId ? challenge.retadoId : challenge.retadorId;
      const winnerIndex = findIndex(winnerId);
      const loserIndex = findIndex(loserId);
      if (winnerIndex < 0 || loserIndex < 0) return;
      if (winnerIndex > loserIndex) {
        const moved = ranking.splice(winnerIndex, 1)[0];
        ranking.splice(loserIndex, 0, moved);
      }
    });

    const ranked = ranking.map((player, index) => ({ ...player, pos: index + 1 }));
    this.saveRanking(genero, ranked);
    return ranked;
  },

  // ──────────────── DESAFÍOS ────────────────
  // Un desafío válido debe tener: id, status, creado, y al menos retadorId + retadoId
  // (o en registros muy viejos, al menos los nombres de ambos jugadores)
  isValidChallenge(c) {
    if (!c || !c.id || c.id === 'ID') return false;
    if (c.status === 'eliminado') return false;
    if (!c.creado || String(c.creado).trim() === '') return false;



    // Debe tener IDs (registros modernos) o al menos nombres de ambos jugadores (registros viejos)
    const hasIds = c.retadorId && c.retadoId;
    const hasNames = c.retadorNombre && c.retadoNombre &&
                     c.retadorNombre !== 'RETADOR' && c.retadoNombre !== 'RETADO' &&
                     c.retadorNombre !== 'ID' && c.retadoNombre !== 'ID';
    return Boolean(hasIds || hasNames);
  },
  getChallenges() {
    const list = JSON.parse(localStorage.getItem('uctenis_challenges') || '[]');
    return list
      .map(normalizeChallengeRecord)
      .filter(c => this.isValidChallenge(c));
  },
  saveChallenges(list) {
    const filtered = list
      .map(normalizeChallengeRecord)
      .filter(c => this.isValidChallenge(c));
    localStorage.setItem('uctenis_challenges', JSON.stringify(filtered));
  },
  createChallenge(retadorId, retadoId, genero, fecha, cancha) {
    const challenges = this.getChallenges();
    const nuevo = {
      id: Date.now().toString(),
      retadorId, retadoId, genero,
      fecha, cancha,
      status: 'pendiente',
      marcador: null,
      ganadorId: null,
      tipo: 'ranking',
      creado: new Date().toISOString()
    };
    challenges.push(nuevo);
    this.saveChallenges(challenges);
    return nuevo;
  },
  respondChallenge(id, accept) {
    const list = this.getChallenges().map(c => {
      if (c.id === id) return { ...c, status: accept ? 'aceptado' : 'rechazado' };
      return c;
    });
    this.saveChallenges(list);
  },
  submitResult(id, marcador, ganadorId, tipo) {
    const now = new Date().toISOString();
    const list = this.getChallenges().map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: 'resultado_pendiente',
          marcador,
          ganadorId,
          tipo: tipo || c.tipo || 'ranking',
          fechaResultado: now,
          resultadoReclamado: false,
          reclamoResultado: '',
          actualizado: now
        };
      }
      return c;
    });
    this.saveChallenges(list);
  },
  getUserChallenges(userId) {
    return this.getChallenges().filter(c => c.retadorId === userId || c.retadoId === userId);
  },

  // ──────────────── RESERVAS DE CANCHA ────────────────
  COURTS: [
    { id: 'cec1', label: 'CEC – Cancha 1', surface: 'Arcilla', img: 'cec.jpg',
      gcal: 'https://calendar.app.google/kGKzcmXMWJv7vs9h7' },
    { id: 'cec2', label: 'CEC – Cancha 2', surface: 'Arcilla', img: 'cec.jpg',
      gcal: 'https://calendar.app.google/QGrkHxRgwacJ3ApU6' },
    { id: 'cjp1', label: 'CJP – Cancha 1', surface: 'Asfalto',  img: 'cjp.jpg',
      gcal: 'https://calendar.app.google/tqq8PkCJzmHaBvGS7' },
    { id: 'cjp2', label: 'CJP – Cancha 2', surface: 'Asfalto',  img: 'cjp.jpg',
      gcal: 'https://calendar.app.google/FAcvAqn4TCJDEjwP9' },
  ],
  // Slots: 09:00–22:30, bloques de 1.5 h
  SLOTS: ['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00'],

  getBookings() {
    return JSON.parse(localStorage.getItem('uctenis_bookings') || '[]');
  },
  saveBookings(list) {
    localStorage.setItem('uctenis_bookings', JSON.stringify(list));
  },
  // Reservas de una cancha en una fecha
  getCourtBookings(courtId, fecha) {
    return this.getBookings().filter(b => b.courtId === courtId && b.fecha === fecha && b.status !== 'cancelada');
  },
  // Si el usuario ya reservó HOY (regla: 1 por día, excepto administradores)
  userBookedToday(userId, fecha) {
    const session = this.getSession();
    const user = (session && session.id === userId) ? session : this.getUsers().find(u => u.id === userId);
    if (user && (user.isAdmin || ['uctenisclub@gmail.com', 'dsilva@uct.cl'].includes((user.email || '').toLowerCase()))) {
      return false;
    }
    return this.getBookings().some(b => b.userId === userId && b.fecha === fecha && b.status !== 'cancelada');
  },
  createBooking(userId, courtId, fecha, slot) {
    const bookings = this.getBookings();
    // Regla: Evitar reservar horario de clases (martes y miércoles de 18:00 a 19:30 en CJP)
    const [y, m, d] = fecha.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    if ((dayOfWeek === 2 || dayOfWeek === 3) && slot === '18:00' && courtId.startsWith('cjp')) {
      return { ok: false, msg: 'Este horario está reservado para Clases UCTenis.' };
    }
    // Regla: slot ya ocupado
    if (bookings.some(b => b.courtId === courtId && b.fecha === fecha && b.slot === slot && b.status !== 'cancelada'))
      return { ok: false, msg: 'Ese horario ya está reservado.' };
    // Regla: 1 reserva por día
    if (this.userBookedToday(userId, fecha))
      return { ok: false, msg: 'Solo se permite una reserva por día.' };
    const b = { id: Date.now().toString(), userId, courtId, fecha, slot, status: 'confirmada', creado: new Date().toISOString() };
    bookings.push(b);
    this.saveBookings(bookings);
    return { ok: true, booking: b };
  },
  
  // ──────────────── CONEXIÓN AL BACKEND (Google Calendar y Miembros) ────────────────
  // Consultar disponibilidad real de las 4 canchas en Google Calendar
  async getSlotsAPI(fechaStr) {
    const cached = slotsCache.get(fechaStr);
    if (cached && (Date.now() - cached.ts) < SLOTS_CACHE_TTL_MS) {
      return cached.data;
    }
    try {
      const idToken = await this.getIdToken();
      const res = idToken
        ? await fetch(window.CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_available_slots', date: fechaStr, idToken })
          })
        : await fetch(`${window.CONFIG.API_URL}?${new URLSearchParams({ action: 'get_available_slots', date: fechaStr }).toString()}`);
      const data = await res.json();
      if (data && data.ok) slotsCache.set(fechaStr, { data, ts: Date.now() });
      return data; // { ok: true, courts: { cec1: ["09:00", ...], cec2: [...] } }
    } catch (e) {
      console.error('Error obteniendo disponibilidad:', e);
      return { ok: false };
    }
  },
  invalidateSlotsCache(fechaStr) {
    if (fechaStr) slotsCache.delete(fechaStr);
    else slotsCache.clear();
  },

  // Nota: Para usar la versión real que agenda en Google Calendar, se llama a esta función
  async createBookingAPI(userId, courtId, fecha, slot) {
    // Buscar usuario en localStorage; si no existe, intentar desde sesión activa
    let user = this.getUsers().find(u => u.id === userId);
    if (!user) {
      const session = this.getSession();
      if (session && (session.id === userId || !userId)) {
        user = session;
      }
    }
    if (!user) return { ok: false, msg: 'Usuario no encontrado' };

    if (user.userType === 'invitado' || user.readOnly) {
      return { ok: false, msg: 'Tu cuenta @uct.cl tiene acceso de solo lectura. Escribe a un administrador de UCTenis para activarte como socio o funcionario y poder reservar canchas.' };
    }

    // Regla: Evitar reservar horario de clases (martes y miércoles de 18:00 a 19:30 en CJP)
    const [y, m, d] = fecha.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    if ((dayOfWeek === 2 || dayOfWeek === 3) && slot === '18:00' && courtId.startsWith('cjp')) {
      return { ok: false, msg: 'Este horario está reservado para Clases UCTenis.' };
    }

    // Regla diaria sincronizada con la configuración editable del admin.
    const configuredLimit = Math.max(1, Number(window.RESERVATION_RULES?.maxBookingsPerDay) || 1);
    const localDailyCount = this.getBookings().filter(b => b.userId === user.id && b.fecha === fecha && b.status !== 'cancelada').length;
    if (!user.isAdmin && localDailyCount >= configuredLimit) {
      return { ok: false, msg: `Ya alcanzaste el máximo de ${configuredLimit} reserva${configuredLimit === 1 ? '' : 's'} para este día.` };
    }

    try {
      const idToken = await this.getIdToken();
      const payload = {
        action: 'create_booking',
        userId: user.id || userId || '',
        email: user.email,
        name: user.nombre,
        rut: user.rut || '',
        userType: user.userType || (user.isAdmin ? 'admin' : 'socio'),
        courtId: courtId,
        date: fecha,
        slot: slot
      };
      if (idToken) payload.idToken = idToken;
      const res = await fetch(window.CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!data.ok) {
        return { ok: false, msg: data.msg };
      }

      // Guardar una copia local del registro principal de Firestore.
      const bookings = this.getBookings();
      const remoteBooking = data.booking || {};
      const b = {
        id: remoteBooking.id || data.eventId || Date.now().toString(),
        calendarEventId: remoteBooking.calendarEventId || data.eventId || '',
        userId: user.id || userId,
        courtId,
        fecha,
        slot,
        status: data.pending ? 'pendiente_calendar' : 'confirmada',
        creado: remoteBooking.creado || new Date().toISOString()
      };
      const existingIndex = bookings.findIndex(item => item.id === b.id);
      if (existingIndex >= 0) bookings[existingIndex] = { ...bookings[existingIndex], ...b };
      else bookings.push(b);
      this.saveBookings(bookings);
      this.invalidateSlotsCache(fecha);
      return { ok: true, pending: Boolean(data.pending), msg: data.msg || '', booking: b };
    } catch (e) {
      console.error('Error conectando a Apps Script:', e);
      return { ok: false, msg: 'No se pudo conectar al servidor de reservas. Intenta nuevamente.' };
    }
  },

  async cancelBookingAPI(bookingId, courtId) {
    try {
      const session = this.getSession();
      const idToken = await this.getIdToken();
      if (!idToken || !session?.email) {
        return { ok: false, msg: 'Tu sesión venció. Vuelve a ingresar antes de cancelar.' };
      }
      const payload = {
        action: 'cancel_booking',
        courtId: courtId,
        bookingId: bookingId,
        eventId: bookingId,
        email: session.email,
        idToken: idToken
      };
      const res = await fetch(window.CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.ok) this.invalidateSlotsCache();
      return data;
    } catch (e) {
      console.error('Error al cancelar en la API:', e);
      return { ok: false, msg: 'No se pudo conectar con el servidor de Google Calendar.' };
    }
  },

  cancelBooking(bookingId, userId) {
    const list = this.getBookings().map(b => {
      if (b.id === bookingId && b.userId === userId) return { ...b, status: 'cancelada' };
      return b;
    });
    this.saveBookings(list);
  },
  getUserBookings(userId) {
    return this.getBookings()
      .filter(b => b.userId === userId && b.status !== 'cancelada')
      .sort((a,b) => a.fecha.localeCompare(b.fecha) || a.slot.localeCompare(b.slot));
  },
  async syncUserBookingsAPI(userId) {
    const session = this.getSession();
    const user = this.getUsers().find(u => u.id === userId) || (session && session.id === userId ? session : null);
    if (!user || !this.isFirebaseConfigured()) return;
    
    try {
      const idToken = await this.getIdToken();
      if (!idToken) return;
      const res = await fetch(window.CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'get_user_bookings',
          email: user.email,
          idToken: idToken
        })
      });
      const data = await res.json();
      
      if (data.ok && data.bookings) {
        const localBookings = this.getBookings();
        
        // 1. Marcar las reservas locales futuras del usuario que NO están en Google Calendar como canceladas
        const updated = localBookings.map(b => {
          if (b.userId === userId && b.status !== 'cancelada') {
            const isPast = new Date(b.fecha + 'T' + b.slot + ':00') < new Date();
            if (isPast) return b;
            
            const remote = data.bookings.find(gb =>
              gb.id === b.id || (gb.courtId === b.courtId && gb.fecha === b.fecha && gb.slot === b.slot)
            );
            if (!remote) {
              return { ...b, status: 'cancelada' };
            }
            return {
              ...b,
              id: remote.id || b.id,
              calendarEventId: remote.calendarEventId || b.calendarEventId || '',
              status: remote.status === 'confirmed' || remote.status === 'legacy_confirmed'
                ? 'confirmada'
                : 'pendiente_calendar'
            };
          }
          return b;
        });
        
        // 2. Agregar a local cualquier reserva de Google que no tengamos registrada localmente
        data.bookings.forEach(gb => {
          const existsLocal = localBookings.some(b => 
            b.id === gb.id || (b.courtId === gb.courtId && b.fecha === gb.fecha && b.slot === gb.slot && b.status !== 'cancelada')
          );
          if (!existsLocal) {
            updated.push({
              id: gb.id,
              calendarEventId: gb.calendarEventId || '',
              userId: userId,
              courtId: gb.courtId,
              fecha: gb.fecha,
              slot: gb.slot,
              status: gb.status === 'confirmed' || gb.status === 'legacy_confirmed' ? 'confirmada' : 'pendiente_calendar',
              creado: gb.creado || new Date().toISOString()
            });
          }
        });
        
        this.saveBookings(updated);
      }
    } catch (e) {
      console.error('Error sincronizando reservas con Google Calendar:', e);
    }
  },

  seedNewsLocal() {
    const defaultNews = [
      {
        id: 'default-maint',
        category: 'maint',
        title: 'Cuidado de las Canchas de Arcilla',
        body: 'Recordatorio obligatorio para todos los socios: al terminar tu bloque en arcilla, debes pasar el escobillón, barrer las líneas y regar la cancha para el siguiente turno.',
        date: '2026-05-24',
        creado: new Date('2026-05-24T12:00:00Z').toISOString(),
        actualizado: new Date('2026-05-24T12:00:00Z').toISOString()
      },
      {
        id: 'default-app',
        category: 'app',
        title: 'Optimización para iPhone y Móviles',
        body: 'Hemos actualizado la sección de ranking para dispositivos móviles. Ahora verás una barra de navegación fluida que separa la Escalera de tu Ficha personal.',
        date: '2026-05-20',
        creado: new Date('2026-05-20T12:00:00Z').toISOString(),
        actualizado: new Date('2026-05-20T12:00:00Z').toISOString()
      }
    ];
    this.saveNews(defaultNews);
    return defaultNews;
  },

  // ──────────────── SEED DATA ────────────────
  seed() {
    // Migración de correos mock antiguos en localStorage
    try {
      let users = this.getUsers();
      let migrated = false;
      users = users.map(u => {
        if (u.nombre === 'Ismael Devia' && (u.email === 'ismael@uct.cl' || u.id === 'ismael@uct.cl')) { u.email = 'idevia@uct.cl'; u.id = 'm002'; migrated = true; }
        if (u.nombre === 'Luis Otth' && (u.email === 'luis@uct.cl' || u.id === 'luis@uct.cl')) { u.email = 'lotth@uct.cl'; u.id = 'm004'; migrated = true; }
        if (u.nombre === 'Paulo Garrido' && (u.email === 'paulo@uct.cl' || u.id === 'paulo@uct.cl')) { u.email = 'pgarrido@uct.cl'; u.id = 'm031'; migrated = true; }
        if (u.nombre === 'Carolina Cárdenas' && (u.email === 'ccardenas@uct.cl' || u.email === 'ccardeneas@uct.cl') && u.id !== 'f008') { u.email = 'ccardeneas@uct.cl'; u.id = 'f008'; migrated = true; }
        return u;
      });
      if (migrated) {
        this.saveUsers(users);
        const session = this.getSession();
        if (session) {
          if (session.nombre === 'Ismael Devia') { session.email = 'idevia@uct.cl'; session.id = 'm002'; localStorage.setItem('uctenis_session', JSON.stringify(session)); }
          if (session.nombre === 'Luis Otth') { session.email = 'lotth@uct.cl'; session.id = 'm004'; localStorage.setItem('uctenis_session', JSON.stringify(session)); }
          if (session.nombre === 'Paulo Garrido') { session.email = 'pgarrido@uct.cl'; session.id = 'm031'; localStorage.setItem('uctenis_session', JSON.stringify(session)); }
          if (session.nombre === 'Carolina Cárdenas') { session.email = 'ccardeneas@uct.cl'; session.id = 'f008'; localStorage.setItem('uctenis_session', JSON.stringify(session)); }
        }
      }
    } catch (e) {
      console.warn("Error migrating mock emails:", e);
    }

    if (this.getUsers().length === 0) {
      const hombres = [
        { nombre: 'Luis Otth', email: 'lotth@uct.cl', genero: 'M', categoria: 'Primera' },
        { nombre: 'Ismael Devia', email: 'idevia@uct.cl', genero: 'M', categoria: 'Primera' },
        { nombre: 'Paulo Garrido', email: 'pgarrido@uct.cl', genero: 'M', categoria: 'Segunda' },
        { nombre: 'Roberto Bermudez', email: 'roberto@uct.cl', genero: 'M', categoria: 'Segunda' },
        { nombre: 'Francisco Encina', email: 'fencina@uct.cl', genero: 'M', categoria: 'Principiante' },
        { nombre: 'Gustavo Curaqueo', email: 'gcuraqueo@uct.cl', genero: 'M', categoria: 'Principiante' },
        { nombre: 'Cristian Henriquez', email: 'chenriquez@uct.cl', genero: 'M', categoria: 'Primera' },
        { nombre: 'Matías Cáceres', email: 'mcaceres@uct.cl', genero: 'M', categoria: 'Segunda' },
      ];
      const mujeres = [
        { nombre: 'Carolina Cárdenas', email: 'ccardenas@uct.cl', genero: 'F', categoria: 'Primera' },
        { nombre: 'Angélica Encina', email: 'aencina@uct.cl', genero: 'F', categoria: 'Primera' },
        { nombre: 'Violeta Moreno', email: 'vmoreno@uct.cl', genero: 'F', categoria: 'Segunda' },
        { nombre: 'Valeria Schatter', email: 'vschatter@uct.cl', genero: 'F', categoria: 'Principiante' },
        { nombre: 'María José', email: 'mjose@uct.cl', genero: 'F', categoria: 'Segunda' },
      ];
      [...hombres, ...mujeres].forEach(u => {
        this.registerUser({ ...u, password: '1234' });
      });
      this.recalcRanking('M');
      this.recalcRanking('F');
    }

    if (this.getNews().length === 0) {
      this.seedNewsLocal();
    }
  }
};
