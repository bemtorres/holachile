# Extraction Scripts (`_extract_data_node`)

## ¿Por qué se construyó este sistema?
La estructura tarifaria de los pórticos de peaje y autopistas urbanas en Chile se publica usualmente en documentos PDF estáticos, de gran tamaño y sin estructuración legible por máquina. Cada PDF de concesión (Costanera Norte, Vespucio Sur, Rutafácil, etc.) usa un esquema de tablas visuales complejas, jerarquías anidadas según clasificación vehicular (Categoría 1, Categoría 2 y 3) y horarios dinámicos definidos como "Punta" (TBP), "Valle" (TBFP) o "Saturación" (TS).

Para poblar la plataforma de simulación en tiempo real `TAG Chile`, se desarrolló esta suite de scripts **independientes del front-end** que actúa como motor automatizado de extracción de datos.

## ¿Qué hace exactamente?

Esta carpeta aloja utilidades en **Node.js**:
1. Leen masivamente directorios de documentos `.pdf` de las concesionarias empleando paquetes como `pdf-parse`.
2. Hacen puente con motores de LLM (como la API de **DeepSeek**) mandando el volcado bruto del texto por cada autopista.
3. Le solicitan a la Inteligencia Artificial que entienda esa complejidad normativa/tarifaria específica, y la esquematice 100% en archivos JSON limpios con categorías normalizadas.
4. Generan matrices de precios que luego nuestro sistema fron-end de NextJS (ubicado en `src/data/all-tolls.json`) consume instantáneamente.

## Scripts Claves

- `extract-peajes.mjs` y `extract-urban-peajes.mjs`: Scripts que toman lotes de PDFs, los transcriben, preparan los *prompts* correctos y conectan a la IA para almacenar su retorno en memoria antes de guardarlo.
- `extract-prices.mjs` y `combine-urban-peajes.mjs`: Entrecruzan las bases de pórticos crudos (solo coordenadas geográficas) con las matrices JSON de peajes y horas extraídas por la IA, uniendo la información de Telemetría (GPS) con Finanzas.

## Cómo Utilizar

Cada script puede reejecutarse si las concesionarias en Chile lanzan una nueva actualización anual.

```bash
# Variables de entorno primero: Configura tu `.env` (guíate por `.env.example`).
node extract-urban-peajes.mjs
node combine-urban-peajes.mjs
```
