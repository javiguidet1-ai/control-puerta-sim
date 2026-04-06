require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./database');

db.prepare(`
  INSERT INTO configuracion (clave, valor, descripcion, fecha_modificacion)
  VALUES ('telefono_puerta', '672230144', 'Número de teléfono del controlador de la puerta (SIM 6036)', datetime('now'))
  ON CONFLICT(clave) DO UPDATE SET
    valor = '672230144',
    fecha_modificacion = datetime('now')
`).run();

console.log('✓ Teléfono de la puerta configurado: 672230144 (6036)');
