'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Portico } from '@/data';

type MapProps = {
  porticos: Portico[];
  selectedAutopista?: string | null;
  onPorticoClick?: (portico: Portico) => void;
  onMapClick?: (lat: number, lng: number) => void;
  routeGeometry?: GeoJSON.LineString | null;
  origin?: [number, number] | null;
  destination?: [number, number] | null;
  showComunas?: boolean;
  onComunaClick?: (nombre: string) => void;
  // Simulation props
  simActive?: boolean;
  simPaused?: boolean;
  flowPerHour?: number;
  pctCat1?: number;
  pctCat2?: number;
  routePorticos?: Portico[];
  timeProfile?: 'valle' | 'punta' | 'saturacion';
  onSimTick?: (vehicles: number, revenue: number, elapsed: number) => void;
  onSimComplete?: () => void;
};

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── Vehicle helpers ─────────────────────────────────────────────────────────

const CAR_COLORS = ['#60a5fa', '#34d399', '#f472b6', '#facc15', '#a78bfa', '#fb923c'];
const TRUCK_COLORS = ['#94a3b8', '#cbd5e1', '#f1f5f9'];

function randomBetween(a: number, b: number) { return a + Math.random() * (b - a); }

type VehicleType = 'car' | 'truck' | 'heavy';
interface SimVehicle {
  id: number;
  color: string;
  type: VehicleType;
  /** 0–1 progress along route */
  t: number;
  speed: number; // dt per frame
  revenue: number;
  firedPorticos: Set<number>; // indices of portals fired
  el: HTMLDivElement;
  marker: L.Marker;
}

interface MoneyBurst {
  el: HTMLDivElement;
  created: number;
}

function makeSVGIcon(type: VehicleType, color: string): string {
  if (type === 'car') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="18" viewBox="0 0 28 18">
      <ellipse cx="14" cy="16" rx="12" ry="2.5" fill="black" opacity="0.3"/>
      <rect x="2" y="7" width="24" height="9" fill="${color}" rx="3"/>
      <rect x="6" y="3" width="16" height="9" fill="${color}" rx="3"/>
      <rect x="8" y="4" width="12" height="6" fill="#1e3a5f" rx="2" opacity="0.85"/>
      <circle cx="7" cy="16" r="3" fill="#09090b"/><circle cx="7" cy="16" r="1.2" fill="#52525b"/>
      <circle cx="21" cy="16" r="3" fill="#09090b"/><circle cx="21" cy="16" r="1.2" fill="#52525b"/>
      <rect x="2" y="9" width="3" height="3" fill="#fef08a" rx="0.5" opacity="0.9"/>
      <rect x="23" y="9" width="3" height="3" fill="#ef4444" rx="0.5" opacity="0.7"/>
    </svg>`;
  }
  if (type === 'truck') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="18" viewBox="0 0 42 18">
      <ellipse cx="21" cy="16" rx="19" ry="2.5" fill="black" opacity="0.3"/>
      <rect x="2" y="5" width="26" height="11" fill="${color}" rx="2" opacity="0.85"/>
      <rect x="28" y="3" width="12" height="12" fill="#cbd5e1" rx="3"/>
      <rect x="30" y="4.5" width="8" height="7" fill="#1e3a5f" rx="1.5" opacity="0.8"/>
      <circle cx="8" cy="16" r="3.2" fill="#09090b"/><circle cx="8" cy="16" r="1.3" fill="#3f3f46"/>
      <circle cx="21" cy="16" r="3.2" fill="#09090b"/><circle cx="21" cy="16" r="1.3" fill="#3f3f46"/>
      <circle cx="34" cy="16" r="3.2" fill="#09090b"/><circle cx="34" cy="16" r="1.3" fill="#3f3f46"/>
      <rect x="38" y="7" width="2.5" height="3.5" fill="#fef08a" rx="0.5" opacity="0.85"/>
    </svg>`;
  }
  // heavy
  return `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="20" viewBox="0 0 54 20">
    <ellipse cx="27" cy="18" rx="25" ry="2.5" fill="black" opacity="0.3"/>
    <rect x="2" y="5" width="32" height="13" fill="${color}" rx="2" opacity="0.8"/>
    <rect x="4" y="11" width="28" height="3" fill="#7c3aed" opacity="0.4"/>
    <rect x="34" y="3" width="16" height="14" fill="#94a3b8" rx="3"/>
    <rect x="36" y="4.5" width="11" height="8" fill="#1e3a5f" rx="1.5" opacity="0.8"/>
    <circle cx="8" cy="18" r="3.5" fill="#09090b"/><circle cx="8" cy="18" r="1.5" fill="#3f3f46"/>
    <circle cx="20" cy="18" r="3.5" fill="#09090b"/><circle cx="20" cy="18" r="1.5" fill="#3f3f46"/>
    <circle cx="32" cy="18" r="3.5" fill="#09090b"/><circle cx="32" cy="18" r="1.5" fill="#3f3f46"/>
    <circle cx="44" cy="18" r="3.5" fill="#09090b"/><circle cx="44" cy="18" r="1.5" fill="#3f3f46"/>
    <rect x="48" y="7" width="3" height="4" fill="#fef08a" rx="0.5" opacity="0.85"/>
  </svg>`;
}

