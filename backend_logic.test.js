const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sentEmails = [];
const scriptProperties = new Map();
const context = {
  console,
  Date,
  Math,
  JSON,
  String,
  Number,
  Boolean,
  Array,
  Object,
  RegExp,
  Error,
  encodeURIComponent,
  setTimeout,
  MailApp: { sendEmail(message) { sentEmails.push(message); } },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty(key) { return scriptProperties.get(key) || null; },
        setProperty(key, value) { scriptProperties.set(key, value); }
      };
    }
  },
  Utilities: {
    formatDate(date) { return date.toISOString().slice(0, 10); },
    getUuid() { return 'test-uuid'; },
    sleep() {}
  },
  Session: { getActiveUser() { return { getEmail() { return 'uctenisclub@gmail.com'; } }; } },
  ScriptApp: { getOAuthToken() { return 'server-token'; } },
  LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput(value) { return { value, setMimeType() { return this; } }; }
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps_script_backend.js', 'utf8'), context);

function testSharedCalendarInvitation() {
  sentEmails.length = 0;
  const addedGuests = [];
  const savedBookings = [];
  const event = {
    addGuest(email) { addedGuests.push(email); },
    setTitle(value) { this.title = value; },
    setDescription(value) { this.description = value; },
    getId() { return 'calendar-event-1'; }
  };
  const booking = {
    id: 'cec1_2026-08-20_1800', courtId: 'cec1', date: '2026-08-20', slot: '18:00',
    email: 'retador@uct.cl', status: 'confirmed', calendarEventId: 'calendar-event-1'
  };
  context.getBookingDocument = () => ({ ok: true, booking: { ...booking } });
  context.saveBookingDocument = value => { savedBookings.push({ ...value }); return { ok: true, booking: value }; };
  context.CalendarApp = {
    getCalendarById() { return { getEventById() { return event; } }; },
    getDefaultCalendar() { throw new Error('No debe crear un segundo evento'); }
  };

  const result = context.notifyChallenge({
    id: 'chal-1', bookingId: booking.id, courtId: 'cec1', tipo: 'amistoso',
    retadorNombre: 'Ana', retadorEmail: 'ana@uct.cl',
    retadoNombre: 'Beatriz', retadoEmail: 'bea@uct.cl',
    fecha: '2026-08-20', fechaLabel: '20 de agosto', slot: '18:00', cancha: 'CEC 1'
  });

  assert.equal(result.ok, true);
  assert.equal(result.calendar.reusedBooking, true);
  assert.deepEqual(Array.from(addedGuests).sort(), ['ana@uct.cl', 'bea@uct.cl']);
  assert.equal(sentEmails.length, 2, 'se envía un correo personalizado a cada jugador');
  assert.match(sentEmails[0].subject, /Invitación amistoso/);
  assert.match(sentEmails[1].subject, /amistoso enviado/i);
  assert.match(event.title, /Partido amistoso UCTenis/);
  assert.deepEqual(Array.from(savedBookings[0].guestEmails), ['ana@uct.cl', 'bea@uct.cl']);
}

function testPendingCalendarCarriesBothGuests() {
  sentEmails.length = 0;
  let saved;
  context.getBookingDocument = () => ({
    ok: true,
    booking: { id: 'cjp1_2026-08-21_1930', courtId: 'cjp1', status: 'calendar_retry', calendarEventId: '' }
  });
  context.saveBookingDocument = value => { saved = { ...value }; return { ok: true, booking: value }; };
  context.CalendarApp = { getCalendarById() { return null; }, getDefaultCalendar() { throw new Error('No debe crear evento paralelo'); } };
  const result = context.notifyChallenge({
    id: 'chal-2', bookingId: 'cjp1_2026-08-21_1930', courtId: 'cjp1', tipo: 'ranking',
    retadorNombre: 'Carlos', retadorEmail: 'carlos@uct.cl',
    retadoNombre: 'Diego', retadoEmail: 'diego@uct.cl',
    fecha: '2026-08-21', slot: '19:30', cancha: 'CJP 1'
  });
  assert.equal(result.ok, true);
  assert.equal(result.calendar.pending, true);
  assert.deepEqual(Array.from(saved.guestEmails), ['carlos@uct.cl', 'diego@uct.cl']);
  assert.equal(sentEmails.length, 2);
}

