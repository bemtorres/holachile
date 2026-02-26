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
  // Simulation props
  simActive?: boolean;
  simPaused?: boolean;
  flowPerHour?: number;
  pctCat1?: number;
  pctCat2?: number;
  routePorticos?: Portico[];
  timeProfile?: 'punta' | 'valle' | 'saturacion';
  onSimTick?: (stats: { vehicles: number; revenue: number; minutes: number }) => void;
  onSimComplete?: () => void;
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
  category: 1 | 2;
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
  simActive,
  simPaused,
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
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
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

    if (!showComunas) return;

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
            return {
              fillColor: colors[feature.properties.COMUNA],
              weight: isSelected ? 3 : 0,
              opacity: isSelected ? 1 : 0,
              color: isSelected ? '#3b82f6' : 'transparent',
              fillOpacity: isSelected ? 0.6 : 0.35,
            };
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const name = feature.properties.COMUNA;
            layer.bindTooltip(`<div class="comuna-tooltip">${name}</div>`, {
              sticky: true,
              direction: 'center',
              className: 'comuna-label'
            });

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

  // ── Auto-pan to selected comuna ──────────────────────────────────────────
  useEffect(() => {
    if (isReady && mapInstanceRef.current && selectedComuna) {
      mapInstanceRef.current.flyTo([selectedComuna.lat, selectedComuna.lng], 13, {
        animate: true,
        duration: 1.5
      });
    }
  }, [isReady, selectedComuna]);

  // ── Simulation Logic ────────────────────────────────────────────────────────
  const animate = useCallback((time: number) => {
    if (!simActiveRef.current || isPausedRef.current) return;

    const elapsedWall = time - simStartRef.current; // Real time since start
    const simMinutes = elapsedWall / 100; // 1 second real = 10 minutes sim

    // 1. Spawn logic
    const intervalMs = (60 / flowPerHour) * 100;
    if (time - lastSpawnRef.current > intervalMs) {
      if (routeSegsRef.current) {
        const cat = Math.random() < (pctCat1 / 100) ? 1 : 2;
        const speed = (90 + Math.random() * 20) / 60; // 90-110 km/h to km/min
        const pathCoords: L.LatLng[] = [];
        routeSegsRef.current.segments.forEach(s => pathCoords.push(s.p1));
        const last = routeSegsRef.current.segments[routeSegsRef.current.segments.length - 1];
        if (last) pathCoords.push(last.p2);

        const marker = L.marker(pathCoords[0], {
          icon: L.divIcon({
            className: 'vehicle-icon',
            html: `<div style="transform: rotate(0deg); transition: transform 0.2s;">
              ${cat === 1
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42.99L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM5 13h14v5H5v-5zm11.5 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM7.5 17c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>'
                : '<svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-3.5-6H5V6h11v6.5z"/></svg>'
              }
            </div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(vehicleLayerRef.current!);

        vehiclesRef.current.push({
          id: vehicleIdRef.current++,
          marker,
          path: pathCoords,
          totalDist: routeSegsRef.current.totalDist,
          currentDist: 0,
          speed,
          porticosPassed: new Set(),
          startTime: time,
          category: cat as 1 | 2,
          color: cat === 1 ? '#3b82f6' : '#f59e0b'
        });
        accVehRef.current++;
        lastSpawnRef.current = time;
      }
    }

    // 2. Move logic
    const activeVehicles: Vehicle[] = [];
    const now = time;

    vehiclesRef.current.forEach(v => {
      const dt = 16.67; // Assuming 60fps
      const simDt = dt / 100;
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
            if (v.category === 2) price *= 2.5; // Commercial multiplier

            accRevenueRef.current += price;

            // Money burst animation
            const point = mapInstanceRef.current!.latLngToContainerPoint(p);
            const burst = document.createElement('div');
            burst.className = 'money-burst';
            burst.innerText = `+$${Math.round(price)}`;
            burst.style.left = `${point.x}px`;
            burst.style.top = `${point.y}px`;
            burst.style.color = v.color;
            mapRef.current!.appendChild(burst);
            moneyBurstsRef.current.push({ id: Date.now() + Math.random(), el: burst, startTime: now });
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
  }, [flowPerHour, pctCat1, onSimTick]);

  useEffect(() => {
    if (simActive && routeGeometry) {
      const segs = routeSegments(routeGeometry);
      routeSegsRef.current = segs;

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

      accRevenueRef.current = 0;
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
    <div className="relative w-full h-full bg-black">
      <div ref={mapRef} className="absolute inset-0 z-0 bg-black" />

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
