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
  const origCreateBookingCalendarEvent = context.createBookingCalendarEvent;
  context.queryBookingDocuments = () => ({ ok: true, bookings: [booking] });
  context.findCalendarEventForBooking = () => null;
  context.createBookingCalendarEvent = () => { throw new Error('Calendar temporalmente no disponible'); };
  context.saveBookingDocument = value => { saved.push({ ...value }); return { ok: true, booking: value }; };

  try {
    const result = context.retryPendingBookingSync();
    assert.equal(result.failed, 1);
    assert.equal(saved[0].syncAttempts, 5);
    assert.match(saved[0].syncError, /Calendar temporalmente/);
    assert.ok(saved[0].syncAlertedAt, 'registra cuándo notificó al administrador');
    assert.equal(sentEmails.length, 1, 'alerta al alcanzar cinco intentos');
    assert.ok(context.getBookingSyncRunStatus().lastRunAt);
  } finally {
    context.createBookingCalendarEvent = origCreateBookingCalendarEvent;
  }
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

function testSingleCalendarTaggingAndDetection() {
  assert.equal(context.getCourtName('cec1'), 'CEC Cancha 1');
  assert.equal(context.getCourtName('cec2'), 'CEC Cancha 2');
  assert.equal(context.getCourtName('cjp1'), 'CJP Cancha 1');
  assert.equal(context.getCourtName('cjp2'), 'CJP Cancha 2');

  const ev1 = { getTitle() { return '[CEC Cancha 2] Reserva UCTenis - Carlos'; }, getDescription() { return ''; }, getLocation() { return 'CEC Cancha 2'; } };
  assert.equal(context.detectCourtFromEvent(ev1), 'cec2');

  const ev2 = { getTitle() { return 'Reserva UCTenis - Pedro'; }, getDescription() { return 'Cancha: CJP Cancha 1 (cjp1)\nUsuario: Pedro'; }, getLocation() { return ''; } };
  assert.equal(context.detectCourtFromEvent(ev2), 'cjp1');

  const ev3 = { getTitle() { return '[CJP Cancha 2] Desafío UCTenis: Ana vs Bea'; }, getDescription() { return ''; }, getLocation() { return 'CJP Cancha 2'; } };
  assert.equal(context.detectCourtFromEvent(ev3), 'cjp2');
}

function testCreateBookingCalendarEventFormat() {
  let createdTitle = '';
  let createdOptions = {};
  const mockCalendar = {
    createEvent(title, start, end, options) {
      createdTitle = title;
      createdOptions = options;
      return { getId() { return 'new-event-123'; } };
    }
  };
  context.CalendarApp = {
    getCalendarById(id) {
      assert.equal(id, 'e500541f01f115243cc82fdd8cb8af53885461cb6d91e8f6e2c22ed07557c23c@group.calendar.google.com');
      return mockCalendar;
    }
  };

  const booking = {
    id: 'cec1_2026-08-25_1800',
    courtId: 'cec1',
    date: '2026-08-25',
    slot: '18:00',
    name: 'David Silva',
    email: 'dsilva@uct.cl',
    rut: '12.345.678-9',
    userTypeLabel: 'Socio UCTenis'
  };

  const event = context.createBookingCalendarEvent(booking);
  assert.equal(event.getId(), 'new-event-123');
  assert.equal(createdTitle, '[CEC Cancha 1] Reserva UCTenis - David Silva');
  assert.equal(createdOptions.location, 'CEC Cancha 1');
  assert.match(createdOptions.description, /Reserva-ID: cec1_2026-08-25_1800/);
  assert.match(createdOptions.description, /RUT: 12\.345\.678-9/);
  assert.match(createdOptions.description, /Cancha: CEC Cancha 1 \(cec1\)/);
  assert.match(createdOptions.description, /Tipo: Socio UCTenis/);
}

function testCourtDigestTableAndSecurityFormat() {
  const sampleBookings = [
    {
      slot: '18:00',
      courtName: 'CEC Cancha 1',
      nombre: 'David Silva',
      rut: '12.345.678-9',
      userTypeLabel: 'Socio UCTenis'
    },
    {
      slot: '19:30',
      courtName: 'CJP Cancha 2',
      nombre: 'María González',
      rut: '18.765.432-1',
      userTypeLabel: 'Funcionario UCT'
    }
  ];

  const htmlTable = context.buildCourtDigestTable(sampleBookings);
  assert.match(htmlTable, /Hora/);
  assert.match(htmlTable, /Cancha/);
  assert.match(htmlTable, /Reservado por \/ Acceso/);
  assert.match(htmlTable, /18:00/);
  assert.match(htmlTable, /CEC Cancha 1/);
  assert.match(htmlTable, /David Silva/);
  assert.match(htmlTable, /RUT: 12\.345\.678-9/);
  assert.match(htmlTable, /Socio UCTenis/);
  assert.match(htmlTable, /CJP Cancha 2/);
  assert.match(htmlTable, /María González/);
  assert.match(htmlTable, /Funcionario UCT/);
}

assert.equal(context.bookingDocumentId('CEC1', '2026-08-20', '18:00'), 'cec1_2026-08-20_1800');
testSharedCalendarInvitation();
testPendingCalendarCarriesBothGuests();
testRetryCounterAndAdminAlert();
testChallengeRequestAuthentication();
testResultNotifiesBothPlayers();
testRejectedChallengeReleasesCourtAndNotifiesChallenger();
testSingleCalendarTaggingAndDetection();
testCreateBookingCalendarEventFormat();
testCourtDigestTableAndSecurityFormat();
console.log('backend_logic.test.js: OK');
