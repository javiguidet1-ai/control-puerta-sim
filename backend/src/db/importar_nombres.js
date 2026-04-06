require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./database');

// [id_casillero, telefono_esperado_en_BD, nombre_titular]
// Solo actualiza si telefono_activo en BD coincide con el esperado.
const datos = [
  // ── TITULARES CON NOMBRE COMPLETO (de hoja histórica) ──────────────────────
  [1,   '6080',       'ALABARCE GONZALEZ FERNANDO'],
  [2,   '5017',       'DIAZ VARGAS MARCOS'],
  [3,   '6085',       'FERNANDEZ PARAMO JOSE MANUEL'],
  [4,   '673516481',  'GAMERO TEJADA MIGUEL'],
  [5,   '622279355',  'GUTIERREZ MARTIN JUAN CARLOS'],
  [6,   '6021',       'NAVARRO LOPEZ BRIGIDA'],
  [7,   '6034',       'PRATS DIAZ MARIA JOSE (MIBUS)'],
  [8,   '2546',       'SANCHEZ LOPEZ MARIA JOSE'],
  [9,   '2020',       'GONZALEZ GARCIA JOSE CARLOS'],
  [10,  '6087',       'GUERRERO PEREZ FRANCISCO JAVIER'],
  [11,  '6030',       'JIMENEZ RODRIGUEZ JUAN JOSE'],
  [12,  '5015',       'MELERO HEREDIA SERGIO DAVID'],
  [13,  '2554',       'PEREZ BAUTISTA FRANCISCO JAVIER'],
  [14,  '5021',       'PEREZ ORTIZ CARLOS'],
  [15,  '2555',       'ROMERO GARRIDO RUBEN'],
  [16,  '619673814',  'SANTIAGO ENRIQUEZ JUAN FRANCISCO'],
  [17,  '671606482',  'TRUJILLO VILLA SERGIO'],

  // ── CONDUCTORES CADIAR / DELTABUS ──────────────────────────────────────────
  [26,  '2549',       'Mari Delta'],
  [27,  '2521',       'Jose Galdeano Venta Tarugo'],
  [28,  '2527',       'Antonio Deltabus Taxi'],
  [29,  '6047',       'Fernando Conductor Cadiar Deltabus'],
  [30,  '5011',       'Anibal Cadiar'],
  [31,  '6011',       'Nico Arbarlejo'],
  [32,  '5014',       'Miguel Garrido'],
  [33,  '673401300',  'Eduardo Delta'],
  [37,  '2545',       'Mari Delta'],
  [38,  '6073',       'Adrian Berchules Conductor'],
  [39,  '6072',       'Juanfra Cadiar Conductor Deltabus'],
  [40,  '6033',       'Antonio Deltabus Taxi'],
  [41,  '6013',       'Jose Galdeano Venta Tarugo'],
  [47,  '664081862',  'Youssef Trabajo'],
  [54,  '669782662',  'Fernando Conductor Cadiar Deltabus'],
  [55,  '619276757',  'Anibal Cadiar'],
  [57,  '620756951',  'Eduardo Delta'],
  [99,  '678230342',  'Antonio Deltabus Taxi'],
  [100, '685350859',  'Juanfra Cadiar Conductor Deltabus'],
  [102, '629513767',  'Adrian Berchules Conductor'],
  [136, '659994189',  'Mari Delta'],
  [147, '639236781',  'Francis Deltabus'],

  // ── TRANSQUALITY ───────────────────────────────────────────────────────────
  [58,  '662920291',  'TRANSQUALITY 14'],
  [63,  '677962980',  'TRANSQUALITY 38'],
  [66,  '651151499',  'TRANSQUALITY 4'],
  [69,  '647806174',  'TRANSQUALITY 3'],
  [71,  '677962911',  'TRANSQUALITY 31'],
  [72,  '605781686',  'TRANSQUALITY 32'],
  [73,  '673401199',  'TRANSQUALITY 29'],
  [74,  '677962830',  'TRANSQUALITY 34'],
  [75,  '681938256',  'TRANSQUALITY 39'],
  [76,  '655971335',  'TRANSQUALITY 15'],
  [79,  '646424247',  'TRANSQUALITY 13'],
  [80,  '650429547',  'TRANSQUALITY 2'],
  [81,  '673401216',  'TRANSQUALITY 23'],
  [82,  '635344289',  'TRANSQUALITY 22'],
  [83,  '678971969',  'TRANSQUALITY 21'],
  [84,  '666454697',  'TRANSQUALITY 24'],
  [85,  '666454702',  'TRANSQUALITY 25'],
  [86,  '627507327',  'TRANSQUALITY 26'],
  [87,  '677962855',  'TRANSQUALITY 27'],
  [88,  '609672471',  'TRANSQUALITY 30'],
  [89,  '677962824',  'TRANSQUALITY 33'],
  [90,  '619166083',  'TRANSQUALITY 28'],
  [91,  '666478871',  'TRANSQUALITY 35'],
  [92,  '697874132',  'TRANSQUALITY 40'],
  [96,  '605315248',  'TRANSQUALITY 12'],
  [97,  '666454682',  'TRANSQUALITY 8'],
  [98,  '600961017',  'TRANSQUALITY 5'],
  [104, '615707516',  'TRANSQUALITY 18'],
  [105, '606380257',  'TRANSQUALITY 1'],
  [114, '671605688',  'TRANSQUALITY 10'],
  [117, '653877037',  'TRANSQUALITY 9'],
  [125, '660303396',  'TRANSQUALITY 42'],
  [126, '666454686',  'TRANSQUALITY 43'],
  [130, '647369711',  'TRANSQUALITY 36'],
  [131, '671519505',  'TRANSQUALITY 37'],
  [145, '622448861',  'TRANSQUALITY 44'],
  [146, '626682966',  'TRANSQUALITY 41'],
  [151, '639735519',  'TRANSQUALITY 19'],
  [153, '616594070',  'TRANSQUALITY 46'],
  [154, '653273556',  'TRANSQUALITY 47'],
  [167, '687537854',  'TRANSQUALITY 20'],
  [168, '636073367',  'TRANSQUALITY 48'],
  [170, '635469938',  'TRANSQUALITY 45'],
  [183, '667895759',  'TRANSQUALITY 49'],
  [188, '664629715',  'TRANSQUALITY 7'],
  [189, '600354014',  'TRANSQUALITY 6'],

  // ── OTROS CONDUCTORES / EMPRESAS ───────────────────────────────────────────
  [101, '2513',       'Ramon Vigo'],
  [103, '609020453',  'Chico Salobreña'],
  [106, '661728850',  'Jose Manuel Montoro Empresa'],
  [107, '686952853',  'Emilio Serflota'],
  [112, '627258209',  'Alex Cond Granada'],
  [119, '4068',       'Antonio Garrido'],
  [135, '639354709',  'Rafa Adblue'],
  [140, '657967365',  'Miguel Torrenueba Bus'],
  [144, '648646829',  'Javi Yerno De Antonio Scani'],
  [150, '662384789',  'Julio Victor Moraleda Transquality'],
  [156, '630356907',  'Youseff Transquality'],
  [159, '640227756',  'Isaac Impegra'],
  [160, '691654997',  'Quique Alvaro Isaac Impegra'],
  [163, '671755519',  'Raul Mecanico'],
  [165, '674310999',  'JORDY ELECTRO'],
  [166, '5025',       'Christian Chapista'],
  [171, '699069881',  'Paco Cartrayser'],
  [178, '663388525',  'Ramon Vigo'],
  [181, '652936779',  'Javi Guidet'],
  [184, '603168521',  'Deltabus Nico'],
  [197, '606703832',  'Silvia Serflota'],
  [199, '661728922',  'TOMAS ROMERO ESTEBAN (MIBUS)'],
  [200, '617470548',  'Jose Albertic Chofer'],
];

