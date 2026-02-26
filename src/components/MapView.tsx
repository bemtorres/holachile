'use client';

import { useEffect, useRef, useState } from 'react';
import type { Portico } from '@/data';

type MapProps = {
  porticos: Portico[];
  selectedAutopista?: string | null;
  onPorticoClick?: (portico: Portico) => void;
  onMapClick?: (lat: number, lng: number) => void;
  routeGeometry?: GeoJSON.LineString | null;
  origin?: [number, number] | null;
  destination?: [number, number] | null;
};

export default function MapView({
  porticos,
  selectedAutopista,
  onPorticoClick,
  onMapClick,
  routeGeometry,
  origin,
  destination
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').CircleMarker[]>([]);
  const routeLayerRef = useRef<import('leaflet').GeoJSON | null>(null);
  const originMarkerRef = useRef<import('leaflet').CircleMarker | null>(null);
  const destMarkerRef = useRef<import('leaflet').CircleMarker | null>(null);
  const [isReady, setIsReady] = useState(false);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (!mapRef.current) return;

      const container = L.DomUtil.get(mapRef.current);
      if (container != null) {
        (container as any)._leaflet_id = null;
      }

      const map = L.map(mapRef.current, {
        center: [-33.45, -70.65],
        zoom: 11,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);

      map.on('click', (e: any) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      setIsReady(true);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) return;
    const initMarkers = async () => {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current!;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const filtered = selectedAutopista
        ? porticos.filter((p) => p.autopista === selectedAutopista)
        : porticos;

      filtered.forEach((p) => {
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 8,
          fillColor: p.color,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        });

        const sentidoLabel = p.sentido ? `<br/><span style="color:#94a3b8">Sentido:</span> ${p.sentido}` : '';
        const salidaLabel = p.salida ? `<br/><span style="color:#94a3b8">Salida:</span> ${p.salida}` : '';
        const comunaLabel = p.comuna ? `<br/><span style="color:#94a3b8">Comuna:</span> ${p.comuna}` : '';

        marker.bindPopup(`
          <div style="font-family: 'Inter', sans-serif; min-width: 220px; color: #e2e8f0; background: #1e293b; border-radius: 8px; padding: 4px;">
            <div style="font-size: 13px; font-weight: 700; color: ${p.color}; margin-bottom: 6px;">${p.nombre}</div>
            <div style="font-size: 11px; line-height: 1.6;">
              <span style="color:#94a3b8">Autopista:</span> ${p.autopista}<br/>
              <span style="color:#94a3b8">Tramo:</span> ${p.tramo}<br/>
              <span style="color:#94a3b8">Km:</span> ${p.km}${sentidoLabel}${salidaLabel}${comunaLabel}
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155; font-size: 10px; color: #64748b; font-family: monospace;">
              OSM: ${p.id}
            </div>
          </div>
        `, {
          className: 'dark-popup',
        });

        marker.on('click', () => {
          onPorticoClick?.(p);
        });

        marker.addTo(map);
        markersRef.current.push(marker);
      });

      if (filtered.length > 0 && selectedAutopista) {
        const bounds = L.latLngBounds(filtered.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [60, 60] });
      }
    };

    initMarkers();
  }, [isReady, porticos, selectedAutopista, onPorticoClick]);

  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) return;
    const updateRoute = async () => {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current!;

      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }

      if (routeGeometry) {
        routeLayerRef.current = L.geoJSON(routeGeometry, {
          style: {
            color: '#3b82f6',
            weight: 6,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round'
          }
        }).addTo(map);
        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });
      }

      if (origin) {
        originMarkerRef.current = L.circleMarker(origin, {
          radius: 8, fillColor: '#22c55e', color: '#fff', weight: 3, opacity: 1, fillOpacity: 1
        }).addTo(map);
      }

      if (destination) {
        destMarkerRef.current = L.circleMarker(destination, {
          radius: 8, fillColor: '#ef4444', color: '#fff', weight: 3, opacity: 1, fillOpacity: 1
        }).addTo(map);
      }
    };

    updateRoute();
  }, [isReady, routeGeometry, origin, destination]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-xl" />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 rounded-xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">Cargando mapa OSM...</span>
          </div>
        </div>
      )}
    </div>
  );
}
