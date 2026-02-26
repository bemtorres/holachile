import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_DIR = path.join(__dirname, 'documentos_peajes');
const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'all-tolls.json');

process.loadEnvFile(path.join(__dirname, '../.env'));
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function main() {
  const allTolls = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const tollsToMatch = allTolls.map(t => ({ id: t.id, nombre: t.nombre, km: t.km }));

  const files = fs.readdirSync(DEST_DIR).filter(f => f.endsWith('.pdf'));

  console.log(`Iniciando extracción con DeepSeek para ${files.length} PDFs...`);
  console.log(`Base de datos actual: ${allTolls.length} pórticos listos para ser mapeados.`);
  const tollsRef = JSON.stringify(tollsToMatch);

  // Procesaremos el script secuencialmente
  // Para demostrar el script en la conversación actual sin demorar mucho, limitaremos a 3 archivos.
  // El usuario puede cambiar este límite editando el archivo.
  // const filesToProcess = files.slice(0, 3);
  const filesToProcess = files; // Procesar todos

  for (let i = 0; i < filesToProcess.length; i++) {
    const filename = filesToProcess[i];
    console.log(`\n[${i + 1}/${filesToProcess.length}] Analizando documento: ${filename}...`);

    try {
      const dataBuffer = fs.readFileSync(path.join(DEST_DIR, filename));
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text;

      const prompt = `Extrae las tarifas de peaje para "autos y camionetas" o equivalentes (Tarifa Base o TB) de la siguiente tabla PDF.
Luego, mapea cada tarifa encontrada a uno de los IDs de pórticos de nuestra base de datos.
El archivo procesado es: ${filename}. Intenta hacer "fuzzy matching" con los nombres.

BASE DE DATOS DE PÓRTICOS (IDs y Nombres):
${tollsRef}

TEXTO DEL PDF (primeros 15.000 caracteres):
${text.substring(0, 15000)}

REGLAS ESTRICTAS:
1. Devuelve SOLO un objeto JSON donde la clave sea el "id" de la DB (ej: "node/13881069"), y el valor sea numérico en entero en CLP (ej: 1350).
2. IGNORA pórticos que no estén claramente mencionados en el texto.
3. El resultado debe ser EXCLUSIVAMENTE formato JSON sin markdown (\`\`\`json). SOLO texto de las llaves.
Ejemplo de salida que espero:
{"node/123": 550, "node/998": 1100}`;

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "Eres una IA que convierte documentos con tablas de precios en JSON crudos de diccionarios (clave -> valor). No envíes ni una sola palabra de texto que no sea código JSON parseable." },
            { role: "user", content: prompt }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        console.error('  -> Error de DeepSeek API:', response.status, await response.text());
        continue;
      }

      const resJson = await response.json();
      let content = resJson.choices[0].message.content.trim();

      // Sanitizar JSON potencial
      if (content.startsWith('```json')) content = content.substring(7);
      if (content.startsWith('```')) content = content.substring(3);
      if (content.endsWith('```')) content = content.substring(0, content.length - 3);
      content = content.trim();

      let extractedPrices;
      try {
        extractedPrices = JSON.parse(content);
      } catch (e) {
        console.log("  -> Fallo al parsear JSON devuelto por IA. Contenido (inicio):", content.substring(0, 50));
        continue;
      }

      let matchedCount = 0;
      for (const [id, precio] of Object.entries(extractedPrices)) {
        if (typeof precio === 'number') {
          const toll = allTolls.find(t => t.id === id);
          if (toll) {
            toll.precio = precio;
            matchedCount++;
          }
        }
      }

      console.log(`  -> ¡DeepSeek extrajo y asoció tarifas para ${matchedCount} pórticos en este PDF!`);

      // Guardar parcial en caso de que tarde o se interrumpa
      fs.writeFileSync(DATA_PATH, JSON.stringify(allTolls, null, 2));

    } catch (err) {
      console.error(`  -> Error general procesando ${filename}: ${err.message}`);
    }
  }

  console.log('\n==========================================');
  console.log(`¡Los documentos seleccionados han sido analizados y los precios se han guardado en source!`);
  console.log(`(Para procesar los 37 PDFs en vez de solo 3, edita el script y elimina el 'slice(0, 3)')`);
}

main();
