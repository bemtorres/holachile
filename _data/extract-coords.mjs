import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'src/data/all-tolls.json');
const OUTPUT_FILE = path.join(process.cwd(), '_data/porticos-coords.json');

const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

const unique = data.map(p => ({
  id: p.id,
  nombre: p.nombre,
  lat: p.lat,
  lng: p.lng,
  autopista: p.autopista
}));

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(unique, null, 2));

console.log(`✅ Extraídos ${unique.length} pórticos a ${OUTPUT_FILE}`);
