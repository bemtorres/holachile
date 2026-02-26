'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import autopistas, { allPorticos } from '@/data';
import Sidebar from '@/components/Sidebar';
import PorticoList from '@/components/PorticoList';
import SimulationTab, { type SimParams } from '@/components/SimulationTab';
import ComunaCard from '@/components/ComunaCard';
import type { Portico } from '@/data';
import * as turf from '@turf/turf';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function HomePage() {
  const [selectedAutopista, setSelectedAutopista] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lista' | 'tags' | 'ruta' | 'simulacion'>('ruta');
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

  // --- Simulation State ---
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [simCompleted, setSimCompleted] = useState(false);
  const [simParams, setSimParams] = useState<SimParams | null>(null);
  const [liveVehicles, setLiveVehicles] = useState(0);
  const [liveRevenue, setLiveRevenue] = useState(0);
  const [liveMinutes, setLiveMinutes] = useState(0);
  // --- End Simulation State ---

  // --- Map Layer State ---
  const [showComunas, setShowComunas] = useState(false);
  // --- End Map Layer State ---

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

      const routeLine = turf.lineString(geometry.coordinates);

      const found = allPorticos.filter(p => {
        const pt = turf.point([p.lng, p.lat]);
        const distanceBytes = turf.pointToLineDistance(pt, routeLine, { units: 'meters' });
        return distanceBytes < 50;
      });

      setRoutePorticos(found);
    } else {
      setRouteGeometry(null);
      setRouteDistanceKm(0);
      setRoutePorticos([]);
    }
  }, [routeAlternatives, selectedRouteIndex, vehicleType]);

  // --- Simulation handlers ---
  const handleSimStart = useCallback((params: SimParams) => {
    setSimParams(params);
    setLiveVehicles(0);
    setLiveRevenue(0);
    setLiveMinutes(0);
    setSimCompleted(false);
    setIsPaused(false);
    setIsSimulating(true);
  }, []);

  const handleSimPause = useCallback(() => setIsPaused(true), []);
  const handleSimResume = useCallback(() => setIsPaused(false), []);

  const handleSimReset = useCallback(() => {
    setIsSimulating(false);
    setIsPaused(false);
    setSimCompleted(false);
    setLiveVehicles(0);
    setLiveRevenue(0);
    setLiveMinutes(0);
    setSimParams(null);
  }, []);

  const handleSimTick = useCallback((vehicles: number, revenue: number, minutes: number) => {
    setLiveVehicles(vehicles);
    setLiveRevenue(revenue);
    setLiveMinutes(minutes);
  }, []);

  const handleSimComplete = useCallback(() => {
    setIsSimulating(false);
    setSimCompleted(true);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden font-sans text-zinc-50">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-zinc-950 border-b border-zinc-800 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-zinc-100 flex items-center justify-center shrink-0 shadow-sm shadow-white/10">
            <span className="text-zinc-950 font-semibold text-lg">T</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100 leading-none">TAG Chile</h1>
            <p className="text-xs text-zinc-400 mt-1">Plataforma de Consulta</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedAutopista && (
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-zinc-800 rounded-md text-xs font-medium bg-zinc-900/50 shadow-sm"
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentAutopista?.color || '#fff' }} />
              {selectedAutopista}
            </div>
          )}
          <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 rounded-md shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-xs text-zinc-300 font-medium">{allPorticos.length} Nodos</span>
          </div>
          <button
            className="sm:hidden flex items-center gap-2 border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 rounded-md"
            onClick={() => setIsMobileListOpen(!isMobileListOpen)}
          >
            Filtros
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — autopista selector */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 bg-zinc-950 border-r border-zinc-800 overflow-hidden shrink-0 z-10 shadow-lg">
          <Sidebar
            autopistas={autopistas}
            selectedAutopista={selectedAutopista}
            onSelectAutopista={setSelectedAutopista}
            totalPorticos={allPorticos.length}
          />
        </aside>

        {/* Map */}
        <main className="flex-1 relative overflow-hidden bg-zinc-950">
          <div className="absolute inset-0">
            <MapView
              porticos={activeTab === 'ruta' || activeTab === 'simulacion' ? routePorticos : allPorticos}
              selectedAutopista={selectedAutopista}
              onPorticoClick={handlePorticoClick}
              onMapClick={handleMapClick}
              origin={origin}
              destination={destination}
              routeGeometry={routeGeometry}
              simActive={isSimulating}
              simPaused={isPaused}
              flowPerHour={simParams?.flowPerHour ?? 1500}
              pctCat1={simParams?.pctCat1 ?? 70}
              pctCat2={simParams?.pctCat2 ?? 20}
              routePorticos={routePorticos}
              timeProfile={simParams?.timeProfile ?? 'punta'}
              showComunas={showComunas}
              onComunaClick={(nombre) => {
                // optionally switch to a portico with that commune
                const found = allPorticos.find(p => p.comuna?.toLowerCase() === nombre.toLowerCase());
                if (found) { setSelectedPortico(found); setActiveTab('tags'); }
              }}
              onSimTick={handleSimTick}
              onSimComplete={handleSimComplete}
            />
          </div>

          {/* ── Comunas toggle ── */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto">
            <button
              id="toggle-comunas"
              onClick={() => setShowComunas(v => !v)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xl border transition-all duration-200
                ${showComunas
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-900/40'
                  : 'bg-zinc-900/90 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`
              }
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5Z" />
              </svg>
              Comunas RM
              {showComunas && (
                <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Map overlay info */}
          {selectedAutopista && currentAutopista && (
            <div className="absolute top-6 left-6 z-50 rounded-lg border border-zinc-800 p-4 bg-zinc-950/90 backdrop-blur-md shadow-lg pointer-events-none">
              <div className="text-sm font-semibold flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentAutopista.color || '#fff' }} />
                <span>{currentAutopista.autopista}</span>
              </div>
              <div className="text-xs text-zinc-400 mt-1 font-medium ml-5">
                {currentAutopista.totalPorticos} pórticos activos
              </div>
            </div>
          )}

          {selectedAutopista && (
            <button
              className="absolute bottom-6 left-6 z-50 bg-white hover:bg-zinc-200 text-black px-4 py-2.5 rounded-md text-sm font-medium transition-colors shadow-lg border border-zinc-200"
              onClick={() => setSelectedAutopista(null)}
            >
              Reiniciar Vista
            </button>
          )}
        </main>

        {/* Right panel — pórtico list */}
        <aside className="hidden md:flex flex-col w-80 xl:w-96 bg-zinc-950 border-l border-zinc-800 overflow-hidden shrink-0 z-10 shadow-xl">
          {/* Tabs - shadcn style */}
          <div className="p-3 border-b border-zinc-800 shrink-0 bg-zinc-950/50">
            <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-md">
              <button
                className={`flex-1 py-1.5 px-3 rounded-sm text-sm font-medium transition-all ${activeTab === 'lista' ? 'bg-zinc-800 text-zinc-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'}`}
                onClick={() => setActiveTab('lista')}
              >
                Lista
              </button>
              <button
                className={`flex-1 py-1.5 px-2 rounded-sm text-xs font-medium transition-all ${activeTab === 'ruta' ? 'bg-zinc-800 text-zinc-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'}`}
                onClick={() => setActiveTab('ruta')}
              >
                Ruta
              </button>
              <button
                className={`flex-1 py-1.5 px-2 rounded-sm text-xs font-medium transition-all ${activeTab === 'simulacion' ? 'bg-zinc-800 text-purple-400 shadow-sm' : 'text-zinc-400 hover:text-purple-300 hover:bg-zinc-800/50'}`}
                onClick={() => setActiveTab('simulacion')}
              >
                Simulación
              </button>
              <button
                className={`flex-1 py-1.5 px-2 rounded-sm text-xs font-medium transition-all ${activeTab === 'tags' ? 'bg-zinc-800 text-zinc-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'}`}
                onClick={() => setActiveTab('tags')}
              >
                Detalles
              </button>
            </div>
          </div>

          {activeTab === 'ruta' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar bg-zinc-950 cursor-default">
              <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 shadow-sm flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Calculadora de Ruta
                </h2>

                {/* Origen */}
                <div className="space-y-2 relative pt-2">
                  <label className="text-xs text-zinc-400 font-medium">Sitio de Origen</label>
                  <div className="flex gap-2">
                    <button
                      onClick={requestGeolocation}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md px-3 py-2 text-xs font-medium transition-colors text-zinc-300"
                    >
                      GPS
                    </button>
                    <button
                      onClick={() => setPickingMode('origin')}
                      className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors border ${pickingMode === 'origin' ? 'bg-blue-600/20 text-blue-400 border-blue-600/50' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900 text-zinc-300'}`}
                    >
                      {origin ? 'Cambiar Origen' : '🗺️ Elegir en Mapa'}
                    </button>
                  </div>
                  {origin && <div className="text-xs text-zinc-500 font-mono">LAT {origin[0].toFixed(4)}, LNG {origin[1].toFixed(4)}</div>}
                </div>

                {/* Destino */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-medium">Destino</label>
                  <button
                    onClick={() => setPickingMode('destination')}
                    className={`w-full rounded-md px-3 py-2 text-xs font-medium transition-colors border ${pickingMode === 'destination' ? 'bg-red-600/20 text-red-400 border-red-600/50' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900 text-zinc-300'}`}
                  >
                    {destination ? 'Cambiar Destino' : '📍 Marcar Destino'}
                  </button>
                  {destination && <div className="text-xs text-zinc-500 font-mono">LAT {destination[0].toFixed(4)}, LNG {destination[1].toFixed(4)}</div>}
                </div>

                {/* Tipo de Vehículo */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-medium">Tipo de Vehículo</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-medium text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition appearance-none"
                  >
                    <option value="gasolina">Combustión (Gasolina)</option>
                    <option value="diesel">Combustión (Diésel)</option>
                    <option value="hibrido">Híbrido</option>
                    <option value="electrico">Eléctrico</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    onClick={calculateRoute}
                    disabled={!origin || !destination || isCalculating}
                    className="w-full bg-white hover:bg-zinc-200 disabled:bg-zinc-900 disabled:text-zinc-500 disabled:border-zinc-800 border-transparent rounded-md text-zinc-900 font-semibold py-2.5 text-sm transition-colors shadow-sm disabled:shadow-none pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                  >
                    {isCalculating ? (
                      <span className="animate-pulse">Calculando...</span>
                    ) : (
                      'Trazar Ruta'
                    )}
                  </button>
                </div>
              </div>

              {/* Resultados */}
              {routeAlternatives.length > 0 && routeGeometry && (
                <div className="bg-zinc-950 rounded-lg p-5 border border-zinc-800 shadow-sm flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                  {routeAlternatives.length > 1 && (
                    <div className="flex bg-zinc-900 rounded-md p-1 gap-1">
                      {routeAlternatives.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedRouteIndex(i)}
                          className={`flex-1 py-1.5 rounded-sm text-xs font-medium transition-colors ${selectedRouteIndex === i ? 'bg-zinc-800 text-zinc-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'}`}
                        >
                          Ruta {i + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-zinc-800 rounded-md p-3 bg-zinc-900/40">
                      <div className="text-xs text-zinc-500 font-medium mb-1">Distancia</div>
                      <div className="text-2xl font-semibold text-zinc-100">{routeDistanceKm.toFixed(1)} <span className="text-xs font-medium text-zinc-500">km</span></div>
                    </div>
                    <div className="border border-zinc-800 rounded-md p-3 bg-zinc-900/40">
                      <div className="text-xs text-zinc-500 font-medium mb-1">Costo Combustible</div>
                      <div className="text-2xl font-semibold text-zinc-100">${Math.round(fuelCost).toLocaleString('es-CL')} <span className="text-xs font-medium text-zinc-500">CLP</span></div>
                    </div>
                  </div>

                  <div className="border border-zinc-800 rounded-md p-3 bg-zinc-900/40 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-zinc-500 font-medium mb-1">Peajes Intersectados</div>
                      <div className="text-2xl font-semibold text-zinc-100">{routePorticos.length} <span className="text-xs font-medium text-zinc-500">nodos</span></div>
                    </div>
                  </div>

                  {routePorticos.length > 0 && (
                    <div className="border-t border-zinc-800 pt-4 mt-2">
                      <div className="text-xs font-semibold text-zinc-400 mb-3 flex items-center justify-between">
                        <span>DETALLE DE PÓRTICOS</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div className="flex flex-col gap-2 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar">
                        {routePorticos.map((p, i) => (
                          <div key={p.id + '-' + i} className="flex flex-col bg-zinc-950 p-3 rounded-md border border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700 transition-colors cursor-pointer group" onClick={() => handlePorticoClick(p)}>
                            <div className="flex items-start justify-between gap-3">
                              <span className="font-medium text-sm text-zinc-200 group-hover:text-white transition-colors leading-tight">{p.nombre}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-800 whitespace-nowrap bg-zinc-950 text-zinc-300 font-medium flex items-center gap-1.5" style={{ borderColor: p.color ? `${p.color}40` : '#333' }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || '#fff' }} />
                                {p.autopista}
                              </span>
                            </div>
                            {(p.salida || p.sentido) && (
                              <div className="text-zinc-500 text-xs mt-2 font-medium">
                                {[p.sentido, p.salida].filter(Boolean).join(' • ')}
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
            <div className="py-2">
              <PorticoList
                porticos={allPorticos}
                selectedAutopista={selectedAutopista}
                onPorticoClick={handlePorticoClick}
              />
            </div>
          )}

          {activeTab === 'tags' && selectedPortico && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-zinc-950 cursor-default">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: selectedPortico.color || '#fff' }} />
                <h2 className="text-lg font-semibold text-zinc-50 leading-tight">{selectedPortico.nombre}</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800/80">
                    <span className="text-xs font-semibold text-zinc-400">Detalles Geográficos</span>
                  </div>
                  <div className="space-y-3">
                    <InfoRow label="Autopista" value={selectedPortico.autopista} color={selectedPortico.color} />
                    <InfoRow label="Tramo" value={selectedPortico.tramo} />
                    <InfoRow label="Kilómetro" value={`KM ${selectedPortico.km}`} />
                    {selectedPortico.sentido && <InfoRow label="Sentido" value={selectedPortico.sentido} />}
                    {selectedPortico.salida && <InfoRow label="Salida" value={selectedPortico.salida} />}
                    {selectedPortico.comuna && <InfoRow label="Comuna" value={selectedPortico.comuna} />}
                    <div className="pt-3 mt-3 border-t border-zinc-800/80 space-y-3">
                      <InfoRow label="Latitud" value={selectedPortico.lat.toFixed(6)} mono />
                      <InfoRow label="Longitud" value={selectedPortico.lng.toFixed(6)} mono />
                    </div>
                  </div>
                </div>

                {/* Estructura Tarifaria Extraída */}
                {(selectedPortico.precio || selectedPortico.tarifas_urbanas) && (
                  <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800/80">
                      <span className="text-xs font-semibold text-zinc-400">Cuadro Tarifario Extraído (CLP)</span>
                    </div>

                    {selectedPortico.precio && !selectedPortico.tarifas_urbanas && (
                      <InfoRow label="Tarifa Estándar Base" value={`$${selectedPortico.precio.toLocaleString('es-CL')}`} color="#22c55e" />
                    )}

                    {selectedPortico.tarifas_urbanas && (
                      <div className="space-y-4">
                        {Object.entries(selectedPortico.tarifas_urbanas).map(([k, v]) => {
                          if (typeof v === 'object' && v !== null) {
                            return (
                              <div key={k} className="border-t border-zinc-800 pt-3 mt-3 first:mt-0 first:border-0 first:pt-0">
                                <div className="text-xs text-blue-400 font-medium mb-3 capitalize">{k.replace(/_/g, ' ')}</div>
                                <div className="space-y-2.5">
                                  {Object.entries(v).map(([sk, sv]) => (
                                    <div key={sk} className="flex justify-between items-center text-sm">
                                      <span className="text-zinc-400 capitalize block truncate pr-4 text-xs" title={sk}>{sk.replace(/_/g, ' ')}</span>
                                      <span className="text-zinc-50 font-medium bg-zinc-900 rounded-md px-2 py-1 border border-zinc-800 shadow-sm">${Number(sv).toLocaleString('es-CL')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <InfoRow key={k} label={k.replace(/_/g, ' ')} value={`$${Number(v).toLocaleString('es-CL')}`} mono />
                          );
                        })}

                        {/* Category Legend */}
                        {JSON.stringify(selectedPortico.tarifas_urbanas).includes('categoria') && (
                          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-3.5 mt-5 text-xs text-zinc-400 leading-relaxed font-sans shadow-sm">
                            <span className="text-zinc-200 font-semibold block mb-2">Clasificación Vehicular</span>
                            <span className="text-zinc-300 font-medium block mt-1">Categoría 1 / 1_4:</span> Motos, Autos y Camionetas. (Tarifa Base Liviana) 🚗
                            <span className="text-zinc-300 font-medium block mt-3">Categoría 2:</span> Buses y Camiones de 2 ejes. (Recargo por dimensiones y peso) 🚍
                            <span className="text-zinc-300 font-medium block mt-3">Categoría 3:</span> Camiones con remolque o +2 ejes. (Máximo recargo por desgaste de pavimento) 🚛
                          </div>
                        )}
                        {/* Time Legend */}
                        {JSON.stringify(selectedPortico.tarifas_urbanas).includes('TBP') && (
                          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-3.5 mt-3 text-xs text-zinc-400 leading-relaxed shadow-sm">
                            <span className="text-zinc-200 font-semibold block mb-2">Multiplicadores y Horarios</span>
                            <span className="text-emerald-400 block mt-1"><strong className="text-zinc-300">TBFP:</strong> Tarifa Base / Normal. 🟢</span>
                            <span className="text-yellow-500 block mt-1.5"><strong className="text-zinc-300">TBP:</strong> Tarifa Punta / Alta congestión. 🟡</span>
                            <span className="text-red-400 block mt-1.5"><strong className="text-zinc-300">TS:</strong> Tarifa Saturación / Demanda límite. 🔴</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* ── FICHA DE LA COMUNA (Wikipedia) ── */}
                {selectedPortico.comuna && (
                  <ComunaCard comuna={selectedPortico.comuna} />
                )}

              </div>
            </div>
          )}

          {activeTab === 'simulacion' && (
            <SimulationTab
              routePorticos={routePorticos}
              routeDistanceKm={routeDistanceKm}
              origin={origin}
              destination={destination}
              pickingMode={pickingMode}
              setPickingMode={setPickingMode}
              calculateRoute={calculateRoute}
              isCalculating={isCalculating}
              requestGeolocation={requestGeolocation}
              onStart={handleSimStart}
              onPause={handleSimPause}
              onResume={handleSimResume}
              onReset={handleSimReset}
              isSimulating={isSimulating}
              isPaused={isPaused}
              simCompleted={simCompleted}
              liveVehicles={liveVehicles}
              liveRevenue={liveRevenue}
              liveMinutes={liveMinutes}
            />
          )}

          {activeTab === 'tags' && !selectedPortico && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center bg-zinc-950">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-500 max-w-xs">Selecciona un marcador en el mapa para analizar su cuadro tarifario completo y datos.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile bottom sheet */}
      {isMobileListOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileListOpen(false)} />
          <div className="relative bg-zinc-950 border-t border-zinc-800 h-[85vh] flex flex-col z-10 shadow-2xl rounded-t-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-100">Filtros de Red</h2>
              <button onClick={() => setIsMobileListOpen(false)} className="text-zinc-500 hover:text-white transition-colors p-2 -mr-2 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-zinc-950">
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
    <div className="flex justify-between gap-4 text-xs items-center">
      <span className="text-zinc-400 font-medium capitalize">{label}</span>
      <span className={`text-right ${color ? 'font-semibold' : 'text-zinc-200'} ${mono ? 'font-mono' : 'font-medium'}`} style={color ? { color } : {}}>
        {value}
      </span>
    </div>
  );
}
