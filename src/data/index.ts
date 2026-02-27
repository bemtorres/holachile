import allTolls from './all-tolls.json';

export type Portico = {
  id: string;
  nombre: string;
  tramo: string;
  lat: number;
  lng: number;
  km: number;
  tipo: string;
  sentido?: string;
  salida?: string;
  comuna?: string;
  tags: Record<string, string>;
  autopista: string;
  color: string;
  precio?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tarifas_urbanas?: any;
};

export type Autopista = {
  autopista: string;
  descripcion: string;
  color: string;
  totalPorticos: number;
  concesionario: string;
  osm_query: string;
  porticos: Portico[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const allPorticos = (allTolls as any) as Portico[];

const autopistaMap = new Map<string, Autopista>();

allPorticos.forEach(p => {
  if (!autopistaMap.has(p.autopista)) {
    autopistaMap.set(p.autopista, {
      autopista: p.autopista,
      descripcion: p.autopista === 'Peajes de Chile' ? 'Peajes manuales y convencionales' : 'Autopista urbana',
      color: p.color,
      totalPorticos: 0,
      concesionario: 'Varios',
      osm_query: p.tipo === 'toll_booth' ? 'node["barrier"="toll_booth"]' : 'node["highway"="toll_gantry"]',
      porticos: []
    });
  }
  const a = autopistaMap.get(p.autopista)!;
  a.porticos.push(p);
  a.totalPorticos++;
});

export const autopistas: Autopista[] = Array.from(autopistaMap.values()).sort((a, b) => b.totalPorticos - a.totalPorticos);

// --- Comunas Data ---
import comunasDataRaw from './comunas-metropolitanas.json';

export interface Comuna {
  comuna: string;
  cut: string;
  lat: number;
  lng: number;
  poblacion: number;
  direccion_municipal: string;
  url_municipal: string;
  wiki_url: string;
  logo_url: string;
  provincia: string;
  mayores?: {
    actual?: {
      name?: string;
      email?: string;
      img?: string;
      instagram?: string;
      web?: string;
      twitter?: string;
    }
  };
}

const LOCAL_COMUNA_MAP: Record<string, Comuna> = {};
for (const [provincia, comunas] of Object.entries(comunasDataRaw as Record<string, any[]>)) {
  for (const c of comunas) {
    LOCAL_COMUNA_MAP[c.comuna.toLowerCase()] = { ...c, provincia } as Comuna;
  }
}

export const allComunas = Object.values(LOCAL_COMUNA_MAP).sort((a, b) => a.comuna.localeCompare(b.comuna));

export function findComuna(nombre: string): Comuna | undefined {
  if (!nombre) return undefined;
  return LOCAL_COMUNA_MAP[nombre.toLowerCase()];
}

export default autopistas;
