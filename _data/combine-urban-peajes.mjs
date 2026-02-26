import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const URBAN_DIR = path.join(__dirname, 'peajes_urbanos_json');
const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'all-tolls.json');

process.loadEnvFile(path.join(__dirname, '../.env'));
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function main() {
  const allTolls = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const tollsToMatch = allTolls.map(t => ({ id: t.id, nombre: t.nombre, autopista: t.autopista }));

  const files = fs.readdirSync(URBAN_DIR).filter(f => f.endsWith('.json'));

  console.log(`Iniciando cruce inteligente con DeepSeek para ${files.length} Autopistas Urbanas...`);
  const tollsRef = JSON.stringify(tollsToMatch);

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    console.log(`\n[${i + 1}/${files.length}] Cruzando datos de: ${filename}...`);

    try {
      const urbanJsonRaw = fs.readFileSync(path.join(URBAN_DIR, filename), 'utf-8');

      const prompt = `Aquí tienes un JSON detallado con las tarifas de una autopista urbana compleja obtenidas de un documento legal.
También te presento nuestra BASE DE DATOS de pórticos (como referencia de IDs).

JSON TARIFAS URBANAS (estructurado por pórticos, horarios, y tipos de vehículos):
${urbanJsonRaw.substring(0, 20000)}

BASE DE DATOS DE PÓRTICOS:
${tollsRef}

REGLAS ESTRICTAS PARA EL CRUCE:
1. Debes emparejar cada pórtico del "JSON TARIFAS URBANAS" con su ID correspondiente en la "BASE DE DATOS DE PÓRTICOS" utilizando su nombre, código, u otra coincidencia (por ejemplo, "PA2" o "Guanaco" o "Costanera Norte").
2. Genera un NUEVO objeto JSON donde las CLAVES sean EXCLUSIVAMENTE los IDs de la base de datos (ej: "node/13881069").
3. Los VALORES de cada clave deben ser el OBJETO de tarifas en CLP (numérico o decimal) completo correspondiente a "Autos y Camionetas" o equivalentes. Genera el diccionario incluyendo "TBFP", "TBP", "TS" u otros horarios según tenga cada carretera.
   Ejemplo de valor: { "TBFP": 585, "TBP": 669, "TS": 1003 } o { "Tarifa Base": 1500, "Tarifa Punta": 2200 } o similar extraído.
4. IGNORA pórticos para los que no tengas coincidencia clara.
5. El resultado debe ser EXCLUSIVAMENTE formato JSON parseable válido. Ni una sola letra de markdown, sin el tag \`\`\`json. ¡Ojo! Solo debes retornar las llaves { } con las claves y valores estipulados.`;

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "Eres una IA experta en mapear bases de datos disjuntas mediante fuzzy matching estricto y retornar un diccionario JSON plano estricto final (id -> tarifas). No uses texto adicional." },
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

      if (content.startsWith('```json')) content = content.substring(7);
      if (content.startsWith('```')) content = content.substring(3);
      if (content.endsWith('```')) content = content.substring(0, content.length - 3);
      content = content.trim();

      let matchedData;
      try {
        matchedData = JSON.parse(content);
      } catch (e) {
        console.log("  -> Fallo al parsear JSON devuelto por IA. Contenido (inicio):", content.substring(0, 100));
        continue;
      }

      let count = 0;
      // Inyectar la data enriquecida a los nodos globales
      for (const [id, objetoTarifas] of Object.entries(matchedData)) {
        if (typeof objetoTarifas === 'object' && objetoTarifas !== null) {
          const index = allTolls.findIndex(t => t.id === id);
          if (index !== -1) {
            allTolls[index].tarifas_urbanas = objetoTarifas;
            count++;
          }
        }
      }

      console.log(`  -> ¡DeepSeek emparejó exitosamente las tarifas para ${count} pórticos urbanos!`);

      // Guardar de inmediato
      fs.writeFileSync(DATA_PATH, JSON.stringify(allTolls, null, 2));

    } catch (err) {
      console.error(`  -> Error general procesando ${filename}: ${err.message}`);
    }
  }

  console.log('\n==========================================');
  console.log(`¡Todos los pórticos urbanos han sido actualizados y combinados directo en src/data/all-tolls.json con sus valores de hora punta/valle!`);
}

main();
