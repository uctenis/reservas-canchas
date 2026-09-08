const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

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
  CONFIG: { FIREBASE_PROJECT_ID: 'test', FIREBASE_API_KEY: 'test', CALENDARS: { cec1: 'x', cec2: 'x', cjp1: 'x', cjp2: 'x' } },
  Utilities: { getUuid: () => 'uuid-12345678', formatDate(date) { return date.toISOString().slice(0, 10); }, sleep() {} },
  Session: { getActiveUser() { return { getEmail() { return 'uctenisclub@gmail.com'; } }; } },
  ScriptApp: { getOAuthToken() { return 'server-token'; } },
  LockService: { getScriptLock() { return { waitLock() {}, tryLock() { return true; }, releaseLock() {} }; } },
  PropertiesService: { getScriptProperties() { return { getProperty() { return null; }, setProperty() {} }; } },
  MailApp: { sendEmail() {} },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput(value) { return { value, setMimeType() { return this; } }; }
  }
};
vm.createContext(context);
// El cuadro de eliminación directa (buildTournamentBracket/validateTournamentScore)
// vive dentro de apps_script_backend.js: ahí es donde se despliega, en un solo
// archivo Código.gs. Se carga el archivo completo aunque el test solo ejercite
// estas dos funciones puras.
vm.runInContext(fs.readFileSync('apps_script_backend.js', 'utf8'), context);

const players = count => Array.from({length:count}, (_,i)=>({id:`p${i+1}`,name:`Jugador ${i+1}`,seed:i+1,status:'active'}));

const full = context.buildTournamentBracket({size:8,participants:players(8)});
assert.equal(full.ok,true);
assert.equal(full.matches.length,7);
assert.equal(full.matches.filter(m=>m.roundName==='Final').length,1);
assert.equal(full.matches.filter(m=>m.status==='pending').length,7);

const sparse = context.buildTournamentBracket({size:8,participants:players(2)});
assert.equal(sparse.ok,true);
const playable = sparse.matches.filter(m=>m.player1 && m.player2 && m.status==='pending');
assert.equal(playable.length,1);
assert.equal(playable[0].roundName,'Final');

assert.equal(context.validateTournamentScore([{a:6,b:3},{a:7,b:5}],'',{id:'a'},{id:'b'}).winnerId,'a');
assert.equal(context.validateTournamentScore([{a:4,b:6},{a:6,b:2},{a:10,b:7}],'',{id:'a'},{id:'b'}).winnerId,'a');
assert.equal(context.validateTournamentScore([{a:6,b:5},{a:6,b:2}],'',{id:'a'},{id:'b'}).ok,false);
assert.equal(context.validateTournamentScore([], 'b', {id:'a'}, {id:'b'}).winnerId,'b');

// El borrado permanente debe liberar todas las reservas antes de borrar el
// documento, deduplicar IDs repetidos y fallar cerrado ante cualquier error.
const originals = {
  isAdminRequest: context.isAdminRequest,
  readTournament: context.readTournament,
  releaseTournamentBooking: context.releaseTournamentBooking,
  UrlFetchApp: context.UrlFetchApp
};
context.isAdminRequest = () => true;
context.readTournament = () => ({
  ok: true,
  tournament: { matches: [{bookingId:'booking-1'}, {bookingId:'booking-1'}, {bookingId:'booking-2'}, {}] }
});
const released = [];
context.releaseTournamentBooking = id => { released.push(id); return {ok:true}; };
let deleteCalls = 0;
context.UrlFetchApp = { fetch() { deleteCalls++; return {getResponseCode:()=>200,getContentText:()=>''}; } };
let deletion = context.adminPermanentlyDeleteTournament({id:'tour-1',idToken:'token'});
assert.equal(deletion.ok, true);
assert.deepEqual(released, ['booking-1','booking-2']);
assert.equal(deleteCalls, 1);

context.readTournament = () => ({ok:false,msg:'Firestore GET 503'});
deletion = context.adminPermanentlyDeleteTournament({id:'tour-1',idToken:'token'});
assert.equal(deletion.ok, false);
assert.equal(deleteCalls, 1, 'No debe borrar si no pudo leer el campeonato');

context.readTournament = () => ({ok:true,tournament:{matches:[{bookingId:'booking-3'}]}});
context.releaseTournamentBooking = () => ({ok:false,msg:'Reserva inaccesible'});
deletion = context.adminPermanentlyDeleteTournament({id:'tour-1',idToken:'token'});
assert.equal(deletion.ok, false);
assert.equal(deletion.failed, 1);
assert.equal(deleteCalls, 1, 'No debe borrar si queda una reserva activa');

Object.assign(context, originals);

console.log('tournament backend tests: OK');
