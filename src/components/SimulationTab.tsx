'use client';

import { useState } from 'react';
import type { Portico } from '@/data';
import {
  Play, RotateCcw, Activity, Car, Truck, Clock,
  DollarSign, BarChart3, MapPin, Pause, TrendingUp
} from 'lucide-react';

type Props = {
  routePorticos: Portico[];
  routeDistanceKm: number;
  origin: [number, number] | null;
  destination: [number, number] | null;
  pickingMode: 'origin' | 'destination' | null;
  setPickingMode: (mode: 'origin' | 'destination' | null) => void;
  calculateRoute: () => void;
  isCalculating: boolean;
  requestGeolocation: () => void;
  // Simulation control (lifted to page.tsx)
  onStart: (params: SimParams) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  isSimulating: boolean;
  isPaused: boolean;
  simCompleted: boolean;
  // Live metrics from map
  liveVehicles: number;
  liveRevenue: number;
  liveMinutes: number;
};

export type SimParams = {
  flowPerHour: number;
  pctCat1: number;
  pctCat2: number;
  timeProfile: 'valle' | 'punta' | 'saturacion';
};

export default function SimulationTab({
  routePorticos,
  routeDistanceKm,
  origin,
  destination,
  pickingMode,
  setPickingMode,
  calculateRoute,
  isCalculating,
  requestGeolocation,
  onStart,
  onPause,
  onResume,
  onReset,
  isSimulating,
  isPaused,
  simCompleted,
  liveVehicles,
  liveRevenue,
  liveMinutes,
}: Props) {
  const [flowPerHour, setFlowPerHour] = useState(1500);
  const [pctCat1, setPctCat1] = useState(70);
  const [pctCat2, setPctCat2] = useState(20);
  const [timeProfile, setTimeProfile] = useState<'valle' | 'punta' | 'saturacion'>('punta');

  const pctCat3 = Math.max(0, 100 - pctCat1 - pctCat2);

  const handleStart = () => {
    onStart({ flowPerHour, pctCat1, pctCat2, timeProfile });
  };

  const progressPct = (liveMinutes / 60) * 100;

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar bg-zinc-950">

      {/* Route setup */}
      <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 shadow-sm flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-purple-500" />
          Ruta de Análisis
        </h2>

        {routePorticos.length === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium">Sitio de Origen</label>
              <div className="flex gap-2">
                <button onClick={requestGeolocation} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md px-3 py-2 text-xs font-medium text-zinc-300">GPS</button>
                <button
                  onClick={() => setPickingMode('origin')}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors border ${pickingMode === 'origin' ? 'bg-blue-600/20 text-blue-400 border-blue-600/50' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900 text-zinc-300'}`}
                >
                  {origin ? 'Cambiar Origen' : '📍 Elegir Mapa'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium">Destino</label>
              <button
                onClick={() => setPickingMode('destination')}
                className={`w-full rounded-md px-3 py-2 text-xs font-medium transition-colors border ${pickingMode === 'destination' ? 'bg-red-600/20 text-red-400 border-red-600/50' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900 text-zinc-300'}`}
              >
                {destination ? 'Cambiar Destino' : '📍 Marcar Destino'}
              </button>
            </div>
            <button
              onClick={calculateRoute}
              disabled={!origin || !destination || isCalculating}
              className="w-full bg-zinc-200 hover:bg-white disabled:bg-zinc-900 disabled:text-zinc-500 rounded-md text-black font-semibold py-2.5 text-sm transition-colors"
            >
              {isCalculating ? 'Calculando...' : 'Trazar Ruta'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-md border border-zinc-800/80">
              <span className="text-xs text-zinc-400 font-medium">Pórticos Intersectados</span>
              <span className="text-sm font-semibold text-zinc-100">{routePorticos.length}</span>
            </div>
            <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-md border border-zinc-800/80">
              <span className="text-xs text-zinc-400 font-medium">Longitud Tramo</span>
              <span className="text-sm font-semibold text-zinc-100">{routeDistanceKm.toFixed(1)} km</span>
            </div>
          </div>
        )}
      </div>

      {/* Config panel — only shown before simulation */}
      {routePorticos.length > 0 && !isSimulating && !simCompleted && (
        <div className="bg-zinc-900/30 p-5 rounded-lg border border-zinc-800 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2">
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Parámetros de Flujo
          </h2>

          <div className="space-y-2">
            <label className="text-xs text-zinc-400 font-medium">Volumen por Hora</label>
            <input
              type="range" min="100" max="10000" step="100" value={flowPerHour}
              onChange={(e) => setFlowPerHour(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="text-right text-xs font-medium text-blue-400">{flowPerHour} veh/hr</div>
          </div>

          <div className="space-y-3 p-3 bg-zinc-950 rounded-md border border-zinc-900">
            <div className="text-xs font-medium text-zinc-400">Distribución de Flota</div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs items-center">
                <span className="text-zinc-300 flex items-center gap-1"><Car className="w-3 h-3 text-blue-400" /> Categoría 1 (Autos)</span>
                <span className="font-mono text-blue-400">{pctCat1}%</span>
              </div>
              <input type="range" min="0" max="100" value={pctCat1} onChange={(e) => {
                const v = parseInt(e.target.value);
                setPctCat1(v);
                if (v + pctCat2 > 100) setPctCat2(100 - v);
              }} className="w-full accent-blue-500" />
            </div>

            <div className="flex flex-col gap-1 mt-2">
              <div className="flex justify-between text-xs items-center">
                <span className="text-zinc-300 flex items-center gap-1"><Truck className="w-3 h-3 text-slate-400" /> Categoría 2 (2 ejes)</span>
                <span className="font-mono text-slate-400">{pctCat2}%</span>
              </div>
              <input type="range" min="0" max={100 - pctCat1} value={pctCat2} onChange={(e) => setPctCat2(parseInt(e.target.value))} className="w-full accent-slate-500" />
            </div>

            <div className="flex justify-between text-xs items-center pt-2 border-t border-zinc-800 mt-2">
              <span className="text-zinc-500">Categoría 3 (Pesados)</span>
              <span className="font-mono text-zinc-500">{pctCat3}%</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-400 font-medium">Horario Tarifario</label>
            <select
              value={timeProfile}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimeProfile(e.target.value as 'valle' | 'punta' | 'saturacion')}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-medium text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
            >
              <option value="valle">Valle (TBFP) — Tarifa Normal</option>
              <option value="punta">Punta (TBP) — Alta Congestión</option>
              <option value="saturacion">Saturación (TS) — Máxima Demanda</option>
            </select>
          </div>

          <button
            onClick={handleStart}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-md font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30"
          >
            <Play className="w-4 h-4" />
            Simular en Mapa
          </button>
        </div>
      )}

      {/* Live simulation panel */}
      {(isSimulating || simCompleted) && (
        <div className="flex flex-col gap-4">

          {/* Status header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {isSimulating && !isPaused
                ? <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                : simCompleted
                  ? <div className="w-2 h-2 rounded-full bg-purple-500" />
                  : <div className="w-2 h-2 rounded-full bg-yellow-400" />}
              <span className="text-xs font-semibold text-zinc-100 uppercase tracking-widest">
                {simCompleted ? 'Reporte Final' : isPaused ? 'Pausado' : 'Simulación en Mapa ▶'}
              </span>
            </div>
            <div className="font-mono text-sm text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {Math.floor(liveMinutes).toString().padStart(2, '0')}:00
            </div>
          </div>

          {/* HUD hint */}
          {isSimulating && (
            <div className="text-[10px] text-zinc-600 text-center italic bg-zinc-900/30 rounded-md p-2 border border-zinc-800/50">
              🗺️ Los vehículos se animan directamente sobre el mapa
            </div>
          )}

          {/* Revenue */}
          <div className="flex flex-col items-center justify-center py-5 bg-zinc-900/60 rounded-xl border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.07)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/0 to-emerald-950/20 pointer-events-none" />
            <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Ingreso Bruto Acumulado</span>
            <div className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300 font-mono z-10">
              ${Math.round(liveRevenue).toLocaleString('es-CL')}
            </div>
            <span className="text-[9px] text-zinc-600 mt-1 z-10">CLP · en tiempo real</span>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 rounded-md p-3 border border-zinc-800">
              <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Car className="w-3 h-3" /> Vehículos
              </div>
              <div className="text-xl font-medium text-zinc-200">{liveVehicles.toLocaleString('es-CL')} <span className="text-xs text-zinc-500">veh</span></div>
            </div>
            <div className="bg-zinc-900 rounded-md p-3 border border-zinc-800">
              <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Prom/Veh
              </div>
              <div className="text-xl font-medium text-zinc-200">
                ${liveVehicles > 0 ? Math.round(liveRevenue / liveVehicles).toLocaleString('es-CL') : '0'}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>0 min</span>
              <span className="text-zinc-500">{Math.round(liveMinutes)} min</span>
              <span>60 min</span>
            </div>
          </div>

          {/* Pause / Resume */}
          {isSimulating && (
            <button
              onClick={isPaused ? onResume : onPause}
              className={`w-full rounded-md font-medium py-2 text-sm transition-colors flex items-center justify-center gap-2 border ${isPaused
                ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-600/40'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'}`}
            >
              {isPaused ? <><Play className="w-4 h-4" /> Reanudar</> : <><Pause className="w-4 h-4" /> Pausar</>}
            </button>
          )}

          {/* Final report */}
          {simCompleted && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-3">
              <div className="p-4 bg-purple-950/20 border border-purple-500/20 rounded-md">
                <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Reporte Final
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Total Vehículos</span>
                    <span className="text-blue-400 font-medium">{liveVehicles.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Ingreso Total</span>
                    <span className="text-emerald-400 font-medium">${Math.round(liveRevenue).toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Ingreso/Vehículo</span>
                    <span className="text-zinc-100 font-medium">
                      ${liveVehicles > 0 ? Math.round(liveRevenue / liveVehicles).toLocaleString('es-CL') : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Pórticos en Ruta</span>
                    <span className="text-zinc-100 font-medium">{routePorticos.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Tarifa Aplicada</span>
                    <span className="text-zinc-100 font-medium capitalize">{timeProfile}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reset */}
          <button
            onClick={onReset}
            className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-md font-medium py-1.5 text-xs transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3 h-3" /> {isSimulating ? 'Cancelar' : 'Nueva Simulación'}
          </button>

        </div>
      )}
    </div>
  );
}
