require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./database');

console.log('Inicializando 200 casilleros...');

const insert = db.prepare(`
  INSERT OR IGNORE INTO casilleros (id_casillero, nombre_titular, telefono_activo, estado)
  VALUES (?, 'SIN ASIGNAR', '', 'INACTIVO')
`);

db.exec('BEGIN');
try {
  for (let i = 1; i <= 200; i++) {
    insert.run(i);
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

const count = db.prepare('SELECT COUNT(*) as total FROM casilleros').get().total;
console.log(`✓ Total casilleros en BD: ${count}`);
console.log('Seed completado correctamente.');