function makeLeafletIcon(type: VehicleType, color: string, bearing: number) {
  const svg = makeSVGIcon(type, color);
  const w = type === 'car' ? 28 : type === 'truck' ? 42 : 54;
  return L.divIcon({
    html: `<div style="transform:rotate(${bearing}deg);transform-origin:center center;line-height:0">${svg}</div>`,
    className: '',
    iconSize: [w, 20],
    iconAnchor: [w / 2, 10],
  });
}

// ─── Route interpolation helpers ──────────────────────────────────────────────

function coordsToPoints(coords: number[][]): [number, number][] {
  return coords.map(([lng, lat]) => [lat, lng]);
}

function routeSegments(pts: [number, number][]) {
  const segs: { from: [number, number]; to: [number, number]; dist: number; cumul: number }[] = [];
  let cumul = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = haversine(pts[i], pts[i + 1]);
    segs.push({ from: pts[i], to: pts[i + 1], dist: d, cumul });
    cumul += d;
  }
  return { segs, total: cumul };
}

function haversine([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolateRoute(
  segs: ReturnType<typeof routeSegments>['segs'],
  total: number,
  t: number
): { latlng: [number, number]; bearing: number } {
  const target = t * total;
  let acc = 0;
  for (const seg of segs) {
    if (acc + seg.dist >= target) {
      const frac = (target - acc) / seg.dist;
      const lat = seg.from[0] + (seg.to[0] - seg.from[0]) * frac;
      const lng = seg.from[1] + (seg.to[1] - seg.from[1]) * frac;
      const bearing = (Math.atan2(seg.to[1] - seg.from[1], seg.to[0] - seg.from[0]) * 180) / Math.PI;
      return { latlng: [lat, lng], bearing };
    }
    acc += seg.dist;
  }
  const last = segs[segs.length - 1];
  return { latlng: last.to, bearing: 0 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapView({
  porticos,
  selectedAutopista,
  onPorticoClick,
  onMapClick,
  routeGeometry,
  origin,
  destination,
  showComunas = false,
  onComunaClick,
  simActive = false,
  simPaused = false,
  flowPerHour = 1500,
  pctCat1 = 70,
  pctCat2 = 20,
  routePorticos = [],
  timeProfile = 'punta',
  onSimTick,
  onSimComplete,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const routeLayerRef = useRef<L.GeoJSON | null>(null);
  const originMarkerRef = useRef<L.CircleMarker | null>(null);
  const destMarkerRef = useRef<L.CircleMarker | null>(null);
  const comunaLayerRef = useRef<L.GeoJSON | null>(null);
  const comunaGeoJSONRef = useRef<any>(null); // cached GeoJSON
  const [isReady, setIsReady] = useState(false);
  const [comunaColors, setComunaColors] = useState<Record<string, string>>({});
  const [loadingComunas, setLoadingComunas] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [legendFilter, setLegendFilter] = useState('');

  // Simulation internals
  const rafRef = useRef<number | null>(null);
  const vehiclesRef = useRef<SimVehicle[]>([]);
  const moneyBurstsRef = useRef<MoneyBurst[]>([]);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const simStartRef = useRef(0);
  const pausedAtRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const accRevRef = useRef(0);
  const accVehRef = useRef(0);
  const vehicleIdRef = useRef(0);
  const isPausedRef = useRef(false);
  const simActiveRef = useRef(false);
  const routeSegsRef = useRef<ReturnType<typeof routeSegments> | null>(null);
  const routePorticosRef = useRef<Portico[]>([]);
  const porticoPositionsRef = useRef<{ t: number; revenue: number }[]>([]);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  const onSimTickRef = useRef(onSimTick);
  useEffect(() => { onSimTickRef.current = onSimTick; }, [onSimTick]);
  const onSimCompleteRef = useRef(onSimComplete);
  useEffect(() => { onSimCompleteRef.current = onSimComplete; }, [onSimComplete]);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const container = L.DomUtil.get(mapRef.current);
    if (container != null) (container as any)._leaflet_id = null;

    const map = L.map(mapRef.current, { center: [-33.45, -70.65], zoom: 11, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    map.on('click', (e: any) => { onMapClickRef.current?.(e.latlng.lat, e.latlng.lng); });

    vehicleLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    setIsReady(true);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // ── Portico markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const filtered = selectedAutopista ? porticos.filter((p) => p.autopista === selectedAutopista) : porticos;

    filtered.forEach((p) => {
      const marker = L.circleMarker([p.lat, p.lng], { radius: 8, fillColor: p.color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9 });

      let tarifasHtml = '';
      if (p.precio && !p.tarifas_urbanas) {
        tarifasHtml = `<div style="margin-top:10px;border-top:1px solid #27272a;padding-top:10px;font-size:12px;display:flex;justify-content:space-between;align-items:center;"><span style="color:#a1a1aa;font-weight:500;">Tarifa Estándar</span><span style="color:#10b981;font-weight:600;">$${p.precio.toLocaleString('es-CL')}</span></div>`;
      } else if (p.tarifas_urbanas) {
        tarifasHtml = `<div style="margin-top:10px;border-top:1px solid #27272a;padding-top:10px;font-size:12px;display:flex;flex-direction:column;gap:6px;">`;
        const objToUse = (p.tarifas_urbanas as any).categoria_1_4 || p.tarifas_urbanas;
        const tb = (objToUse as any).TBFP || (objToUse as any).tarifa_base_fuera_punta || (objToUse as any).Tarifa_Base || p.precio;
        const tp = (objToUse as any).TBP || (objToUse as any).tarifa_base_punta || (objToUse as any).Tarifa_Punta;
        const ts = (objToUse as any).TS || (objToUse as any).tarifa_saturacion || (objToUse as any).Tarifa_Saturacion;
        if (tb) tarifasHtml += `<div style="display:flex;justify-content:space-between;"><span style="color:#a1a1aa">Tarifa Base:</span><span style="color:#f4f4f5;font-weight:600">$${Number(tb).toLocaleString('es-CL')}</span></div>`;
        if (tp) tarifasHtml += `<div style="display:flex;justify-content:space-between;"><span style="color:#eab308">Tarifa Punta:</span><span style="color:#f4f4f5;font-weight:600">$${Number(tp).toLocaleString('es-CL')}</span></div>`;
        if (ts) tarifasHtml += `<div style="display:flex;justify-content:space-between;"><span style="color:#ef4444">Saturación:</span><span style="color:#f4f4f5;font-weight:600">$${Number(ts).toLocaleString('es-CL')}</span></div>`;
        tarifasHtml += `</div>`;
      }

      marker.bindPopup(`<div style="font-family:'Inter',sans-serif;min-width:220px;color:#f4f4f5;background:#09090b;padding:6px;border:none;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${p.color}"></div>
          <div style="font-size:14px;font-weight:600">${p.nombre}</div>
        </div>
        <div style="font-size:12px;color:#a1a1aa;margin-bottom:8px">${p.autopista} ${p.tramo === 'N/A' ? '' : '• ' + p.tramo}</div>
        <div style="font-size:12px;color:#d4d4d8;line-height:1.6">
          <div style="display:flex;justify-content:space-between;"><span style="color:#71717a">Kilómetro:</span><span>${p.km}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#71717a">Comuna:</span><span>${p.comuna || 'N/A'}</span></div>
          ${p.sentido ? `<div style="display:flex;justify-content:space-between;"><span style="color:#71717a">Sentido:</span><span>${p.sentido}</span></div>` : ''}
          ${p.salida ? `<div style="display:flex;justify-content:space-between;"><span style="color:#71717a">Salida:</span><span>${p.salida}</span></div>` : ''}
        </div>${tarifasHtml}</div>`, { className: 'shadcn-popup' });

      marker.on('click', () => { onPorticoClick?.(p); });
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    if (filtered.length > 0 && selectedAutopista) {
      const bounds = L.latLngBounds(filtered.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [isReady, porticos, selectedAutopista, onPorticoClick]);

  // ── Route layer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    routeLayerRef.current?.remove(); routeLayerRef.current = null;
    originMarkerRef.current?.remove(); originMarkerRef.current = null;
    destMarkerRef.current?.remove(); destMarkerRef.current = null;

    if (routeGeometry) {
      routeLayerRef.current = L.geoJSON(routeGeometry, {
        style: { color: '#3b82f6', weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round' },
      }).addTo(map);
      map.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });

      // Pre-compute route segments for animation
      const pts = coordsToPoints(routeGeometry.coordinates as number[][]);
      routeSegsRef.current = routeSegments(pts);
    } else {
      routeSegsRef.current = null;
    }

    if (origin) {
      originMarkerRef.current = L.circleMarker(origin, { radius: 8, fillColor: '#22c55e', color: '#fff', weight: 3, opacity: 1, fillOpacity: 1 }).addTo(map);
    }
    if (destination) {
      destMarkerRef.current = L.circleMarker(destination, { radius: 8, fillColor: '#ef4444', color: '#fff', weight: 3, opacity: 1, fillOpacity: 1 }).addTo(map);
    }
  }, [isReady, routeGeometry, origin, destination]);

  // ── Comunas GeoJSON layer (à la Windy) ─────────────────────────────
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!showComunas) {
      if (comunaLayerRef.current) {
        comunaLayerRef.current.remove();
        comunaLayerRef.current = null;
      }
      setComunaColors({});
      return;
    }

    // ── Golden-angle HSL ↔ maximum differentiation between neighbours ──
    const getColor = (i: number) => {
      const hue = Math.round((i * 137.508) % 360);
      const sat = 70 + (i % 3) * 8;   // 70 | 78 | 86
      const lit = 52 + (i % 4) * 3;   // 52 | 55 | 58 | 61
      return `hsl(${hue},${sat}%,${lit}%)`;
    };

    const buildLayer = (geojson: any) => {
      const rmFeatures: any[] = geojson.features
        .filter((f: any) => f.properties.codregion === 13)
        .sort((a: any, b: any) =>
          a.properties.Comuna.localeCompare(b.properties.Comuna, 'es')
        );

      const colorMap: Record<string, string> = {};
      rmFeatures.forEach((f: any, i: number) => {
        colorMap[f.properties.Comuna] = getColor(i);
      });
      setComunaColors(colorMap);

      const defaultStyle = (color: string): L.PathOptions => ({
        fillColor: color,
        fillOpacity: 0.48,
        color: 'rgba(0,0,0,0)',   // invisible internal borders
        weight: 0,
      });
      const hoverStyle = (color: string): L.PathOptions => ({
        fillColor: color,
        fillOpacity: 0.82,
        color: 'rgba(255,255,255,0.90)',
        weight: 2,
      });


      const layer = L.geoJSON(
        { ...geojson, features: rmFeatures } as any,
        {
          style: (feature: any) => defaultStyle(
            colorMap[feature.properties.Comuna] ?? '#6366f1'
          ),
          onEachFeature: (feature: any, lyr: any) => {
            const nombre: string = feature.properties.Comuna;
            const color = colorMap[nombre] ?? '#6366f1';

            lyr.bindTooltip(
              `<span style="display:inline-flex;align-items:center;gap:5px">
                 <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>
                 ${nombre}
               </span>`,
              { permanent: false, direction: 'auto', className: 'comuna-tooltip', sticky: true }
            );

            lyr.on('mouseover', () => {
              lyr.setStyle(hoverStyle(color));
              lyr.bringToFront();
            });
            lyr.on('mouseout', () => lyr.setStyle(defaultStyle(color)));
            lyr.on('click', () => onComunaClick?.(nombre));
          },
        }
      );

      return layer;
    };

    const show = async () => {
      setLoadingComunas(true);
      try {
        if (!comunaGeoJSONRef.current) {
          const res = await fetch(
            'https://raw.githubusercontent.com/fcortes/Chile-GeoJSON/master/comunas.geojson'
          );
          comunaGeoJSONRef.current = await res.json();
        }
        comunaLayerRef.current?.remove();
        comunaLayerRef.current = null;
        const lyr = buildLayer(comunaGeoJSONRef.current);
        lyr.addTo(map);
        comunaLayerRef.current = lyr;
      } catch (e) {
        console.error('Error loading comunas GeoJSON', e);
      } finally {
        setLoadingComunas(false);
      }
    };

    show();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, showComunas]);

  // ── Pre-compute portico positions on route ────────────────────────────────
  useEffect(() => {
    routePorticosRef.current = routePorticos;
    if (!routeSegsRef.current || routePorticos.length === 0) {
      porticoPositionsRef.current = [];
      return;
    }
    const { segs, total } = routeSegsRef.current;

    // For each routePortico find its closest t on the route
    const positions = routePorticos.map((p) => {
      let bestT = 0;
      let bestDist = Infinity;
      let cumul = 0;
      for (const seg of segs) {
        // Sample a few points along segment
        for (let f = 0; f <= 1; f += 0.1) {
          const lat = seg.from[0] + (seg.to[0] - seg.from[0]) * f;
          const lng = seg.from[1] + (seg.to[1] - seg.from[1]) * f;
          const d = haversine([lat, lng], [p.lat, p.lng]);
          const t = (cumul + seg.dist * f) / total;
          if (d < bestDist) { bestDist = d; bestT = t; }
        }
        cumul += seg.dist;
      }
      // revenue for cat1 avg
      const getPrice = (cat: 1 | 2 | 3) => {
        if (p.tarifas_urbanas) {
          const catKey = cat === 1 ? 'categoria_1_4' : cat === 2 ? 'categoria_2' : 'categoria_3';
          const data = (p.tarifas_urbanas as any)[catKey] || p.tarifas_urbanas;
          let price: number | undefined;
          if (timeProfile === 'valle') price = (data as any).TBFP || (data as any).tarifa_base_fuera_punta;
          if (timeProfile === 'punta') price = (data as any).TBP || (data as any).tarifa_base_punta;
          if (timeProfile === 'saturacion') price = (data as any).TS || (data as any).tarifa_saturacion;
          if (price !== undefined) return Number(price);
        }
        const base = p.precio || 1200;
        if (cat === 1) return base;
        if (cat === 2) return base * 1.8;
        return base * 3.5;
      };
      const pct3 = Math.max(0, 100 - pctCat1 - pctCat2);
      const avgRev = (getPrice(1) * pctCat1 + getPrice(2) * pctCat2 + getPrice(3) * pct3) / 100;
      return { t: bestT, revenue: avgRev };
    });
    porticoPositionsRef.current = positions;
  }, [routePorticos, routeGeometry, pctCat1, pctCat2, timeProfile]);

  // ── Helper to spawn a vehicle ────────────────────────────────────────────
  const spawnVehicle = useCallback((): SimVehicle | null => {
    if (!vehicleLayerRef.current || !mapInstanceRef.current) return null;
    const roll = Math.random() * 100;
    let type: VehicleType;
    let revenue = 1200;
    const pct3 = Math.max(0, 100 - pctCat1 - pctCat2);
    if (roll < pctCat1) {
      type = 'car';
      revenue = porticoPositionsRef.current.length > 0
        ? porticoPositionsRef.current.reduce((s, p) => s + p.revenue, 0) / porticoPositionsRef.current.length
        : 1200;
    } else if (roll < pctCat1 + pctCat2) {
      type = 'truck';
      revenue = (porticoPositionsRef.current.length > 0
        ? porticoPositionsRef.current.reduce((s, p) => s + p.revenue, 0) / porticoPositionsRef.current.length
        : 1200) * 1.8;
    } else {
      type = 'heavy';
      revenue = (porticoPositionsRef.current.length > 0
        ? porticoPositionsRef.current.reduce((s, p) => s + p.revenue, 0) / porticoPositionsRef.current.length
        : 1200) * 3.5;
    }

    const color = type === 'car'
      ? CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]
      : TRUCK_COLORS[Math.floor(Math.random() * TRUCK_COLORS.length)];

    const speedKmh = type === 'car' ? randomBetween(60, 100) : type === 'truck' ? randomBetween(40, 65) : randomBetween(30, 50);
    // t per second: how much of the route covered per second (route total in meters / 1000 → km, /speedKmh * 3600 → seconds)
    const totalM = routeSegsRef.current?.total ?? 10000;
    const speedTperSec = (speedKmh / 3.6) / totalM; // fraction of route per second

    const el = document.createElement('div');
    const marker = L.marker([0, 0], {
      icon: makeLeafletIcon(type, color, 0),
      zIndexOffset: 1000,
      interactive: false,
    });
    marker.addTo(vehicleLayerRef.current!);

    return {
      id: vehicleIdRef.current++,
      color,
      type,
      t: 0,
      speed: speedTperSec,
      revenue,
      firedPorticos: new Set(),
      el,
      marker,
    };
  }, [pctCat1, pctCat2]);

  // ── Money burst helper ───────────────────────────────────────────────────
  const spawnMoneyBurst = useCallback((latlng: [number, number], amount: number) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const pt = map.latLngToContainerPoint(latlng);

    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;
      left:${pt.x}px;
      top:${pt.y}px;
      transform:translate(-50%,-50%);
      background:#16a34a;
      color:white;
      font-size:11px;
      font-weight:700;
      font-family:monospace;
      padding:3px 8px;
      border-radius:999px;
      pointer-events:none;
      z-index:9999;
      white-space:nowrap;
      box-shadow:0 0 12px rgba(34,197,94,0.5);
      transition:none;
    `;
    el.textContent = `+$${Math.round(amount).toLocaleString('es-CL')}`;
    mapRef.current?.parentElement?.appendChild(el);
    moneyBurstsRef.current.push({ el, created: performance.now() });
  }, []);

  // ── Main sim loop ────────────────────────────────────────────────────────
  const animate = useCallback((ts: number) => {
    if (!simActiveRef.current) return;
    if (isPausedRef.current) { rafRef.current = requestAnimationFrame(animate); return; }

    const elapsed = (ts - simStartRef.current) / 1000; // seconds
    const SIM_DURATION_S = 10;
    const progress = Math.min(elapsed / SIM_DURATION_S, 1);

    // Spawn vehicles
    const spawnIntervalMs = 1000 / (flowPerHour / 3600);
    if (ts - lastSpawnRef.current > spawnIntervalMs) {
      lastSpawnRef.current = ts;
      const v = spawnVehicle();
      if (v) vehiclesRef.current.push(v);
    }

    const dt = 1 / 60; // assume ~60fps
    const dead: SimVehicle[] = [];

    vehiclesRef.current.forEach((v) => {
      v.t += v.speed * dt;

      if (v.t >= 1) {
        dead.push(v);
        return;
      }

      if (!routeSegsRef.current) return;
      const { latlng, bearing } = interpolateRoute(routeSegsRef.current.segs, routeSegsRef.current.total, v.t);
      v.marker.setLatLng(latlng);
      v.marker.setIcon(makeLeafletIcon(v.type, v.color, bearing));

      // Check portico crossings
      porticoPositionsRef.current.forEach((pp, idx) => {
        if (!v.firedPorticos.has(idx) && v.t >= pp.t) {
          v.firedPorticos.add(idx);
          accRevRef.current += v.revenue;
          accVehRef.current += 1;
          spawnMoneyBurst(latlng, v.revenue);
        }
      });
    });

    // Remove finished vehicles
    dead.forEach((v) => {
      v.marker.remove();
      vehiclesRef.current = vehiclesRef.current.filter((x) => x.id !== v.id);
    });

    // Animate money bursts
    const now = performance.now();
    moneyBurstsRef.current = moneyBurstsRef.current.filter((b) => {
      const age = (now - b.created) / 1000;
      if (age > 1.5) { b.el.remove(); return false; }
      const frac = age / 1.5;
      b.el.style.opacity = String(1 - frac);
      b.el.style.top = `${parseFloat(b.el.style.top) - 0.5}px`;
      return true;
    });

    onSimTickRef.current?.(accVehRef.current, accRevRef.current, progress * 60);

    if (progress < 1) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      // cleanup vehicles
      vehiclesRef.current.forEach((v) => v.marker.remove());
      vehiclesRef.current = [];
      moneyBurstsRef.current.forEach((b) => b.el.remove());
      moneyBurstsRef.current = [];
      simActiveRef.current = false;
      onSimCompleteRef.current?.();
    }
  }, [flowPerHour, spawnVehicle, spawnMoneyBurst]);

  // ── React to simActive prop changes ──────────────────────────────────────
  useEffect(() => {
    if (simActive) {
      // Reset state
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      vehiclesRef.current.forEach((v) => v.marker.remove());
      vehiclesRef.current = [];
      moneyBurstsRef.current.forEach((b) => b.el.remove());
      moneyBurstsRef.current = [];
      accRevRef.current = 0;
      accVehRef.current = 0;
      vehicleIdRef.current = 0;
      lastSpawnRef.current = 0;
      isPausedRef.current = false;
      simActiveRef.current = true;
      simStartRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animate);
    } else {
      simActiveRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      vehiclesRef.current.forEach((v) => v.marker.remove());
      vehiclesRef.current = [];
      moneyBurstsRef.current.forEach((b) => b.el.remove());
      moneyBurstsRef.current = [];
    }
  }, [simActive, animate]);

  // ── React to pause ────────────────────────────────────────────────────────
  useEffect(() => {
    if (simPaused) {
      pausedAtRef.current = performance.now();
      isPausedRef.current = true;
    } else {
      if (isPausedRef.current && simActiveRef.current) {
        const pausedDuration = performance.now() - pausedAtRef.current;
        simStartRef.current += pausedDuration;
      }
      isPausedRef.current = false;
    }
  }, [simPaused]);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={mapRef} className="absolute inset-0 z-0 bg-black" />

      {/* Loading comunas */}
      {loadingComunas && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[800] flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 text-zinc-300 text-[10px] font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
          <span className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          Cargando comunas…
        </div>
      )}

      {/* Comunas legend – Windy style */}
      {showComunas && Object.keys(comunaColors).length > 0 && (
        <div className="absolute bottom-12 right-14 z-[800] pointer-events-auto select-none" style={{ maxHeight: '60vh' }}>
          <div className="bg-zinc-950/85 backdrop-blur-md border border-zinc-700/60 rounded-xl shadow-2xl overflow-hidden" style={{ width: 180 }}>
            {/* Header */}
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-zinc-300 hover:text-white transition-colors"
              onClick={() => setLegendOpen(v => !v)}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" />
                </svg>
                Comunas RM
              </span>
              <svg className={`w-3 h-3 transition-transform ${legendOpen ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <polyline points="6 15 12 9 18 15" />
              </svg>
            </button>

            {legendOpen && (
              <>
                {/* Search */}
                <div className="px-2 pb-2">
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={legendFilter}
                    onChange={e => setLegendFilter(e.target.value)}
                    className="w-full bg-zinc-800/80 border border-zinc-700 rounded-md text-[10px] text-zinc-200 placeholder-zinc-500 px-2 py-1 outline-none focus:border-indigo-500"
                  />
                </div>
                {/* List */}
                <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                  {Object.entries(comunaColors)
                    .filter(([name]) =>
                      name.toLowerCase().includes(legendFilter.toLowerCase())
                    )
                    .map(([name, color]) => (
                      <button
                        key={name}
                        title={name}
                        onClick={() => onComunaClick?.(name)}
                        className="w-full flex items-center gap-2 px-3 py-1 hover:bg-zinc-800/70 transition-colors cursor-pointer"
                      >
                        <span
                          className="shrink-0 rounded-sm"
                          style={{ width: 12, height: 12, background: color, boxShadow: `0 0 5px ${color}80` }}
                        />
                        <span className="text-[10px] text-zinc-200 truncate text-left">{name}</span>
                      </button>
                    ))
                  }
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!isReady && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border border-zinc-800 border-t-white rounded-full animate-spin" />
            <span className="text-zinc-500 tracking-[0.2em] text-[10px] font-bold uppercase font-mono">Initializing Telemetry...</span>
          </div>
        </div>
      )}
    </div>
  );
}
