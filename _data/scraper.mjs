import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_DIR = path.join(__dirname, 'documentos_peajes');

const SOURCE_URL = 'https://concesiones.mop.gob.cl/peajes-y-porticos/';

async function main() {
  console.log(`Iniciando el Scraping desde: ${SOURCE_URL}`);

  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    console.log(`Carpeta creada: ${DEST_DIR}`);
  }

  try {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`Error al obtener HTML: ${response.statusText}`);

    const html = await response.text();

    // Extraer todos los links que contengan .pdf en su href
    const pdfRegex = /href="([^"]+\.pdf)"/gi;
    let match;
    const pdfUrls = new Set();

    while ((match = pdfRegex.exec(html)) !== null) {
      let decodedUrl = match[1];

      // Asegurarse de que el URL sea absoluto
      try {
        decodedUrl = new URL(decodedUrl, SOURCE_URL).toString();
        pdfUrls.add(decodedUrl);
      } catch (e) {
        console.log(`URL inválida ignorada: ${decodedUrl}`);
      }
    }

    const uniqueUrls = Array.from(pdfUrls);
    console.log(`Se encontraron ${uniqueUrls.length} archivos PDF únicos.`);
    console.log('--------------------------------------------------');

    // Descargar cada PDF secuencialmente para no sobrecargar de peticiones
    for (let i = 0; i < uniqueUrls.length; i++) {
      const fileUrl = uniqueUrls[i];
      const filename = decodeURIComponent(fileUrl.split('/').pop());
      const filePath = path.join(DEST_DIR, filename);

      console.log(`[${i + 1}/${uniqueUrls.length}] Descargando ${filename}...`);

      try {
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) throw new Error(`Status ${fileRes.status}`);

        const arrayBuffer = await fileRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        fs.writeFileSync(filePath, buffer);
        console.log(`  ✓ Guardado exitosamente.`);
      } catch (downloadErr) {
        console.error(`  ✗ ERROR descargando ${filename}: ${downloadErr.message}`);
      }
    }

    console.log('\n==================================================');
    console.log(`¡Scraping completado! Los PDFs se han guardado en la carpeta:\n-> ${DEST_DIR}`);
  } catch (error) {
    console.error('Ocurrió un error fatal durante el scraping:', error);
  }
}

main();
