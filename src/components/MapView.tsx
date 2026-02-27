'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Portico, findComuna } from '@/data';
import * as L from 'leaflet';

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
  selectedComuna?: any;
  centerOn?: [number, number] | null;
  // Simulation props
  simActive?: boolean;
  simPaused?: boolean;
  flowPerHour?: number;
  pctCat1?: number;
  pctCat2?: number;
  pctCat3?: number;
  routePorticos?: Portico[];
  timeProfile?: 'punta' | 'valle' | 'saturacion';
  onSimTick?: (stats: { vehicles: number; revenue: number; minutes: number }) => void;
  onSimComplete?: () => void;
  pickingMode?: 'origin' | 'destination' | null;
};

// Types for simulation
interface Vehicle {
  id: number;
  marker: L.Marker;
  path: L.LatLng[];
  totalDist: number;
  currentDist: number;
  speed: number; // km/min
  porticosPassed: Set<string>;
  startTime: number;
  category: 1 | 2 | 3;
  color: string;
}

interface MoneyBurst {
  id: number;
  el: HTMLDivElement;
  startTime: number;
}

// Helper to split route into small segments for interpolation
function routeSegments(geometry: GeoJSON.LineString) {
  const coords = geometry.coordinates;
  const segments: { p1: L.LatLng; p2: L.LatLng; dist: number }[] = [];
  let totalDist = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = L.latLng(coords[i][1], coords[i][0]);
    const p2 = L.latLng(coords[i + 1][1], coords[i + 1][0]);
    const d = p1.distanceTo(p2) / 1000; // km
    segments.push({ p1, p2, dist: d });
    totalDist += d;
  }
  return { segments, totalDist };
}

// Function to generate golden-angle HSL colors for distinct communes
function getComunaColor(index: number, total: number) {
  const hue = (index * 137.508) % 360; // Golden angle
  return `hsl(${hue}, 65%, 55%)`;
}