const getStmt = db.prepare('SELECT telefono_activo FROM casilleros WHERE id_casillero = ?');
const updStmt = db.prepare(`
  UPDATE casilleros
  SET nombre_titular = ?,
      fecha_ultima_modificacion = datetime('now')
  WHERE id_casillero = ?
`);
const logStmt = db.prepare(`
  INSERT INTO log_actividad (tipo, descripcion, id_casillero)
  VALUES ('IMPORTACION_NOMBRE', ?, ?)
`);

let actualizados = 0;
let omitidos = 0;

db.exec('BEGIN');
try {
  for (const [id, telEsperado, nombre] of datos) {
    const row = getStmt.get(id);
    if (!row) { omitidos++; continue; }

    if (row.telefono_activo !== telEsperado) {
      console.log(`  OMITIDO  #${String(id).padStart(3,'0')}: BD="${row.telefono_activo}" ≠ esperado="${telEsperado}"`);
      omitidos++;
      continue;
    }

    updStmt.run(nombre, id);
    logStmt.run(`Nombre asignado: "${nombre}"`, id);
    console.log(`  ✓ #${String(id).padStart(3,'0')}: ${nombre}`);
    actualizados++;
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Error:', e.message);
  process.exit(1);
}

console.log(`\nResumen: ${actualizados} actualizados, ${omitidos} omitidos (teléfono no coincide)`);
