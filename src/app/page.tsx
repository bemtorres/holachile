'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import autopistas, { allPorticos } from '@/data';
import Sidebar from '@/components/Sidebar';
import PorticoList from '@/components/PorticoList';
import type { Portico } from '@/data';
import * as turf from '@turf/turf';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function HomePage() {
  const [selectedAutopista, setSelectedAutopista] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lista' | 'tags' | 'ruta'>('ruta');
  const [selectedPortico, setSelectedPortico] = useState<Portico | null>(null);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);

  // --- Start Route Calculator State ---
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [pickingMode, setPickingMode] = useState<'origin' | 'destination' | null>(null);
  const [vehicleType, setVehicleType] = useState('gasolina');
  const [routeAlternatives, setRouteAlternatives] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);
  const [routePorticos, setRoutePorticos] = useState<Portico[]>([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState(0);
  const [fuelCost, setFuelCost] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  // --- End Route Calculator State ---

  const handlePorticoClick = useCallback((p: Portico) => {
    setSelectedPortico(p);
    setActiveTab('tags');
  }, []);

  const currentAutopista = autopistas.find((a) => a.autopista === selectedAutopista);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (pickingMode === 'origin') {
      setOrigin([lat, lng]);
      setPickingMode(null);
    } else if (pickingMode === 'destination') {
      setDestination([lat, lng]);
      setPickingMode(null);
    }
  }, [pickingMode]);

  const requestGeolocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setOrigin([pos.coords.latitude, pos.coords.longitude]),
        (err) => alert('No se pudo obtener la ubicación: ' + err.message)
      );
    } else {
      alert('Geolocalización no soportada en este navegador.');
    }
  };

  const calculateRoute = async () => {
    if (!origin || !destination) return;
    setIsCalculating(true);
    try {
      // Usar OSRM public API con alternatives
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&alternatives=3`);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        setRouteAlternatives(data.routes);
        setSelectedRouteIndex(0);
      } else {
        alert('No se encontraron rutas.');
      }
    } catch (e) {
      alert('Error calculando ruta');
    } finally {
      setIsCalculating(false);
    }
  };

  // Calculate stats for the selected alternative
  useEffect(() => {
    if (routeAlternatives.length > 0 && routeAlternatives[selectedRouteIndex]) {
      const route = routeAlternatives[selectedRouteIndex];
      const geometry = route.geometry as GeoJSON.LineString;

      setRouteGeometry(geometry);
      const distance = route.distance / 1000;
      setRouteDistanceKm(distance);

      let costPerKm = 0;
      switch (vehicleType) {
        case 'gasolina': costPerKm = 108; break; // ~12 km/l a $1300/l
        case 'diesel': costPerKm = 70; break;    // ~15 km/l a $1050/l
        case 'hibrido': costPerKm = 59; break;   // ~22 km/l a $1300/l
        case 'electrico': costPerKm = 25; break; // ~6 km/kWh a $150/kWh
      }
      setFuelCost(distance * costPerKm);

      // Find intersecting porticos using Turf.js
      const routeLine = turf.lineString(geometry.coordinates);

      const found = allPorticos.filter(p => {
        const pt = turf.point([p.lng, p.lat]);
        const distanceBytes = turf.pointToLineDistance(pt, routeLine, { units: 'meters' });
        // Si está a menos de 50 metros de la ruta, asume que pasó por él
        return distanceBytes < 50;
      });

      setRoutePorticos(found);
    } else {
      setRouteGeometry(null);
      setRouteDistanceKm(0);
      setRoutePorticos([]);
    }
  }, [routeAlternatives, selectedRouteIndex, vehicleType]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-700/50 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">TAG Chile — Pórticos de Peaje</h1>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">highway=toll_gantry · OpenStreetMap</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedAutopista && (
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{
                backgroundColor: `${currentAutopista?.color}15`,
                borderColor: `${currentAutopista?.color}40`,
                color: currentAutopista?.color,
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentAutopista?.color }} />
              {selectedAutopista}
            </div>
          )}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700/50 rounded-lg px-2.5 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300">{allPorticos.length} pórticos</span>
          </div>
          <button
            className="sm:hidden flex items-center gap-1.5 bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-300"
            onClick={() => setIsMobileListOpen(!isMobileListOpen)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Filtros
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — autopista selector */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 bg-slate-900/70 border-r border-slate-700/50 overflow-hidden shrink-0">
          <Sidebar
            autopistas={autopistas}
            selectedAutopista={selectedAutopista}
            onSelectAutopista={setSelectedAutopista}
            totalPorticos={allPorticos.length}
          />
        </aside>

        {/* Map */}
        <main className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 p-2">
            <MapView
              porticos={activeTab === 'ruta' ? routePorticos : allPorticos}
              selectedAutopista={selectedAutopista}
              onPorticoClick={handlePorticoClick}
              onMapClick={handleMapClick}
              origin={origin}
              destination={destination}
              routeGeometry={routeGeometry}
            />
          </div>

          {/* Map overlay info */}
          {selectedAutopista && currentAutopista && (
            <div
              className="absolute top-4 left-4 z-10 rounded-xl border px-4 py-3 backdrop-blur-sm"
              style={{
                backgroundColor: `${currentAutopista.color}18`,
                borderColor: `${currentAutopista.color}40`,
              }}
            >
              <div className="text-xs font-semibold" style={{ color: currentAutopista.color }}>
                {currentAutopista.autopista}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {currentAutopista.totalPorticos} pórticos · {currentAutopista.concesionario}
              </div>
            </div>
          )}

          <button
            className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-2"
            onClick={() => setSelectedAutopista(null)}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Ver todas
          </button>
        </main>

        {/* Right panel — pórtico list */}
        <aside className="hidden md:flex flex-col w-72 xl:w-80 bg-slate-900/70 border-l border-slate-700/50 overflow-hidden shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50 shrink-0">
            <button
              className={`flex-1 py-3 text-xs font-medium transition-colors ${activeTab === 'lista' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => setActiveTab('lista')}
            >
              Lista
            </button>
            <button
              className={`flex-1 py-3 text-xs font-medium transition-colors ${activeTab === 'ruta' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => setActiveTab('ruta')}
            >
              Calculadora
            </button>
            <button
              className={`flex-1 py-3 text-xs font-medium transition-colors ${activeTab === 'tags' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => setActiveTab('tags')}
            >
              OSM Tags
            </button>
          </div>

          {activeTab === 'ruta' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 flex flex-col gap-4">
                <h2 className="text-sm font-bold text-white mb-2">Calculadora de Viaje</h2>

                {/* Origen */}
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Punto de Origen</label>
                  <div className="flex gap-2">
                    <button
                      onClick={requestGeolocation}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition"
                    >
                      <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                      Mi ubicación
                    </button>
                    <button
                      onClick={() => setPickingMode('origin')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs transition ${pickingMode === 'origin' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                    >
                      {origin ? 'Cambiar en mapa' : 'Elegir en mapa'}
                    </button>
                  </div>
                  {origin && <div className="text-[10px] text-emerald-400 mt-1 font-mono">Seleccionado: {origin[0].toFixed(4)}, {origin[1].toFixed(4)}</div>}
                </div>

                {/* Destino */}
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Destino</label>
                  <button
                    onClick={() => setPickingMode('destination')}
                    className={`w-full px-3 py-2 rounded-lg text-xs transition border border-dashed ${pickingMode === 'destination' ? 'border-red-500 bg-red-500/20 text-white' : 'border-slate-600 hover:border-slate-500 text-slate-300'}`}
                  >
                    {destination ? 'Cambiar destino en mapa' : '📍 Marcar destino en mapa'}
                  </button>
                  {destination && <div className="text-[10px] text-red-400 mt-1 font-mono">Seleccionado: {destination[0].toFixed(4)}, {destination[1].toFixed(4)}</div>}
                </div>

                {/* Tipo de Vehículo */}
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo de Vehículo</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="gasolina">Auto Bencinero (Gasolina)</option>
                    <option value="diesel">Auto Petrolero (Diésel)</option>
                    <option value="hibrido">Auto Híbrido</option>
                    <option value="electrico">Auto Eléctrico</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    onClick={calculateRoute}
                    disabled={!origin || !destination || isCalculating}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition"
                  >
                    {isCalculating ? 'Calculando...' : 'Calcular Ruta y Peajes'}
                  </button>
                </div>
              </div>

              {/* Resultados */}
              {routeAlternatives.length > 0 && routeGeometry && (
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 flex flex-col gap-3">

                  {routeAlternatives.length > 1 && (
                    <div className="flex bg-slate-900 rounded-lg p-1 gap-1 mb-2">
                      {routeAlternatives.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedRouteIndex(i)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${selectedRouteIndex === i ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                        >
                          Ruta {i + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-400">Distancia</div>
                      <div className="text-xl font-bold text-white">{routeDistanceKm.toFixed(1)} <span className="text-sm font-normal text-slate-400">km</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Costo de energía</div>
                      <div className="text-xl font-bold text-emerald-400">${Math.round(fuelCost).toLocaleString('es-CL')} <span className="text-sm font-normal text-slate-400">CLP</span></div>
                    </div>
                  </div>
                  <div className="mt-1">
                    <div className="text-xs text-slate-400">TAGs/Peajes interceptados</div>
                    <div className="text-xl font-bold text-blue-400">{routePorticos.length} <span className="text-sm font-normal text-slate-400">detectados</span></div>
                  </div>

                  {routePorticos.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Desglose de Ruta</div>
                      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {routePorticos.map((p, i) => (
                          <div key={p.id + '-' + i} className="flex flex-col bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/30 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-slate-200">{p.nombre}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: `${p.color}20`, color: p.color }}>{p.autopista}</span>
                            </div>
                            {(p.salida || p.sentido) && (
                              <div className="text-slate-500 text-[10px] mt-1">
                                {[p.sentido, p.salida].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'lista' && (
            <PorticoList
              porticos={allPorticos}
              selectedAutopista={selectedAutopista}
              onPorticoClick={handlePorticoClick}
            />
          )}

          {activeTab === 'tags' && selectedPortico && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedPortico.color }} />
                <h2 className="text-sm font-bold text-white leading-snug">{selectedPortico.nombre}</h2>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">Información</div>
                  <div className="space-y-1.5">
                    <InfoRow label="Autopista" value={selectedPortico.autopista} color={selectedPortico.color} />
                    <InfoRow label="Tramo" value={selectedPortico.tramo} />
                    <InfoRow label="Kilómetro" value={`${selectedPortico.km} km`} />
                    {selectedPortico.sentido && <InfoRow label="Sentido" value={selectedPortico.sentido} />}
                    {selectedPortico.salida && <InfoRow label="Salida" value={selectedPortico.salida} />}
                    {selectedPortico.comuna && <InfoRow label="Comuna" value={selectedPortico.comuna} />}
                    <InfoRow label="Latitud" value={selectedPortico.lat.toFixed(6)} mono />
                    <InfoRow label="Longitud" value={selectedPortico.lng.toFixed(6)} mono />
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">Tags OSM</div>
                  <div className="space-y-1.5">
                    {Object.entries(selectedPortico.tags).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 text-xs">
                        <span className="text-slate-500 font-mono">{k}</span>
                        <span className={`font-mono ${v === 'yes' ? 'text-emerald-400' : v === 'no' ? 'text-red-400' : 'text-slate-300'}`}>
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">ID OSM</div>
                  <code className="text-xs text-blue-400 font-mono">{selectedPortico.id}</code>
                </div>

                <a
                  href={`https://www.openstreetmap.org/?mlat=${selectedPortico.lat}&mlon=${selectedPortico.lng}&zoom=17`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ver en OpenStreetMap
                </a>
              </div>
            </div>
          )}

          {activeTab === 'tags' && !selectedPortico && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600 p-6 text-center">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <p className="text-sm">Haz clic en un pórtico<br />en el mapa o la lista</p>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile bottom sheet */}
      {isMobileListOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsMobileListOpen(false)} />
          <div className="relative bg-slate-900 rounded-t-2xl border-t border-slate-700/50 h-2/3 flex flex-col z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <h2 className="text-sm font-semibold text-white">Autopistas y Pórticos</h2>
              <button onClick={() => setIsMobileListOpen(false)} className="text-slate-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                autopistas={autopistas}
                selectedAutopista={selectedAutopista}
                onSelectAutopista={(a) => { setSelectedAutopista(a); setIsMobileListOpen(false); }}
                totalPorticos={allPorticos.length}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`${color ? 'font-semibold' : 'text-slate-300'} ${mono ? 'font-mono' : ''}`} style={color ? { color } : {}}>
        {value}
      </span>
    </div>
  );
}
