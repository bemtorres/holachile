const fs = require('fs');
const https = require('https');

async function main() {
  console.log('Reading export.geojson for TAGs...');
  const geojsonRaw = fs.readFileSync('./src/data/export.geojson', 'utf-8');
  const geojson = JSON.parse(geojsonRaw);

  const tags = geojson.features.map(f => {
    return {
      id: f.properties['@id'] || f.id || Math.random().toString(),
      nombre: f.properties.name || f.properties.ref || 'Pórtico Desconocido',
      tramo: 'N/A',
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      km: 0,
      tipo: 'toll_gantry',
      sentido: '',
      tags: f.properties
    };
  });

  console.log(`Loaded ${tags.length} TAGs from export.geojson.`);

  console.log('Fetching toll booths (Peajes) from Overpass API...');
  const query = `
      [out:json][timeout:25];
      node["barrier"="toll_booth"](-56.0,-75.0,-17.0,-66.0);
      out body;
    `;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

  const booths = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Overpass returned status ${res.statusCode}: ${data}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.elements || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  console.log(`Fetched ${booths.length} toll booths from OSM.`);

  const peajes = booths.map(b => {
    return {
      id: `node/${b.id}`,
      nombre: b.tags?.name || 'Peaje',
      tramo: 'N/A',
      lat: b.lat,
      lng: b.lon,
      km: 0,
      tipo: 'toll_booth',
      sentido: '',
      tags: b.tags || {}
    };
  });

  // Assign them to autopistas or groups.
  // We can just keep a main file 'all-tolls.json' that the UI can use.
  const allTolls = [...tags, ...peajes];

  // Assign "autopistas" based on name or tags
  const processed = allTolls.map(t => {
    let autopista = 'Otros Peajes/TAG';
    let color = '#94a3b8'; // default gray-ish
    const nameUpper = t.nombre.toUpperCase();

    if (nameUpper.includes('COSTANERA') || nameUpper.includes('KENNEDY') || (t.tags.ref && t.tags.ref.startsWith('PC'))) {
      autopista = 'Costanera Norte';
      color = '#3182CE';
    } else if (nameUpper.includes('VESPUCIO') || (t.tags.ref && t.tags.ref.startsWith('PA'))) {
      if (nameUpper.includes('ORIENTE') || nameUpper.includes('AVO')) {
        autopista = 'AVO I';
        color = '#D69E2E';
      } else {
        autopista = 'Vespucio Norte/Sur';
        color = '#805AD5';
      }
    } else if (nameUpper.includes('CENTRAL') || nameUpper.includes('VELASQUEZ') || nameUpper.includes('RUTA 5') || (t.tags.ref && t.tags.ref.startsWith('P') && !t.tags.ref.includes('C'))) {
      autopista = 'Autopista Central';
      color = '#E53E3E';
    }

    if (t.tipo === 'toll_booth') {
      autopista = 'Peajes de Chile';
      color = '#38A169'; // Green output
    }

    return {
      ...t,
      autopista,
      color
    };
  });

  fs.writeFileSync('./src/data/all-tolls.json', JSON.stringify(processed, null, 2));
  console.log('Saved src/data/all-tolls.json');
}

main().catch(console.error);
