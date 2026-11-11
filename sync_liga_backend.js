// Copia liga.js al final de apps_script_backend.js (entre marcadores), para
// que el backend de Apps Script sea un solo archivo. Correr con
// `node sync_liga_backend.js` cada vez que cambie liga.js; liga.test.js
// falla si la copia quedó desactualizada.
const fs = require('fs');
const path = require('path');

const BEGIN = '// ==== liga.js (copia automática: no editar aquí, correr node sync_liga_backend.js) ====';
const END = '// ==== fin de liga.js ====';

function embedded(backend, liga) {
  const start = backend.indexOf(BEGIN);
  const base = start >= 0 ? backend.slice(0, start).replace(/\s+$/, '') : backend.replace(/\s+$/, '');
  return `${base}\n\n${BEGIN}\n${liga.replace(/\s+$/, '')}\n${END}\n`;
}

if (require.main === module) {
  const backendPath = path.join(__dirname, 'apps_script_backend.js');
  const liga = fs.readFileSync(path.join(__dirname, 'liga.js'), 'utf8');
  fs.writeFileSync(backendPath, embedded(fs.readFileSync(backendPath, 'utf8'), liga));
  console.log('liga.js copiado dentro de apps_script_backend.js');
}

module.exports = { embedded };