export default function MapView({
  porticos,
  selectedAutopista,
  onPorticoClick,
  onMapClick,
  routeGeometry,
  origin,
  destination,
  showComunas,
  onComunaClick,
  selectedComuna,
  centerOn,
  simActive,
  simPaused,
  flowPerHour = 1500,
  pctCat1 = 70,
  pctCat2 = 20,
  pctCat3 = 10,
  routePorticos = [],
  timeProfile = 'punta',
  onSimTick,
  onSimComplete,
  pickingMode,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const muniMarkerRef = useRef<L.Marker | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Comunas layer state
  const comunasLayerRef = useRef<L.GeoJSON | null>(null);
  const [comunaColors, setComunaColors] = useState<Record<string, string>>({});
  const [loadingComunas, setLoadingComunas] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [legendFilter, setLegendFilter] = useState('');
  const geoJsonCacheRef = useRef<any>(null);

  // Simulation Refs
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const moneyBurstsRef = useRef<MoneyBurst[]>([]);
  const rafRef = useRef<number | null>(null);
  const simStartRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const accRevenueRef = useRef(0);
  const accVehRef = useRef(0);
  const vehicleIdRef = useRef(0);
  const isPausedRef = useRef(false);
  const simActiveRef = useRef(false);

  // Per-portico simulation counters
  const porticoStatsLayerRef = useRef<L.LayerGroup | null>(null);
  const porticoAccumulatedRef = useRef<number[]>([]);
  const porticoMarkersRef = useRef<L.Marker[]>([]);

  const routeSegsRef = useRef<ReturnType<typeof routeSegments> | null>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const routePorticosRef = useRef<Portico[]>([]);
  const porticoPositionsRef = useRef<{ t: number; revenue: number }[]>([]);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  const onSimTickRef = useRef(onSimTick);
  useEffect(() => { onSimTickRef.current = onSimTick; }, [onSimTick]);
  const onSimCompleteRef = useRef(onSimComplete);
  useEffect(() => { onSimCompleteRef.current = onSimComplete; }, [onSimComplete]);

  // Refs for sim params to avoid animate recreation
  const flowPerHourRef = useRef(flowPerHour);
  useEffect(() => { flowPerHourRef.current = flowPerHour; }, [flowPerHour]);
  const pctCat1Ref = useRef(pctCat1);
  useEffect(() => { pctCat1Ref.current = pctCat1; }, [pctCat1]);
  const pctCat2Ref = useRef(pctCat2);
  useEffect(() => { pctCat2Ref.current = pctCat2; }, [pctCat2]);
  const pctCat3Ref = useRef(pctCat3);
  useEffect(() => { pctCat3Ref.current = pctCat3; }, [pctCat3]);
  const timeProfileRef = useRef(timeProfile);
  useEffect(() => { timeProfileRef.current = timeProfile; }, [timeProfile]);

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
    porticoStatsLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    setIsReady(true);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // ── Center on location ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isReady && centerOn && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(centerOn, 12, { duration: 1.5 });
    }
  }, [centerOn, isReady]);

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

      const cData = p.comuna ? findComuna(p.comuna) : null;
      const logoHtml = cData ? `<img src="${cData.logo_url}" style="width:20px;height:20px;object-contain:contain;" />` : '';

      marker.bindPopup(`<div style="font-family:'Inter',sans-serif;min-width:240px;color:#f4f4f5;background:#09090b;padding:6px;border:none;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;items-center:center;gap:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${p.color}"></div>
            <div style="font-size:14px;font-weight:600">${p.nombre}</div>
          </div>
          ${logoHtml}
        </div>
        <div style="font-size:12px;color:#a1a1aa;margin-bottom:12px">${p.autopista} ${p.tramo === 'N/A' ? '' : '• ' + p.tramo}</div>
        <div style="font-size:12px;color:#d4d4d8;line-height:1.6;background:#18181b;padding:8px;border-radius:6px;border:1px solid #27272a;">
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
      const latlngs = routeGeometry.coordinates.map(c => [c[1], c[0]] as [number, number]);
      routeLayerRef.current = L.polyline(latlngs, { color: '#3b82f6', weight: 5, opacity: 0.8 }).addTo(map);
      map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
    }

    if (origin) {
      originMarkerRef.current = L.marker([origin[0], origin[1]], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color:#10b981;width:12px;height:12px;border:2px solid white;border-radius:50%;box-shadow:0 0 10px rgba(16,185,129,0.5);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map);
    }

    if (destination) {
      destMarkerRef.current = L.marker([destination[0], destination[1]], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color:#ef4444;width:12px;height:12px;border:2px solid white;border-radius:50%;box-shadow:0 0 10px rgba(239,68,68,0.5);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map);
    }
  }, [isReady, routeGeometry, origin, destination]);

  // ── Comunas GeoJSON Layer ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (comunasLayerRef.current) {
      comunasLayerRef.current.remove();
      comunasLayerRef.current = null;
    }

    if (!showComunas && !selectedComuna) return;

    const loadGeoJson = async () => {
      setLoadingComunas(true);
      try {
        let geoData = geoJsonCacheRef.current;
        if (!geoData) {
          const res = await fetch('https://raw.githubusercontent.com/fcortes/Chile-GeoJSON/master/comunas.geojson');
          geoData = await res.json();
          geoJsonCacheRef.current = geoData;
        }

        // Filter to Santiago Metropolitan Region (Region 13)
        const rmComunas = {
          ...geoData,
          features: geoData.features.filter((f: any) => f.properties.REGION === "13")
        };

        // Create colors
        const colors: Record<string, string> = {};
        rmComunas.features.forEach((f: any, i: number) => {
          colors[f.properties.COMUNA] = getComunaColor(i, rmComunas.features.length);
        });
        setComunaColors(colors);

        comunasLayerRef.current = L.geoJSON(rmComunas, {
          style: (feature: any) => {
            const isSelected = selectedComuna?.comuna?.toLowerCase() === feature.properties.COMUNA?.toLowerCase();

            // Si no estamos mostrando todas, y esta no es la seleccionada, hacerla invisible
            if (!showComunas && !isSelected) {
              return { fillOpacity: 0, weight: 0, opacity: 0, color: 'transparent' };
            }

            return {
              fillColor: isSelected ? '#3b82f6' : colors[feature.properties.COMUNA],
              weight: isSelected ? 4 : 0.5,
              opacity: isSelected ? 1 : 0.2,
              color: isSelected ? '#fff' : 'transparent',
              fillOpacity: isSelected ? 0.45 : 0.35,
            };
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const name = feature.properties.COMUNA;
            const isSelected = selectedComuna?.comuna?.toLowerCase() === name?.toLowerCase();

            // Solo poner tooltip si es visible
            if (showComunas || isSelected) {
              layer.bindTooltip(`<div class="comuna-tooltip">${name}</div>`, {
                sticky: true,
                direction: 'center',
                className: 'comuna-label'
              });
            }

            layer.on({
              mouseover: (e: any) => {
                const l = e.target;
                l.setStyle({ fillOpacity: 0.6, weight: 2, color: '#fff', opacity: 1 });
              },
              mouseout: (e: any) => {
                const l = e.target;
                const isSelected = selectedComuna?.comuna?.toLowerCase() === feature.properties.COMUNA?.toLowerCase();
                l.setStyle({
                  fillOpacity: isSelected ? 0.6 : 0.35,
                  weight: isSelected ? 3 : 0,
                  color: isSelected ? '#3b82f6' : 'transparent',
                  opacity: isSelected ? 1 : 0
                });
              },
              click: (e: any) => {
                onComunaClick?.(feature.properties.COMUNA);
                L.DomEvent.stopPropagation(e);
              }
            });
          }
        }).addTo(map);
      } catch (err) {
        console.error('Error loading comunas GeoJSON:', err);
      } finally {
        setLoadingComunas(false);
      }
    };

    loadGeoJson();
  }, [isReady, showComunas, onComunaClick, selectedComuna]); // selectedComuna added to deps

  // ── Auto-pan to selected comuna & Show Muni Marker ──────────────────────────
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    muniMarkerRef.current?.remove();
    muniMarkerRef.current = null;

    if (selectedComuna) {
      // Create house icon for Municipalidad
      const houseIcon = L.divIcon({
        className: 'muni-marker-icon',
        html: `
          <div style="background: #3b82f6; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      muniMarkerRef.current = L.marker([selectedComuna.lat, selectedComuna.lng], { icon: houseIcon })
        .addTo(map)
        .bindPopup(`
          <div style="text-align: center; padding: 4px; font-family: 'Inter', sans-serif;">
            <div style="font-weight: 800; font-size: 13px; color: #fff;">Municipalidad de ${selectedComuna.comuna}</div>
            <div style="font-size: 11px; color: #a1a1aa; margin-top: 4px;">${selectedComuna.direccion_municipal || 'Dirección no disponible'}</div>
          </div>
        `, { className: 'muni-popup' });

      map.flyTo([selectedComuna.lat, selectedComuna.lng], 14, {
        animate: true,
        duration: 1.5
      });
    }
  }, [isReady, selectedComuna]);

  // ── Simulation Logic ────────────────────────────────────────────────────────
  const animate = useCallback((time: number) => {
    if (!simActiveRef.current || isPausedRef.current) return;

    const elapsedWall = time - simStartRef.current;
    const simMinutes = elapsedWall / 166.67; // 10 seconds real = 60 minutes sim (60 / 10 = 6 min/sec = 0.006 min/ms -> 1/0.006 = 166.67)

    // Check for completion
    if (simMinutes >= 60) {
      simActiveRef.current = false;
      onSimCompleteRef.current?.();
      return;
    }

    // 1. Spawn logic
    const flow = flowPerHourRef.current || 1500;
    const intervalMs = (60 / flow) * 166.67; // Interval in real MS

    // Pulse spawn: permit spawning multiple per frame if flow is very high
    let timeToSpawn = time - lastSpawnRef.current;
    while (timeToSpawn > intervalMs) {
      if (routeSegsRef.current) {
        const rand = Math.random() * 100;
        let cat: 1 | 2 | 3 = 1;
        let color = '#3b82f6';
        let iconHtml = '';

        if (rand < pctCat1Ref.current) {
          cat = 1;
          color = '#3b82f6';
          iconHtml = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42.99L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM5 13h14v5H5v-5zm11.5 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM7.5 17c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>';
        } else if (rand < pctCat1Ref.current + pctCat2Ref.current) {
          cat = 2;
          color = '#f59e0b';
          iconHtml = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-3.5-6H5V6h11v6.5z"/></svg>';
        } else {
          cat = 3;
          color = '#ef4444';
          iconHtml = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/><rect x="4" y="14" width="14" height="2" fill="white" fill-opacity="0.3"/><circle cx="7" cy="18.5" r="1.5"/><circle cx="16" cy="18.5" r="1.5"/></svg>';
        }

        const pathCoords = routeCoordsRef.current;
        const latLngPath = pathCoords.map(c => L.latLng(c[1], c[0]));
        
        const speed = 0.5 + Math.random() * 0.5; // 0.5-1.0 km/min
        
        const marker = L.marker(latLngPath[0], {
          icon: L.divIcon({
            className: 'vehicle-icon',
            html: `<div style="color: ${color}; transform: rotate(0deg); transition: transform 0.2s;">${iconHtml}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(vehicleLayerRef.current!);

        vehiclesRef.current.push({
          id: vehicleIdRef.current++,
          marker,
          path: latLngPath,
          totalDist: routeSegsRef.current!.totalDist,
          currentDist: 0,
          speed,
          porticosPassed: new Set(),
          startTime: time,
          category: cat,
          color: color
        });
        accVehRef.current++;
        lastSpawnRef.current += intervalMs;
        timeToSpawn -= intervalMs;
      } else {
        break;
      }
    }

    // 2. Move logic
    const activeVehicles: Vehicle[] = [];
    const now = time;

    vehiclesRef.current.forEach(v => {
      const dt = 16.67;
      const simDt = dt / 166.67;
      v.currentDist += v.speed * simDt;

      if (v.currentDist < v.totalDist) {
        // Find position on path
        let d = 0;
        let p: L.LatLng = v.path[0];
        for (let i = 0; i < v.path.length - 1; i++) {
          const segD = v.path[i].distanceTo(v.path[i + 1]) / 1000;
          if (d + segD > v.currentDist) {
            const ratio = (v.currentDist - d) / segD;
            p = L.latLng(
              v.path[i].lat + (v.path[i + 1].lat - v.path[i].lat) * ratio,
              v.path[i].lng + (v.path[i + 1].lng - v.path[i].lng) * ratio
            );
            break;
          }
          d += segD;
        }
        v.marker.setLatLng(p);

        // Portico intersection
        porticoPositionsRef.current.forEach((pp, idx) => {
          if (v.currentDist >= pp.t && !v.porticosPassed.has(idx.toString())) {
            v.porticosPassed.add(idx.toString());

            // Calculate actual price base on category
            let price = pp.revenue;

            // Try to use exact category mapping if data available
            const rp = routePorticosRef.current[idx];
            if (rp && rp.tarifas_urbanas) {
              const catKey = v.category === 1 ? 'categoria_1_4' : v.category === 2 ? 'categoria_2' : 'categoria_3';
              const catObj = rp.tarifas_urbanas[catKey] || rp.tarifas_urbanas;
              const keyMap: any = {
                'punta': ['tarifa_base_punta', 'TBP', 'Tarifa_Punta', 'TS'],
                'saturacion': ['tarifa_saturacion', 'TS', 'Tarifa_Saturacion', 'TBP'],
                'valle': ['tarifa_base_fuera_punta', 'TBFP', 'Tarifa_Base']
              };
              const keys = keyMap[timeProfileRef.current];
              let foundP = 0;
              for (const k of keys) {
                if (catObj[k] !== undefined && catObj[k] !== null) { foundP = Number(catObj[k]); break; }
              }
              price = foundP || Number(catObj.TBFP) || Number(catObj.tarifa_base_fuera_punta) || pp.revenue || 0;
            } else {
              // Fallback multiplier if urban data is missing
              if (v.category === 2) price *= 2.3;
              if (v.category === 3) price *= 3.5;
            }

            accRevenueRef.current += price;

            // Updated: Update per-portico counter
            if (porticoAccumulatedRef.current[idx] !== undefined) {
              porticoAccumulatedRef.current[idx] += price;
              const marker = porticoMarkersRef.current[idx];
              if (marker) {
                const total = Math.round(porticoAccumulatedRef.current[idx]);
                marker.setIcon(L.divIcon({
                  className: 'portico-revenue-label pulse',
                  html: `<span>${routePorticosRef.current[idx]?.nombre || 'Pórtico'}</span><span class="value">$${total.toLocaleString('es-CL')}</span>`,
                  iconSize: [80, 40],
                  iconAnchor: [40, 50]
                }));
                // Remove pulse class after animation
                setTimeout(() => {
                  marker.setIcon(L.divIcon({
                    className: 'portico-revenue-label',
                    html: `<span>${routePorticosRef.current[idx]?.nombre || 'Pórtico'}</span><span class="value">$${total.toLocaleString('es-CL')}</span>`,
                    iconSize: [80, 40],
                    iconAnchor: [40, 50]
                  }));
                }, 300);
              }
            }

            // Money burst animation
            if (mapInstanceRef.current && mapRef.current) {
              const point = mapInstanceRef.current.latLngToContainerPoint(p);
              const burst = document.createElement('div');
              burst.className = 'money-burst';
              burst.innerText = `+$${Math.round(price)}`;
              burst.style.left = `${point.x}px`;
              burst.style.top = `${point.y}px`;
              burst.style.color = v.color;
              mapRef.current.appendChild(burst);
              moneyBurstsRef.current.push({ id: Date.now() + Math.random(), el: burst, startTime: now });
            }
          }
        });

        activeVehicles.push(v);
      } else {
        v.marker.remove();
      }
    });
    vehiclesRef.current = activeVehicles;

    // 3. Bursts cleanup
    moneyBurstsRef.current = moneyBurstsRef.current.filter(b => {
      if (now - b.startTime > 1000) {
        b.el.remove();
        return false;
      }
      return true;
    });

    onSimTickRef.current?.({
      vehicles: accVehRef.current,
      revenue: accRevenueRef.current,
      minutes: simMinutes
    });

    rafRef.current = requestAnimationFrame(animate);
  }, []); // No dependencies - uses refs internally

  useEffect(() => {
    if (simActive && routeGeometry) {
      const segs = routeSegments(routeGeometry);
      routeSegsRef.current = segs;
      routeCoordsRef.current = routeGeometry.coordinates as [number, number][];

      // Pre-calculate portico T positions (0 to totalDist)
      const pp: { t: number; revenue: number }[] = [];
      routePorticos.forEach(rp => {
        // Find closest point on path for this portico
        let minDist = Infinity;
        let minT = 0;
        let d = 0;
        for (let i = 0; i < segs.segments.length; i++) {
          const s = segs.segments[i];
          const distToP1 = L.latLng(rp.lat, rp.lng).distanceTo(s.p1) / 1000;
          if (distToP1 < minDist) { minDist = distToP1; minT = d; }
          d += s.dist;
        }

        let price = rp.precio || 0;
        if (rp.tarifas_urbanas) {
          const catObj = rp.tarifas_urbanas.categoria_1_4 || rp.tarifas_urbanas;
          const key = timeProfile === 'punta' ? 'TBP' : timeProfile === 'saturacion' ? 'TS' : 'TBFP';
          price = catObj[key] || catObj.TBFP || rp.precio || 0;
        }
        pp.push({ t: minT, revenue: price });
      });
      porticoPositionsRef.current = pp;
      routePorticosRef.current = routePorticos;

      // Initialize per-portico counters
      porticoStatsLayerRef.current?.clearLayers();
      porticoAccumulatedRef.current = new Array(routePorticos.length).fill(0);
      porticoMarkersRef.current = [];

      routePorticos.forEach((rp, i) => {
        const marker = L.marker([rp.lat, rp.lng], {
          icon: L.divIcon({
            className: 'portico-revenue-label',
            html: `<span>${rp.nombre}</span><span class="value">$0</span>`,
            iconSize: [80, 40],
            iconAnchor: [40, 50]
          })
        }).addTo(porticoStatsLayerRef.current!);
        porticoMarkersRef.current.push(marker);
      });

      accRevenueRef.current = 0;
      accVehRef.current = 0;
      vehicleIdRef.current = 0;
      lastSpawnRef.current = 0;
      isPausedRef.current = false;
      simActiveRef.current = true;
      simStartRef.current = performance.now();
      // Ensure we clean up any old loop before starting new one
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(animate);
    } else {
      simActiveRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      vehiclesRef.current.forEach((v) => v.marker.remove());
      vehiclesRef.current = [];
      moneyBurstsRef.current.forEach((b) => b.el.remove());
      moneyBurstsRef.current = [];
      porticoStatsLayerRef.current?.clearLayers();
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [simActive, animate, routeGeometry, routePorticos, timeProfile]);

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
    <div className={`relative w-full h-full bg-black ${pickingMode ? 'cursor-crosshair' : ''}`}>
      <div ref={mapRef} className={`absolute inset-0 z-0 bg-black ${pickingMode ? 'pointer-events-auto' : ''}`} />

      {/* Loading comunas */}
      {loadingComunas && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-800 flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 text-zinc-300 text-[10px] font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
          <span className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          Cargando comunas…
        </div>
      )}

      {/* Comunas legend – Windy style */}
      {showComunas && Object.keys(comunaColors).length > 0 && (
        <div className="absolute bottom-12 right-14 z-800 pointer-events-auto select-none" style={{ maxHeight: '60vh' }}>
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
