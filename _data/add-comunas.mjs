import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'src/data/all-tolls.json');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/all-tolls.json');
const COMUNAS_FILE = path.join(process.cwd(), '_data/comunas.json');

const comunas = JSON.parse(fs.readFileSync(COMUNAS_FILE, 'utf-8'));

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestComuna(lat, lng) {
  let minDist = Infinity;
  let nearest = null;
  
  for (const c of comunas) {
    const cLat = parseFloat(c.lat);
    const cLng = parseFloat(c.lng);
    const dist = getDistanceFromLatLonInKm(lat, lng, cLat, cLng);
    if (dist < minDist) {
      minDist = dist;
      nearest = c.name;
    }
  }
  
  return { comuna: nearest, distancia: minDist };
}

console.log('🔍 Iniciando匹配 de comunas...\n');

const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

console.log(`Total de pórticos: ${data.length}`);
console.log(`Total de comunas: ${comunas.length}\n`);

let matched = 0;

for (const entry of data) {
  if (entry.comuna && entry.comuna.length > 0) {
    continue;
  }
  
  const result = findNearestComuna(entry.lat, entry.lng);
  entry.comuna = result.comuna;
  
  if (result.distancia < 50) {
    matched++;
    console.log(`  ✓ ${entry.nombre.substring(0, 40)} → ${result.comuna} (${result.distancia.toFixed(1)} km)`);
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));

console.log('\n✅ Completado!');
console.log(`   - Pórticos actualizados: ${matched}`);
