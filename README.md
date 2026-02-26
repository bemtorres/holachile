# TAG Chile - Plataforma de Telemetría y Gestión de Peajes

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

Plataforma de visualización, cálculo de rutas y simulación de tráfico para la red de pórticos de peaje (TAG) y autopistas urbanas de Chile.

## Características

- **Mapa Cartográfico Interactivo**: Visualización de todos los pórticos a lo largo del territorio chileno utilizando mapas en modo oscuro de alto contraste (Leaflet + CartoDB).
- **Inspección Tarifaria Detallada**: Consulta en tiempo real de la tarifa dinámica para cada pórtico. El sistema diferencia entre peaje de carretera base y estructura tarifaria compleja (Valle, Punta y Saturación) de grandes autopistas urbanas (Costanera Norte, Vespucio Sur, AVO, etc.).
- **Calculadora de Ruta e Ingresos**: Traza trayectorias seleccionando pórticos de inicio y destino, estima el consumo de combustible de tu vehículo en función de la distancia y detecta cuántos pórticos serán interceptados en tu camino.
- **Simulación Operativa de Tráfico**: Herramienta profesional de estimación para modelar escenarios de tráfico. Permite inyectar flotas vehiculares masivas, definir la penetración de mercado para autos vs. camiones vs. remolques, establecer perfiles de horario y calcular recaudaciones estimadas.

## Autopistas Incluidas

### Autopistas Urbanas
| Autopista | Provincia/Región | Pórticos |
|-----------|-----------------|----------|
| Vespucio Norte | Santiago | 12 |
| Vespucio Sur | Santiago | 18 |
| Costanera Norte | Santiago | 10 |
| Autopista Central | Santiago | 15 |
| AVO (Alto Velocidad Oriente) | Santiago | 8 |
| Túnel San Cristóbal | Santiago | 4 |

### Carreteras Interurbanas
| Ruta | Tramo | Región |
|------|-------|--------|
| Ruta 68 | Santiago - Valparaíso | Valparaíso |
| Ruta 78 | Santiago - San Antonio | Valparaíso |
| Ruta 43 | La Serena - Coquimbo | Coquimbo |
| Ruta 60 CH | Paso Internacional Los Libertadores | Valparaíso |
| Ruta 160 | Concepción - Lota | Biobío |
| Los Libertadores | Santiago - Argentina | Valparaíso |
| Autopista del Itata | Chillán - Concepción | Biobío |
| Acceso Nororiente | Santiago | Metropolitana |
| Acceso Vial | Antofagasta | Antofagasta |

> Total: **+60 pórticos** distribuidos en más de 30 concesiones vial.

## Estructura del Proyecto

```
tag/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── page.tsx         # Página principal
│   │   ├── layout.tsx       # Layout raíz
│   │   └── globals.css      # Estilos globales
│   ├── components/          # Componentes React
│   │   ├── MapView.tsx      # Visualización del mapa
│   │   ├── Sidebar.tsx      # Panel lateral de filtros
│   │   ├── PorticoList.tsx  # Lista de pórticos
│   │   └── SimulationTab.tsx # Herramienta de simulación
│   └── data/
│       ├── index.ts         # Datos y tipos TypeScript
│       ├── all-tolls.json   # Base de datos de peajes
│       └── *.json           # Datos por autopista
├── _data/
│   ├── extract-*.mjs        # Scripts de extracción
│   ├── scraper.mjs          # Scraper de tarifas
│   └── peajes_json/         # JSONs raw de peajes
├── public/                  # Assets estáticos
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

## Requisitos

- **Node.js** 18+ 
- **npm** o **bun**

## Instalación

1. Clona el repositorio:
```bash
git clone <repository-url>
cd tag
```

2. Instala las dependencias:
```bash
npm install
# o con bun
bun install
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

4. Accede a `http://localhost:3000`

## Variables de Entorno

Para re-escapear información de tarifas, crea un archivo `.env.local`:

```env
# Scraper opcional - los datos ya están incluidos
SCRAPER_URL=...
SCRAPER_API_KEY=...
```

## Tecnologías

- **Frontend**: Next.js 16, React 19, TypeScript
- **Estilos**: Tailwind CSS v4
- **Mapas**: React-Leaflet, Leaflet, Turf.js
- **Iconografía**: Lucide React

## Actualización de Datos

Los datos de tarifas se extraen desde documentos PDF oficiales de las concesiones. Para actualizar:

1. Descarga los nuevos cuadros tarifarios desde los sitios de las concesiones
2. Coloca los PDFs en `_data/documentos_peajes/`
3. Ejecuta los scripts de extracción:
```bash
node _data/extract-prices.mjs
node _data/extract-urban-peajes.mjs
```

Los datos se generarán en `_data/peajes_json/` y `_data/peajes_urbanos_json/`

## Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo |
| `npm run build` | Compila la aplicación |
| `npm run start` | Inicia en producción |
| `npm run lint` | Ejecuta linter |

## Capturas de Pantalla

### Vista Principal
Mapa interactivo con todos los pórticos de peaje de Chile. Visualización en modo oscuro con markers codificados por color según la concesión.

### Calculadora de Rutas
Permite seleccionar origen y destino en el mapa, elegir tipo de vehículo (gasolina, diésel, híbrido, eléctrico) y calcular:
- Distancia total
- Costo estimado de combustible
- Número de pórticos intersecados

### Detalle de Pórtico
Al hacer clic en cualquier pórtico se muestra:
- Coordenadas exactas (lat/lng)
- Kilómetro del tramo
- Sentido de circulación
- Tarifas por categoría vehicular
- Horarios (Valle, Punta, Saturación)

### Simulación de Tráfico
Herramienta profesional para modelar escenarios con:
- Volumen de flota vehicular
- Distribución por tipo (auto/camión/remolque)
- Penetración de mercado
- Estimación de recaudación

## Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

---

Desarrollado con Next.js y Leaflet. Datos de tarifas extraídos desde fuentes oficiales de las concesiones viales chilenas.
