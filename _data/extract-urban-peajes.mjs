import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_DIR = path.join(__dirname, 'documentos_peajes');
const DEST_DIR = path.join(__dirname, 'peajes_urbanos_json');

process.loadEnvFile(path.join(__dirname, '../.env'));
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Los archivos específicos solicitados por el usuario
const targetFiles = [
  'AUTOPISTA-CENTRAL.pdf',
  'AVO-I.pdf',
  'COSTANERA-NORTE.pdf',
  'TUNEL-SAN-CRISTOBAL.pdf',
  'VESPUCIO-NORTE.pdf',
  'VESPUCIO-SUR.pdf'
];

async function main() {
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    console.log(`Carpeta de destino creada: ${DEST_DIR}`);
  }

  console.log(`Iniciando extracción con DeepSeek para ${targetFiles.length} Autopistas Urbanas...`);

  for (let i = 0; i < targetFiles.length; i++) {
    const filename = targetFiles[i];
    console.log(`\n[${i + 1}/${targetFiles.length}] Analizando documento: ${filename}...`);

    try {
      const filePath = path.join(SOURCE_DIR, filename);
      if (!fs.existsSync(filePath)) {
        console.log(`  -> Advertencia: El archivo ${filename} no existe en ${SOURCE_DIR}`);
        continue;
      }

      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text;

      const prompt = `Analiza detalladamente este texto que proviene de un PDF de tarifas de pórticos de peaje urbano en Chile. 
La estructura tarifaria de las autopistas urbanas es MUY compleja, involucrando pórticos/tramos, distintas categorías de vehículos, horarios (Tarifa Base, Tarifa Punta, Tarifa Saturación), sentidos (norte a sur, poniente a oriente, etc.), kilometrajes y más.

Extrae TODO y genera una estructura de datos (JSON) jerárquica, clara y bien pensada que represente la información específica de esta concesión de manera realista. No omitas ningún pórtico ni ninguna categoría, usa arreglos dentro del JSON para tabular cada pórtico. Adapta los nombres de las claves de tu JSON al esquema particular de este PDF, creando objetos anidados según convenga.

TEXTO DEL PDF (primeros 25.000 caracteres):
${text.substring(0, 25000)}

REGLAS ESTRICTAS:
1. Devuelve SOLO un objeto JSON. Empezando por llave y terminando en llave.
2. Si el texto habla de "Tarifa Base (TB)", "Tarifa Punta (TBP)", "Tarifa Saturación (TS)", organízalos numéricamente (ej, si está en pesos). Céntrate en capturar la mayor cantidad de datos que puedas extraer para "Autos y Camionetas", "Motos", "Camiones y Buses", etc.
3. El resultado debe ser EXCLUSIVAMENTE formato JSON parseable, sin markdown, sin texto adicional u explicativo.`;

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "Eres un ingeniero experto en transformar información financiera compleja de documentos legales no estructurados hacia JSON puros, limpios y estrictamente anidados." },
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

      // Validar si el JSON es correcto
      try {
        JSON.parse(content);
      } catch (e) {
        console.log("  -> Fallo al parsear JSON devuelto por IA. Contenido (inicio):", content.substring(0, 100));
        fs.writeFileSync(path.join(DEST_DIR, `${filename.replace('.pdf', '')}_error.txt`), content);
        continue;
      }

      const destFilename = filename.replace('.pdf', '.json');
      fs.writeFileSync(path.join(DEST_DIR, destFilename), content);

      console.log(`  -> ¡DeepSeek extrajo dinámicamente este esquema y lo guardó en ${destFilename}!`);

    } catch (err) {
      console.error(`  -> Error general procesando ${filename}: ${err.message}`);
    }
  }

  console.log('\n==========================================');
  console.log(`¡PDFs de Autopistas Urbanas analizados y almacenados en la carpeta '${DEST_DIR}'!`);
}

main();
