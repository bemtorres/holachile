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

export default autopistas;
