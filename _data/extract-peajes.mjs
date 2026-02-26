import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_DIR = path.join(__dirname, 'documentos_peajes', 'PEAJES');
const DEST_DIR = path.join(__dirname, 'peajes_json');

process.loadEnvFile(path.join(__dirname, '../.env'));
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function main() {
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    console.log(`Carpeta de destino creada: ${DEST_DIR}`);
  }

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Carpeta fuente no encontrada: ${SOURCE_DIR}`);
    return;
  }

  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`Iniciando extracción con DeepSeek para ${files.length} PDFs...`);

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    console.log(`\n[${i + 1}/${files.length}] Analizando documento: ${filename}...`);

    try {
      const dataBuffer = fs.readFileSync(path.join(SOURCE_DIR, filename));
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text;

      const prompt = `Extrae TOOOODA la información estructurada de tarifas, plazas de peaje, tipos de vehículos, rebajas, precios en horarios (punta/valle) u otra información tarifaria y metadata disponible en este texto convertido de un PDF de peajes de Chile.
Genera una estructura de datos (JSON) jerárquica, clara y bien pensada que represente la información específica de este tramo.
Adapta la estructura según la información disponible en el texto (cada concesión puede tener estructuras distintas).

TEXTO DEL PDF (primeros 15.000 caracteres):
${text.substring(0, 15000)}

REGLAS ESTRICTAS:
1. Devuelve SOLO un objeto JSON.
2. Extrae todas las plazas de peaje y sus precios según tipo de vehículo, si es posible.
3. El resultado debe ser EXCLUSIVAMENTE formato JSON sin markdown, sin \`\`\`json, sin texto adicional introductorio o conclusivo. SOLO las llaves.`;

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "Eres una IA experta en analizar PDFs convertidos a texto plano y extraer la información tabulada de peajes hacia un JSON estructurado completo." },
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
        console.log("  -> Fallo al parsear JSON devuelto por IA. Contenido (inicio):", content.substring(0, 50));
        // Lo guardaremos de todos modos con extensión para examinarlo si falló
        fs.writeFileSync(path.join(DEST_DIR, `${filename.replace('.pdf', '')}_error.txt`), content);
        continue;
      }

      const destFilename = filename.replace('.pdf', '.json');
      fs.writeFileSync(path.join(DEST_DIR, destFilename), content);

      console.log(`  -> ¡DeepSeek extrajo y guardó exitosamente ${destFilename}!`);

    } catch (err) {
      console.error(`  -> Error general procesando ${filename}: ${err.message}`);
    }
  }

  console.log('\n==========================================');
  console.log(`¡Todos los documentos han sido analizados y los JSON se encuentran en la carpeta de destino!`);
}

main();
