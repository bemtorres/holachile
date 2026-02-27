'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import autopistas, { allPorticos, findComuna, allComunas } from '@/data';
import Sidebar from '@/components/Sidebar';
import PorticoList from '@/components/PorticoList';
import SimulationTab, { type SimParams } from '@/components/SimulationTab';
import ComunasTab from '@/components/ComunasTab';
import ComunaCard from '@/components/ComunaCard';
import { MapPin, Search, ChevronDown, Loader2 } from 'lucide-react';
import type { Portico } from '@/data';
import * as turf from '@turf/turf';
import MatrixCanvas from '@/components/MatrixCanvas';
import MatrixConsole from '@/components/MatrixConsole';
import MatrixCommandTerminal from '@/components/MatrixCommandTerminal';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });


function AppContent() {
  const searchParams = useSearchParams();
  const isOlimpo = searchParams.get('type') === 'olimpo';
  const isMatrix = searchParams.get('type') === 'matrix';

  const InfoRow = ({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) => (
    <div className="flex justify-between gap-4 text-xs items-center">
      <span className={`${isMatrix ? 'matrix-text' : 'text-zinc-400'} font-medium capitalize`}>{label}</span>
      <span className={`text-right ${color ? 'font-semibold' : isMatrix ? 'matrix-text' : 'text-zinc-200'} ${mono || isMatrix ? 'font-mono' : 'font-medium'}`} style={color ? { color } : {}}>
        {isMatrix ? `> ${value}` : value}
      </span>
    </div>
  );

  const [selectedAutopista, setSelectedAutopista] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lista' | 'tags' | 'ruta' | 'simulacion' | 'comunas'>('ruta');
  const [selectedPortico, setSelectedPortico] = useState<Portico | null>(null);
  const [selectedComuna, setSelectedComuna] = useState<any>(null);
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
  const [routeCategory, setRouteCategory] = useState<'cat1' | 'cat2' | 'cat3'>('cat1');
  const [routeTimeProfile, setRouteTimeProfile] = useState<'TBFP' | 'TBP' | 'TS'>('TBP');
  const [totalTollCost, setTotalTollCost] = useState(0);
  // --- End Route Calculator State ---

  // --- End Route Calculator State ---

  // --- Map Layer State ---
  const [showComunas, setShowComunas] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  // --- End Map Layer State ---

  // --- Simulation Integration State ---
  const [simActive, setSimActive] = useState(false);
  const [simParams, setSimParams] = useState<SimParams>({ flowPerHour: 1500, pctCat1: 70, pctCat2: 20, pctCat3: 10, timeProfile: 'punta' });
  const [simStats, setSimStats] = useState({ vehicles: 0, revenue: 0, minutes: 0 });
  const [simCompleted, setSimCompleted] = useState(false);
  // --- End Simulation State ---

  const handleConsoleCommand = useCallback((cmd: string, args: string[], onResult: (data: any) => void) => {
    if (cmd === 'map') {
      const comunaName = args.join(' ').toLowerCase();
      const comuna = findComuna(comunaName);
      if (comuna) {
        setMapCenter([comuna.lat, comuna.lng]);
        setSelectedComuna(comuna);
        setActiveTab('comunas');
        onResult?.({
          nombre: comuna.comuna,
          lat: comuna.lat,
          lng: comuna.lng,
          poblacion: comuna.poblacion || 0,
          provincia: comuna.provincia || '',
          direccion: comuna.direccion_municipal || ''
        });
      }
    }
  }, []);

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
    setRouteAlternatives([]);
    setRouteGeometry(null);
    setRoutePorticos([]);

    // Lista de endpoints para intentar (el público de OSRM falla a veces)
    const endpoints = [
      `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&alternatives=3`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&alternatives=3`
    ];

    let success = false;
    for (const url of endpoints) {
      if (success) break;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
          setRouteAlternatives(data.routes);
          setSelectedRouteIndex(0);
          success = true;
        }
      } catch (e) {
        console.warn(`Error con endpoint ${url}:`, e);
      }
    }

    if (!success) {
      alert('No se pudo calcular la ruta. Es posible que el servicio esté temporalmente fuera de servicio o que los puntos no sean accesibles por carretera.');
    }

    setIsCalculating(false);
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

      let tollSum = 0;
      const found = allPorticos.filter(p => {
        const pt = turf.point([p.lng, p.lat]);
        const distance = turf.pointToLineDistance(pt, routeLine, { units: 'meters' });
        const isNear = distance < 150;

        if (isNear) {
          let price = p.precio || 0;
          if (p.tarifas_urbanas) {
            const catKey = routeCategory === 'cat1' ? 'categoria_1_4' : routeCategory === 'cat2' ? 'categoria_2' : 'categoria_3';
            const catObj = p.tarifas_urbanas[catKey] || p.tarifas_urbanas;

            // Map labels to internal keys
            const keyMap: any = {
              'TBFP': ['tarifa_base_fuera_punta', 'TBFP', 'Tarifa_Base'],
              'TBP': ['tarifa_base_punta', 'TBP', 'Tarifa_Punta'],
              'TS': ['tarifa_saturacion', 'TS', 'Tarifa_Saturacion']
            };

            const keys = keyMap[routeTimeProfile];
            let foundPrice = 0;
            for (const k of keys) {
              if (catObj[k] !== undefined && catObj[k] !== null) {
                foundPrice = Number(catObj[k]);
                break;
              }
            }
            price = foundPrice || catObj.TBFP || p.precio || 0;
          }
          tollSum += price;
        }
        return isNear;
      });

      setRoutePorticos(found);
      setTotalTollCost(tollSum);
    } else {
      setRouteGeometry(null);
      setRouteDistanceKm(0);
      setRoutePorticos([]);
      setTotalTollCost(0);
    }
  }, [routeAlternatives, selectedRouteIndex, vehicleType, routeCategory, routeTimeProfile]);

  // --- End Route Calculator Effect ---

  return (
    <div className={`flex flex-col h-screen ${isOlimpo ? 'olimpo-gradient' : isMatrix ? 'matrix-bg matrix-grid' : 'bg-zinc-950'} overflow-hidden font-sans text-zinc-50 ${isMatrix ? 'matrix-mode' : ''}`}>
      {isMatrix && <MatrixCanvas />}
      {isMatrix && <MatrixConsole onCommand={handleConsoleCommand} />}
      {isMatrix && <MatrixCommandTerminal onCommand={handleConsoleCommand} />}
      {isMatrix && <div className="matrix-scanline" />}
      {/* Top bar */}
      <header className={`flex items-center justify-between px-8 py-4 ${isOlimpo ? 'bg-amber-950/90 border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.1)]' : isMatrix ? 'bg-black/90 border-emerald-500/30 animate-matrix-flicker' : 'bg-zinc-950/90 border-zinc-800'} backdrop-blur-sm border-b z-50 shrink-0 relative overflow-hidden`}>
        {isOlimpo && (
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10 pointer-events-none" />
        )}
        <div className="flex items-center gap-4 relative z-10">
          <div className={`relative w-12 h-9 rounded-md overflow-hidden shadow-lg border ${isOlimpo ? 'border-amber-400 shadow-amber-900/40' : isMatrix ? 'border-emerald-500 shadow-emerald-900/40 animate-matrix-flicker' : 'border-white/10'} shrink-0`}>
            {/* Chilean Flag Stylized */}
            <div className={`absolute top-0 left-0 w-full h-1/2 ${isOlimpo ? 'bg-amber-50' : isMatrix ? 'bg-zinc-100' : 'bg-white'}`} />
            <div className={`absolute bottom-0 left-0 w-full h-1/2 ${isOlimpo ? 'bg-amber-700' : isMatrix ? 'bg-emerald-900' : 'bg-red-600'}`} />
            <div className={`absolute top-0 left-0 w-5 h-1/2 ${isOlimpo ? 'bg-amber-900' : isMatrix ? 'bg-emerald-950' : 'bg-blue-700'} flex items-center justify-center`}>
              <span className={`${isOlimpo ? 'text-amber-400 animate-spin-slow' : isMatrix ? 'text-emerald-400 matrix-text animate-pulse' : 'text-white'} text-[12px] pb-[1px]`}>★</span>
            </div>
          </div>
          <div>
            <h1 className={`text-xl font-black ${isOlimpo ? 'text-amber-400 animate-gold-glow' : isMatrix ? 'matrix-text' : 'text-white'} leading-none tracking-tight`}>
              {isOlimpo ? 'Olimpo Chile' : isMatrix ? 'MATRIX SYSTEM' : 'HolaChile'}
            </h1>
            <p className={`text-[10px] ${isOlimpo ? 'text-amber-600' : isMatrix ? 'text-emerald-500 font-mono' : 'text-zinc-400'} font-bold uppercase tracking-[0.25em] mt-1`}>
              {isOlimpo ? 'Nivel Divino de Consulta' : isMatrix ? '> ACCESSING TOLL_DATA_STREAM...' : 'Plataforma de Consulta'}
            </p>
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

          {/* Global Comuna Search */}
          <div className="hidden md:block relative group">
            <div className={`flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 focus-within:border-blue-500/50 transition-all w-48 xl:w-64 ${isMatrix ? 'pointer-events-none opacity-30' : ''}`}>
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder={isMatrix ? "Console activa..." : "Buscar comuna..."}
                className="bg-transparent border-none outline-none text-xs text-zinc-200 placeholder:text-zinc-600 w-full"
                disabled={isMatrix}
                onChange={(e) => {
                  if (isMatrix) return;
                  const val = e.target.value.toLowerCase();
                  if (val.length > 2) {
                    const match = (allComunas as any[]).find(c => c.comuna.toLowerCase().startsWith(val) || c.comuna.toLowerCase().includes(val));
                    if (match) {
                      setSelectedComuna(match);
                      setActiveTab('comunas');
                    }
                  }
                }}
              />
            </div>
          </div>

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
        <aside className={`hidden lg:flex flex-col w-80 xl:w-88 ${isOlimpo ? 'bg-amber-950/40 border-amber-900/50' : isMatrix ? 'bg-black border-emerald-900/50' : 'bg-zinc-950 border-zinc-800'} border-r overflow-hidden shrink-0 z-10 shadow-lg`}>
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
              porticos={(activeTab === 'ruta' || activeTab === 'simulacion') && routeGeometry ? routePorticos : allPorticos}
              selectedAutopista={selectedAutopista}
              onPorticoClick={handlePorticoClick}
              onMapClick={handleMapClick}
              origin={origin}
              destination={destination}
              routeGeometry={routeGeometry}
              routePorticos={routePorticos}
              showComunas={showComunas}
              selectedComuna={selectedComuna}
              centerOn={mapCenter}
              pickingMode={pickingMode}
              simActive={simActive}
              flowPerHour={simParams.flowPerHour}
              pctCat1={simParams.pctCat1}
              pctCat2={simParams.pctCat2}
              pctCat3={simParams.pctCat3}
              timeProfile={simParams.timeProfile}
              onSimTick={setSimStats}
              onSimComplete={() => {
                setSimActive(false);
                setSimCompleted(true);
              }}
              onComunaClick={(nombre) => {
                const c = findComuna(nombre);
                if (c) {
                  setSelectedComuna(c);
                  setActiveTab('comunas');
                }
              }}
            />
          </div>

          {/* ── Comunas toggle ── */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto">
            <button
              onClick={() => setShowComunas(v => !v)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xl border transition-all duration-200
                ${showComunas
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-900/40'
                  : 'bg-zinc-900/90 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5Z" />
              </svg>
              Comunas RM
              {showComunas && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
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

        {/* Right panel */}
        <aside className={`hidden md:flex flex-col w-96 xl:w-[28rem] ${isOlimpo ? 'bg-amber-950/20 border-amber-900/50' : isMatrix ? 'bg-black border-emerald-900/50 shadow-[0_0_15px_rgba(0,255,65,0.05)]' : 'bg-zinc-950 border-zinc-800'} border-l overflow-hidden shrink-0 z-10 shadow-xl`}>
          <div className={`p-4 border-b ${isMatrix ? 'border-emerald-900/50' : 'border-zinc-800'} shrink-0 ${isMatrix ? 'bg-black' : 'bg-zinc-950/50'}`}>
            <div className={`flex items-center gap-1.5 p-1.5 ${isMatrix ? 'bg-black border-emerald-500/20' : 'bg-zinc-900/50 border-zinc-800'} rounded-xl border`}>
              {[
                { id: 'lista', label: 'DATABASE' },
                { id: 'ruta', label: 'TRAJECTORY' },
                { id: 'simulacion', label: 'SIMULATION', color: isMatrix ? 'matrix-text' : 'text-purple-400', hover: isMatrix ? 'hover:text-emerald-300' : 'hover:text-purple-300' },
                { id: 'tags', label: 'PORTICOS' },
                { id: 'comunas', label: 'GEODATA', color: isMatrix ? 'matrix-text' : 'text-blue-400', hover: isMatrix ? 'hover:text-emerald-300' : 'hover:text-blue-300' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`flex-1 py-2 px-1 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === tab.id ? `${isMatrix ? 'bg-emerald-950/40 border-emerald-500/50 matrix-text' : 'bg-zinc-800 text-zinc-50'} shadow-md border` : `${isMatrix ? 'text-emerald-900' : 'text-zinc-400'} ${tab.hover || 'hover:text-zinc-100'} hover:bg-zinc-800/30`}`}
                  onClick={() => setActiveTab(tab.id as any)}
                >
                  {isMatrix ? `[${tab.label}]` : tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'ruta' && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar bg-zinc-950">
                <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 shadow-sm flex flex-col gap-4">
                  <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Calculadora de Ruta
                  </h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-medium">Sitio de Origen</label>
                      <div className="flex gap-2">
                        <button onClick={requestGeolocation} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md px-3 py-2 text-xs font-medium text-zinc-300">GPS</button>
                        <button onClick={() => setPickingMode('origin')} className={`flex-1 rounded-md px-3 py-2 text-xs font-medium border ${pickingMode === 'origin' ? 'bg-blue-600/20 text-blue-400 border-blue-600/50' : 'bg-zinc-950 border-zinc-800 text-zinc-300'}`}>
                          {origin ? 'Cambiar Origen' : '🗺️ Mapa'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-medium">Destino</label>
                      <button onClick={() => setPickingMode('destination')} className={`w-full rounded-md px-3 py-2 text-xs font-medium border ${pickingMode === 'destination' ? 'bg-red-600/20 text-red-400 border-red-600/50' : 'bg-zinc-950 border-zinc-800 text-zinc-300'}`}>
                        {destination ? 'Cambiar Destino' : '📍 Marcar'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-medium">Vehículo</label>
                      <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 outline-none">
                        <option value="gasolina">Gasolina</option>
                        <option value="diesel">Diésel</option>
                        <option value="hibrido">Híbrido</option>
                        <option value="electrico">Eléctrico</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-medium">Categoría TAG</label>
                      <select value={routeCategory} onChange={(e) => setRouteCategory(e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 outline-none">
                        <option value="cat1">Cat 1 y 4: Autos, Camionetas, Motos</option>
                        <option value="cat2">Cat 2: Buses y Camiones simples</option>
                        <option value="cat3">Cat 3: Camiones con remolque</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-medium">Horario de Tránsito</label>
                      <select value={routeTimeProfile} onChange={(e) => setRouteTimeProfile(e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 outline-none">
                        <option value="TBFP">Valle (Tarifa Base Fuera Punta)</option>
                        <option value="TBP">Punta (Tarifa Base Punta)</option>
                        <option value="TS">Saturación (Tarifa Saturación)</option>
                      </select>
                    </div>
                    <button onClick={calculateRoute} disabled={!origin || !destination || isCalculating} className="w-full bg-white hover:bg-zinc-200 disabled:bg-zinc-900 disabled:text-zinc-500 rounded-md text-zinc-900 font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2">
                      {isCalculating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Calculando...
                        </>
                      ) : 'Trazar Ruta'}
                    </button>
                  </div>
                </div>

                {routeAlternatives.length > 0 && routeGeometry && (
                  <div className="bg-zinc-950 rounded-lg p-5 border border-zinc-800 shadow-sm flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="border border-zinc-800 rounded-md p-3 bg-zinc-900/40">
                        <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Distancia</div>
                        <div className="text-xl font-semibold text-zinc-100">{routeDistanceKm.toFixed(1)} km</div>
                      </div>
                      <div className="border border-zinc-800 rounded-md p-3 bg-zinc-900/40">
                        <div className="text-[10px] text-emerald-500 font-bold uppercase mb-1">Costo TAG</div>
                        <div className="text-xl font-semibold text-emerald-400">${Math.round(totalTollCost).toLocaleString('es-CL')}</div>
                      </div>
                      <div className="border border-zinc-800 rounded-md p-3 bg-zinc-900/40">
                        <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Combustible</div>
                        <div className="text-xl font-semibold text-zinc-100">${Math.round(fuelCost).toLocaleString('es-CL')}</div>
                      </div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-md flex justify-between items-center">
                      <span className="text-xs font-bold text-emerald-500 uppercase">Costo Total Viaje</span>
                      <span className="text-lg font-bold text-white">${Math.round(totalTollCost + fuelCost).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="border-t border-zinc-800 pt-4">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-widest">Pórticos Intersectados ({routePorticos.length})</div>
                      <div className="flex flex-col gap-2 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar">
                        {routePorticos.map((p, i) => (
                          <div key={p.id + '-' + i} className="flex flex-col bg-zinc-900/50 p-3 rounded-md border border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer group" onClick={() => handlePorticoClick(p)}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-xs text-zinc-200 truncate">{p.nombre}</span>
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            </div>
                            {p.comuna && (() => {
                              const c = findComuna(p.comuna);
                              return c && (
                                <div className="flex items-center gap-1.5 mt-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                  <img src={c.logo_url} className="w-3 h-3 object-contain" alt="" />
                                  <span className="text-[10px] text-zinc-500">{c.comuna}</span>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'lista' && (
              <PorticoList porticos={allPorticos} selectedAutopista={selectedAutopista} onPorticoClick={handlePorticoClick} />
            )}

            {activeTab === 'tags' && selectedPortico && (
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-zinc-950">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedPortico.color }} />
                    <h2 className="text-lg font-bold text-zinc-50">{selectedPortico.nombre}</h2>
                  </div>
                  {selectedPortico.comuna && (() => {
                    const c = findComuna(selectedPortico.comuna);
                    return c && <img src={c.logo_url} alt="" className="w-6 h-6 object-contain" title={c.comuna} />;
                  })()}
                </div>
                <div className="space-y-4">
                  <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 space-y-3">
                    <InfoRow label="Autopista" value={selectedPortico.autopista} color={selectedPortico.color} />
                    <InfoRow label="Tramo" value={selectedPortico.tramo} />
                    <InfoRow label="Kilómetro" value={`KM ${selectedPortico.km}`} />
                    {selectedPortico.comuna && <InfoRow label="Comuna" value={selectedPortico.comuna} />}
                  </div>

                  {selectedPortico.tarifas_urbanas && (
                    <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
                      <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Esquema Tarifario</h3>
                      <div className="space-y-4">
                        {Object.entries(selectedPortico.tarifas_urbanas).map(([k, v]) => (
                          <div key={k} className="space-y-2">
                            <div className="text-[10px] text-zinc-400 font-bold uppercase">{k.replace(/_/g, ' ')}</div>
                            {typeof v === 'object' && v !== null ? (
                              Object.entries(v).map(([sk, sv]) => (
                                <InfoRow key={sk} label={sk.replace(/_/g, ' ')} value={`$${Number(sv).toLocaleString('es-CL')}`} mono />
                              ))
                            ) : (
                              <InfoRow label="Precio" value={`$${Number(v).toLocaleString('es-CL')}`} mono />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPortico.comuna && <ComunaCard comuna={selectedPortico.comuna} />}
                </div>
              </div>
            )}

            {activeTab === 'tags' && !selectedPortico && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-40">
                <MapPin className="w-12 h-12 mb-4 text-zinc-700" />
                <p className="text-sm">Selecciona un pórtico para ver detalles</p>
              </div>
            )}

            {activeTab === 'simulacion' && (
              <SimulationTab
                routePorticos={routePorticos} routeDistanceKm={routeDistanceKm} origin={origin} destination={destination}
                pickingMode={pickingMode} setPickingMode={setPickingMode} calculateRoute={calculateRoute}
                isCalculating={isCalculating} requestGeolocation={requestGeolocation}
                simActive={simActive} setSimActive={setSimActive}
                simParams={simParams} setSimParams={setSimParams}
                simStats={simStats} setSimStats={setSimStats}
                simCompleted={simCompleted} setSimCompleted={setSimCompleted}
              />
            )}

            {activeTab === 'comunas' && (
              <ComunasTab
                selectedComuna={selectedComuna}
                onSelectComuna={setSelectedComuna}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Mobile view */}
      {isMobileListOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileListOpen(false)} />
          <div className="relative bg-zinc-950 border-t border-zinc-800 h-[85vh] flex flex-col z-10 rounded-t-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
              <span className="text-sm font-bold">Filtros</span>
              <button onClick={() => setIsMobileListOpen(false)} className="text-zinc-500 hover:text-white">Cerrar</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar autopistas={autopistas} selectedAutopista={selectedAutopista} onSelectAutopista={(a) => { setSelectedAutopista(a); setIsMobileListOpen(false); }} totalPorticos={allPorticos.length} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black flex items-center justify-center text-white">Cargando...</div>}>
      <AppContent />
    </Suspense>
  );
}
