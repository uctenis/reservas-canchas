/* UCTenis - Base de datos local + Firebase */

if (typeof window.CONFIG === 'undefined') {
  window.CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbwMDM2xSfPgSSHpgj4Kg7ffl7DxWAWdCVugo5UBJr0aDH0lNfUl0NxXlz6DCr6LDZ86/exec"
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

const FIREBASE_COLLECTIONS = {
  players: 'ranking_players',
  challenges: 'ranking_challenges'
};

const DB_FIREBASE_ADMIN_EMAILS = ['uctenisclub@gmail.com'];
const DB_PURE_ADMIN_EMAILS = ['uctenisclub@gmail.com'];

function normalizeEmailForDb(email) {
  return String(email || '').trim().toLowerCase();
}

function cleanFirestoreData(data) {
  const out = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
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
  return {
    ...(current || {}),
    id: player.id || current.id || '',
    nombre: player.nombre || current.nombre || '',
    email: player.email || current.email || '',
    genero: player.genero || player.gender || current.genero || '',
    categoria: normalizeCategoryForDb(player.categoria || current.categoria || 'Principiante'),
    mano: player.mano || player.manoHabil || current.mano || 'Derecha',
    reves: player.reves || current.reves || 'Dos manos',
    foto: player.foto || current.foto || '',
    telefono: player.telefono || current.telefono || '',
    password: current.password || 'google-auth-no-pass'
  };
}

function normalizeCategoryForDb(value) {
  const raw = String(value || '').trim();
  return raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'abierta'
    ? 'Principiante'
    : raw;
}

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
    const user = {
      id: Date.now().toString(),
      nombre: data.nombre,
      email: data.email,
      password: data.password || 'google-auth-no-pass',
      genero: data.genero, // 'M' o 'F'
      categoria: normalizeCategoryForDb(data.categoria || 'Principiante'),
      mano: data.mano || 'Derecha',
      reves: data.reves || 'Dos manos',
      foto: data.foto || '',
      telefono: data.telefono || '',
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
    return DB_PURE_ADMIN_EMAILS.some(adm => normalizeEmailForDb(adm) === normalized);
  },

  async validateMemberAPI(email) {
    if (!email) return { ok: false, msg: 'Correo no proporcionado.' };
    if (this.isAllowedAccessEmail(email)) return { ok: true, source: 'domain' };

    // 1. Buscar en el ranking estático oficial si está disponible
    if (typeof OFFICIAL_STATIC_RANKING !== 'undefined') {
      const emailLower = email.toLowerCase().trim();
      const foundStatic = [
        ...(OFFICIAL_STATIC_RANKING.M || []),
        ...(OFFICIAL_STATIC_RANKING.F || [])
      ].find(p => p.email && p.email.toLowerCase().trim() === emailLower);
      if (foundStatic) {
        return { ok: true, source: 'static', player: foundStatic };
      }
    }

    // 2. Buscar en usuarios locales
    const localUser = this.getUsers().find(user => normalizeEmailForDb(user.email) === normalizeEmailForDb(email));
    if (localUser) return { ok: true, source: 'local' };

    // 3. Buscar en jugadores de Firebase
    const cloudPlayer = await this.findPlayerByEmailCloud(email);
    if (cloudPlayer) return { ok: true, source: 'firebase', player: cloudPlayer };

    // 4. Consultar a la API de Google Sheets a través de Apps Script
    if (window.CONFIG && window.CONFIG.API_URL) {
      try {
        const params = new URLSearchParams({ action: 'validate_member', email: email.toLowerCase().trim() });
        const res = await fetch(`${window.CONFIG.API_URL}?${params.toString()}`);
        const data = await res.json();
        if (data.ok) {
          return { ok: true, source: 'sheets', player: data.player };
        }
      } catch (err) {
        console.warn('Error validando miembro contra la API de Sheets:', err);
      }
    }

    return { ok: false, msg: 'Acceso restringido a jugadores UCTenis registrados en Firebase o Google Sheets.' };
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

  async loginWithGoogle() {
    if (!this.isFirebaseConfigured()) {
      return { ok: false, demo: true, msg: 'Firebase no configurado. Abre la consola de desarrollo o edita db.js para conectar tu Firebase real.' };
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebaseAuth.signInWithPopup(provider);
      const user = result.user;

      const isPureAdmin = DB_PURE_ADMIN_EMAILS.some(adm => normalizeEmailForDb(adm) === normalizeEmailForDb(user.email));
      if (isPureAdmin) {
        const adminUser = {
          id: makeFirebaseDocId(user.email, 'admin'),
          nombre: user.displayName || 'Administrador UCTenis',
          email: user.email,
          genero: 'M',
          categoria: 'Primera',
          foto: user.photoURL || '',
          telefono: '',
          isAdmin: true
        };
        this.upsertUserLocal(adminUser);
        localStorage.setItem('uctenis_session', JSON.stringify(adminUser));
        return { ok: true, user: adminUser, isNew: false };
      }

      const validation = await this.validateMemberAPI(user.email);
      if (!validation.ok) {
        await firebaseAuth.signOut();
        return { ok: false, msg: validation.msg };
      }

      const localUsers = this.getUsers();
      let localUser = localUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase());

      if (localUser) {
        localStorage.setItem('uctenis_session', JSON.stringify(localUser));
        return { ok: true, user: localUser, isNew: false };
      }

      const cloudPlayer = validation.player || await this.findPlayerByEmailCloud(user.email);
      if (cloudPlayer) {
        localUser = playerToSessionUser(cloudPlayer, {
          email: user.email,
          nombre: user.displayName || cloudPlayer.nombre || '',
          foto: user.photoURL || cloudPlayer.foto || ''
        });
        this.upsertUserLocal(localUser);
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
    const isPureAdmin = DB_PURE_ADMIN_EMAILS.some(adm => normalizeEmailForDb(adm) === normalized);
    if (isPureAdmin) {
      const adminUser = {
        id: makeFirebaseDocId(email, 'admin'),
        nombre: nombre || 'Administrador UCTenis',
        email: email,
        genero: 'M',
        categoria: 'Primera',
        foto: '',
        telefono: '',
        isAdmin: true
      };
      this.upsertUserLocal(adminUser);
      localStorage.setItem('uctenis_session', JSON.stringify(adminUser));
      return { ok: true, user: adminUser, isNew: false };
    }

    const validation = await this.validateMemberAPI(email);
    if (!validation.ok) {
      return { ok: false, msg: validation.msg };
    }

    const localUsers = this.getUsers();
    let localUser = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (localUser) {
      localStorage.setItem('uctenis_session', JSON.stringify(localUser));
      return { ok: true, user: localUser, isNew: false };
    }

    const cloudPlayer = validation.player || await this.findPlayerByEmailCloud(email);
    if (cloudPlayer) {
      localUser = playerToSessionUser(cloudPlayer, { email, nombre: nombre || cloudPlayer.nombre || '' });
      this.upsertUserLocal(localUser);
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
    const result = this.registerUser({
      nombre: data.nombre,
      email: data.email,
      password: 'google-auth-no-pass',
      genero: data.genero,
      categoria: normalizeCategoryForDb(data.categoria),
      mano: data.mano || 'Derecha',
      reves: data.reves || 'Dos manos',
      foto: data.foto || '',
      telefono: data.telefono || ''
    });
    if (result.ok) {
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
    return JSON.parse(localStorage.getItem('uctenis_session') || 'null');
  },
  logout() {
    localStorage.removeItem('uctenis_session');
    if (this.isFirebaseConfigured()) {
      firebaseAuth.signOut().catch(err => console.error("Error al cerrar sesión de Firebase:", err));
    }
  },
  updateUser(updatedUser) {
    const users = this.getUsers().map(u => u.id === updatedUser.id ? updatedUser : u);
    this.saveUsers(users);
    localStorage.setItem('uctenis_session', JSON.stringify(updatedUser));
  },

  // ──────────────── FIREBASE: JUGADORES ────────────────
  async getPlayersCloud() {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const snapshot = await firebaseDb.collection(FIREBASE_COLLECTIONS.players).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async findPlayerByEmailCloud(email) {
    const normalized = normalizeEmailForDb(email);
    if (!normalized || !this.isCloudConfigured()) return null;

    try {
      const snapshot = await firebaseDb
        .collection(FIREBASE_COLLECTIONS.players)
        .where('emailLower', '==', normalized)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
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
    const activeValue = player.activo ?? player.participaRanking;
    const data = cleanFirestoreData({
      ...player,
      id,
      genero: player.genero || player.gender || '',
      activo: activeValue === undefined ? true : activeValue !== false,
      participaRanking: activeValue === undefined ? true : activeValue !== false,
      telefono: formatPhoneNumber(player.telefono),
      emailLower,
      updatedAt: now,
      updatedBy: actor.email || actor.adminEmail || actor.actorEmail || ''
    });

    await firebaseDb.collection(FIREBASE_COLLECTIONS.players).doc(id).set(data, { merge: true });
    return data;
  },

  async savePlayersCloud(players, actor = {}) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const batch = firebaseDb.batch();
    const now = new Date().toISOString();
    const saved = [];

    players.forEach(player => {
      const id = player.id || makeFirebaseDocId(player.nombre || player.email, 'player');
      const activeValue = player.activo ?? player.participaRanking;
      const data = cleanFirestoreData({
        ...player,
        id,
        genero: player.genero || player.gender || '',
        activo: activeValue === undefined ? true : activeValue !== false,
        participaRanking: activeValue === undefined ? true : activeValue !== false,
        telefono: formatPhoneNumber(player.telefono),
        emailLower: normalizeEmailForDb(player.email),
        updatedAt: now,
        updatedBy: actor.email || actor.adminEmail || actor.actorEmail || ''
      });
      const ref = firebaseDb.collection(FIREBASE_COLLECTIONS.players).doc(id);
      batch.set(ref, data, { merge: true });
      saved.push(data);
    });

    if (saved.length) await batch.commit();
    return saved;
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

  // ──────────────── FIREBASE: DESAFÍOS ────────────────
  async getChallengesCloud() {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const snapshot = await firebaseDb.collection(FIREBASE_COLLECTIONS.challenges).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (b.creado || '').localeCompare(a.creado || ''));
  },

  async saveChallengeCloud(challenge) {
    if (!this.isCloudConfigured()) throw new Error('Firestore no está disponible.');
    const id = challenge.id || makeFirebaseDocId(`challenge-${Date.now()}`, 'challenge');
    const now = new Date().toISOString();
    const data = cleanFirestoreData({
      ...challenge,
      id,
      status: challenge.status || 'pendiente',
      creado: challenge.creado || now,
      actualizado: now
    });
    await firebaseDb.collection(FIREBASE_COLLECTIONS.challenges).doc(id).set(data, { merge: true });
    return data;
  },

  async updateChallengeCloud(id, patch) {
    const current = this.getChallenges().find(challenge => challenge.id === id) || {};
    return this.saveChallengeCloud({ ...current, ...patch, id });
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
    const challenges = this.getChallenges().filter(c => c.status === 'completado' && c.genero === genero);

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
      const winnerId = challenge.ganadorId;
      const loserId = winnerId === challenge.retadorId ? challenge.retadoId : challenge.retadorId;
      const winnerIndex = findIndex(winnerId);
      const loserIndex = findIndex(loserId);
      if (winnerIndex < 0 || loserIndex < 0) return;
      if (winnerIndex > loserIndex) {
        const temp = ranking[winnerIndex];
        ranking[winnerIndex] = ranking[loserIndex];
        ranking[loserIndex] = temp;
      }
    });

    const ranked = ranking.map((player, index) => ({ ...player, pos: index + 1 }));
    this.saveRanking(genero, ranked);
    return ranked;
  },

  // ──────────────── DESAFÍOS ────────────────
  getChallenges() {
    let list = JSON.parse(localStorage.getItem('uctenis_challenges') || '[]');
    return list.filter(c => c.status !== 'eliminado' && c.id !== '1779815098805' && !(c.fecha === '2026-05-29' && (c.retadoId === 'm004' || String(c.retadoNombre).toLowerCase().includes('otth')) && c.status === 'rechazado'));
  },
  saveChallenges(list) {
    const filtered = list.filter(c => c.status !== 'eliminado' && c.id !== '1779815098805' && !(c.fecha === '2026-05-29' && (c.retadoId === 'm004' || String(c.retadoNombre).toLowerCase().includes('otth')) && c.status === 'rechazado'));
    localStorage.setItem('uctenis_challenges', JSON.stringify(filtered));
  },
  createChallenge(retadorId, retadoId, genero, fecha, cancha) {
    const challenges = this.getChallenges();
    const nuevo = {
      id: Date.now().toString(),
      retadorId, retadoId, genero,
      fecha, cancha,
      status: 'pendiente', // pendiente | aceptado | rechazado | completado
      marcador: null,
      ganadorId: null,
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
  submitResult(id, marcador, ganadorId) {
    const list = this.getChallenges().map(c => {
      if (c.id === id) return { ...c, status: 'completado', marcador, ganadorId };
      return c;
    });
    this.saveChallenges(list);
    const c = list.find(x => x.id === id);
    if (c) this.recalcRanking(c.genero);
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
  // Si el usuario ya reservó HOY (regla: 1 por día)
  userBookedToday(userId, fecha) {
    return this.getBookings().some(b => b.userId === userId && b.fecha === fecha && b.status !== 'cancelada');
  },
  createBooking(userId, courtId, fecha, slot) {
    const bookings = this.getBookings();
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
    try {
      const params = new URLSearchParams({ action: 'get_available_slots', date: fechaStr });
      const res = await fetch(`${window.CONFIG.API_URL}?${params.toString()}`);
      const data = await res.json();
      return data; // { ok: true, courts: { cec1: ["09:00", ...], cec2: [...] } }
    } catch (e) {
      console.error('Error obteniendo disponibilidad:', e);
      return { ok: false };
    }
  },

  // Nota: Para usar la versión real que agenda en Google Calendar, se llama a esta función
  async createBookingAPI(userId, courtId, fecha, slot) {
    const user = this.getUsers().find(u => u.id === userId);
    if (!user) return { ok: false, msg: 'Usuario no encontrado' };

    try {
      // Usar la URL que está en script.js (CONFIG.API_URL)
      const params = new URLSearchParams({
        action: 'create_booking',
        email: user.email,
        name: user.nombre,
        courtId: courtId,
        date: fecha,
        slot: slot
      });
      const res = await fetch(`${window.CONFIG.API_URL}?${params.toString()}`);
      
      const data = await res.json();
      if (!data.ok) {
        return { ok: false, msg: data.msg };
      }

      // Si fue exitoso en Google, lo guardamos localmente también
      const bookings = this.getBookings();
      const b = { id: data.eventId || Date.now().toString(), userId, courtId, fecha, slot, status: 'confirmada', creado: new Date().toISOString() };
      bookings.push(b);
      this.saveBookings(bookings);
      return { ok: true, booking: b };
    } catch (e) {
      console.error('Error conectando a Apps Script:', e);
      return { ok: false, msg: 'No se pudo conectar al servidor de reservas. Intenta nuevamente.' };
    }
  },

  async cancelBookingAPI(bookingId, courtId) {
    try {
      const params = new URLSearchParams({
        action: 'cancel_booking',
        courtId: courtId,
        eventId: bookingId
      });
      const res = await fetch(`${window.CONFIG.API_URL}?${params.toString()}`);
      const data = await res.json();
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
    const user = this.getUsers().find(u => u.id === userId);
    if (!user || !this.isFirebaseConfigured()) return;
    
    try {
      const params = new URLSearchParams({
        action: 'get_user_bookings',
        email: user.email
      });
      const res = await fetch(`${window.CONFIG.API_URL}?${params.toString()}`);
      const data = await res.json();
      
      if (data.ok && data.bookings) {
        const localBookings = this.getBookings();
        
        // 1. Marcar las reservas locales futuras del usuario que NO están en Google Calendar como canceladas
        const updated = localBookings.map(b => {
          if (b.userId === userId && b.status !== 'cancelada') {
            const isPast = new Date(b.fecha + 'T' + b.slot + ':00') < new Date();
            if (isPast) return b;
            
            const existsInGoogle = data.bookings.some(gb => 
              gb.id === b.id || (gb.courtId === b.courtId && gb.fecha === b.fecha && gb.slot === b.slot)
            );
            if (!existsInGoogle) {
              return { ...b, status: 'cancelada' };
            }
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
              userId: userId,
              courtId: gb.courtId,
              fecha: gb.fecha,
              slot: gb.slot,
              status: 'confirmada',
              creado: new Date().toISOString()
            });
          }
        });
        
        this.saveBookings(updated);
      }
    } catch (e) {
      console.error('Error sincronizando reservas con Google Calendar:', e);
    }
  },

  // ──────────────── SEED DATA ────────────────
  seed() {
    if (this.getUsers().length > 0) return;
    const hombres = [
      { nombre: 'Luis Otth', email: 'luis@uct.cl', genero: 'M', categoria: 'Primera' },
      { nombre: 'Ismael Devia', email: 'ismael@uct.cl', genero: 'M', categoria: 'Primera' },
      { nombre: 'Paulo Garrido', email: 'paulo@uct.cl', genero: 'M', categoria: 'Segunda' },
      { nombre: 'Roberto Bermudez', email: 'roberto@uct.cl', genero: 'M', categoria: 'Segunda' },
      { nombre: 'Francisco Encina', email: 'fencina@uct.cl', genero: 'M', categoria: 'Principiante' },
      { nombre: 'Gustavo Curaqueo', email: 'gcuraqueo@uct.cl', genero: 'M', categoria: 'Principiante' },
      { nombre: 'Cristian Henriquez', email: 'chenriquez@uct.cl', genero: 'M', categoria: 'Primera' },
      { nombre: 'Matías Cáceres', email: 'mcaceres@uct.cl', genero: 'M', categoria: 'Segunda' },
    ];
    const mujeres = [
      { nombre: 'Carolina Cárdenas', email: 'ccardeneas@uct.cl', genero: 'F', categoria: 'Primera' },
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
};