function testRetryCounterAndAdminAlert() {
  sentEmails.length = 0;
  const booking = {
    id: 'cec2_2026-08-22_1800', courtId: 'cec2', date: '2026-08-22', slot: '18:00',
    name: 'Jugador', email: 'jugador@uct.cl', status: 'calendar_retry', syncAttempts: 4
  };
  const saved = [];
  context.queryBookingDocuments = () => ({ ok: true, bookings: [booking] });
  context.findCalendarEventForBooking = () => null;
  context.createBookingCalendarEvent = () => { throw new Error('Calendar temporalmente no disponible'); };
  context.saveBookingDocument = value => { saved.push({ ...value }); return { ok: true, booking: value }; };

  const result = context.retryPendingBookingSync();
  assert.equal(result.failed, 1);
  assert.equal(saved[0].syncAttempts, 5);
  assert.match(saved[0].syncError, /Calendar temporalmente/);
  assert.ok(saved[0].syncAlertedAt, 'registra cuándo notificó al administrador');
  assert.equal(sentEmails.length, 1, 'alerta al alcanzar cinco intentos');
  assert.ok(context.getBookingSyncRunStatus().lastRunAt);
}

function testChallengeRequestAuthentication() {
  context.verifyGoogleIdToken = () => 'otra-persona@uct.cl';
  const denied = context.notifyChallengeRequest({ retadorEmail: 'retador@uct.cl' });
  assert.equal(denied.ok, false);
  assert.match(denied.msg, /permiso/i);
}

function testResultNotifiesBothPlayers() {
  sentEmails.length = 0;
  const result = context.notifyResult({
    ganadorNombre: 'Ana', ganadorEmail: 'ana@uct.cl',
    perdedorNombre: 'Beatriz', perdedorEmail: 'bea@uct.cl',
    marcador: '6-4, 6-3', fecha: '2026-08-20', cancha: 'CEC 1'
  });
  assert.equal(result.ok, true);
  assert.equal(sentEmails.length, 2);
  assert.equal(result.emails.ganador.ok, true);
  assert.equal(result.emails.perdedor.ok, true);
}

function testRejectedChallengeReleasesCourtAndNotifiesChallenger() {
  let released = false;
  let responseNotification = '';
  const challenge = {
    id: 'chal-reject', status: 'pendiente', tipo: 'amistoso',
    bookingId: 'cec1_2026-08-23_1800', courtId: 'cec1', eventId: '',
    retadorEmail: 'ana@uct.cl', retadorNombre: 'Ana',
    retadoEmail: 'bea@uct.cl', retadoNombre: 'Beatriz'
  };
  const range = { getValues() { return [[]]; }, setValue() {} };
  const sheet = { getRange() { return range; }, deleteRow() {} };
  context.verifyGoogleIdToken = () => 'bea@uct.cl';
  context.findChallengeRow = () => ({ sheet, rowNumber: 2 });
  context.challengeFromRow = () => ({ ...challenge });
  context.releaseChallengeBooking = () => { released = true; return true; };
  context.notifyChallengeResponse = (_challenge, status) => { responseNotification = status; };

  const result = context.respondChallenge({ id: challenge.id, accept: false, idToken: 'valid-token' });
  assert.equal(result.ok, true);
  assert.equal(released, true, 'el rechazo libera la reserva de cancha');
  assert.equal(responseNotification, 'rechazado', 'se informa al retador del rechazo');
}

assert.equal(context.bookingDocumentId('CEC1', '2026-08-20', '18:00'), 'cec1_2026-08-20_1800');
testSharedCalendarInvitation();
testPendingCalendarCarriesBothGuests();
testRetryCounterAndAdminAlert();
testChallengeRequestAuthentication();
testResultNotifiesBothPlayers();
testRejectedChallengeReleasesCourtAndNotifiesChallenger();
console.log('backend_logic.test.js: OK');
