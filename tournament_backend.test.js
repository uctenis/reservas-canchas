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

console.log('tournament backend tests: OK');
