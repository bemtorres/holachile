'use client';

import { useState, useRef, useEffect } from 'react';
import type { Portico } from '@/data';
import {
  Play, RotateCcw, Activity, Car, Truck, Clock,
  DollarSign, BarChart3, MapPin, Loader2, Download, Table
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
};

export type SimParams = {
  flowPerHour: number;
  pctCat1: number;
  pctCat2: number;
  pctCat3: number;
  timeProfile: 'valle' | 'punta' | 'saturacion';
};

type ResultRow = {
  portico: string;
  priceCat1: number;
  priceCat2: number;
  priceCat3: number;
  vehCat1: number;
  vehCat2: number;
  vehCat3: number;
  revenue: number;
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
}: Props) {
  const [flowPerHour, setFlowPerHour] = useState(1500);
  const [pctCat1, setPctCat1] = useState(70);
  const [pctCat2, setPctCat2] = useState(20);
  const [pctCat3, setPctCat3] = useState(10);
  const [timeProfile, setTimeProfile] = useState<'valle' | 'punta' | 'saturacion'>('punta');

  const [isSimulating, setIsSimulating] = useState(false);
  const [simCompleted, setSimCompleted] = useState(false);
  const [liveMinutes, setLiveMinutes] = useState(0);

  const [results, setResults] = useState<ResultRow[]>([]);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleStart = () => {
    setIsSimulating(true);
    setSimCompleted(false);
    setLiveMinutes(0);
    setResults([]);
    setTotalVehicles(0);
    setTotalRevenue(0);

    // Calc totals
    const vehCat1 = Math.round(flowPerHour * (pctCat1 / 100));
    const vehCat2 = Math.round(flowPerHour * (pctCat2 / 100));
    const vehCat3 = Math.round(flowPerHour * (pctCat3 / 100));
    const totVeh = vehCat1 + vehCat2 + vehCat3;

    // Create results array instantly
    let totRev = 0;
    const finalResults: ResultRow[] = routePorticos.map(rp => {
      let p1 = rp.precio || 0;
      let p2 = (rp.precio || 0) * 2.3;
      let p3 = (rp.precio || 0) * 3.5;

      if (rp.tarifas_urbanas) {
        const cat1Obj = rp.tarifas_urbanas.categoria_1_4 || rp.tarifas_urbanas;
        const cat2Obj = rp.tarifas_urbanas.categoria_2 || rp.tarifas_urbanas;
        const cat3Obj = rp.tarifas_urbanas.categoria_3 || rp.tarifas_urbanas;

        const getPrice = (obj: any) => {
          const key = timeProfile === 'punta' ? 'TBP' : timeProfile === 'saturacion' ? 'TS' : 'TBFP';
          return obj[key] || obj.TBFP || rp.precio || 0;
        };

        p1 = getPrice(cat1Obj);
        p2 = getPrice(cat2Obj);
        p3 = getPrice(cat3Obj);
      }

      const rev = (p1 * vehCat1) + (p2 * vehCat2) + (p3 * vehCat3);
      totRev += rev;

      return {
        portico: rp.nombre,
        priceCat1: p1,
        priceCat2: p2,
        priceCat3: p3,
        vehCat1,
        vehCat2,
        vehCat3,
        revenue: rev
      };
    });

    // Fast timer to count up to 60 minutes
    timerRef.current = setInterval(() => {
      setLiveMinutes((prev) => {
        const next = prev + 2; // progress 2 mins per tick
        if (next >= 60) {
          clearInterval(timerRef.current!);
          setIsSimulating(false);
          setSimCompleted(true);
          setResults(finalResults);
          setTotalVehicles(totVeh);
          setTotalRevenue(totRev);
          return 60;
        }
        return next;
      });
    }, 50); // Fast interval
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSimulating(false);
    setSimCompleted(false);
    setLiveMinutes(0);
    setResults([]);
    setTotalVehicles(0);
    setTotalRevenue(0);
  };

  const downloadCSV = () => {
    let csv = 'Pórtico,Tarifa Cat 1,Tarifa Cat 2,Tarifa Cat 3,Vehículos Cat 1,Vehículos Cat 2,Vehículos Cat 3,Ingreso Total\n';
    results.forEach(r => {
      csv += `"${r.portico}",${r.priceCat1},${r.priceCat2},${r.priceCat3},${r.vehCat1},${r.vehCat2},${r.vehCat3},${r.revenue}\n`;
    });

    // Summary
    const vC1 = results.length > 0 ? results[0].vehCat1 : 0;
    const vC2 = results.length > 0 ? results[0].vehCat2 : 0;
    const vC3 = results.length > 0 ? results[0].vehCat3 : 0;
    csv += `\nTOTALES,,,,${vC1},${vC2},${vC3},${totalRevenue}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'simulacion_recaudacion_1hr.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              className="w-full bg-zinc-200 hover:bg-white disabled:bg-zinc-900 disabled:text-zinc-500 rounded-md text-black font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculando...
                </>
              ) : 'Trazar Ruta'}
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
            Parámetros de Flujo en 1 Hora
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

            <div className="flex flex-col gap-1 mt-2">
              <div className="flex justify-between text-xs items-center">
                <span className="text-zinc-300 flex items-center gap-1"><Truck className="w-3 h-3 text-amber-500" /> Categoría 3 (Pesados)</span>
                <span className="font-mono text-amber-500">{pctCat3}%</span>
              </div>
              <input type="range" min="0" max={100 - pctCat1 - pctCat2} value={pctCat3} onChange={(e) => setPctCat3(parseInt(e.target.value))} className="w-full accent-amber-500" />
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
            Calcular Simulacion (Rapida)
          </button>
        </div>
      )}

      {/* Live simulation panel */}
      {(isSimulating || simCompleted) && (
        <div className="flex flex-col gap-4">

          {/* Status header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {isSimulating
                ? <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                : <div className="w-2 h-2 rounded-full bg-purple-500" />
              }
              <span className="text-xs font-semibold text-zinc-100 uppercase tracking-widest">
                {simCompleted ? 'Reporte Final' : 'Calculando...'}
              </span>
            </div>
            <div className="font-mono text-sm text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {Math.floor(liveMinutes).toString().padStart(2, '0')}:00
            </div>
          </div>

          {/* Progress bar */}
          {!simCompleted && (
            <div>
              <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-purple-600 to-blue-500 transition-all duration-100"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>0 min</span>
                <span className="text-zinc-500">{Math.round(liveMinutes)} min</span>
                <span>60 min</span>
              </div>
            </div>
          )}

          {/* Final report */}
          {simCompleted && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">

              <div className="flex flex-col items-center justify-center py-5 bg-zinc-900/60 rounded-xl border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.07)] relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-b from-emerald-950/0 to-emerald-950/20 pointer-events-none" />
                <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Ingreso Bruto de 1 Hora</span>
                <div className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-green-300 font-mono z-10">
                  ${Math.round(totalRevenue).toLocaleString('es-CL')}
                </div>
                <span className="text-[9px] text-zinc-600 mt-1 z-10">Calculado en {totalVehicles.toLocaleString('es-CL')} vehículos</span>
              </div>

              {/* Table Preview */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                <div className="text-xs font-semibold text-zinc-200 p-3 bg-zinc-950/50 border-b border-zinc-800 flex items-center gap-2">
                  <Table className="w-4 h-4 text-zinc-400" />
                  Desglose por Pórtico
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-zinc-950/30 text-zinc-500 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 font-medium">Pórtico</th>
                        <th className="px-3 py-2 font-medium text-right">Vehículos</th>
                        <th className="px-3 py-2 font-medium text-right">Recaudación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                      {results.map((r, i) => (
                        <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-3 py-2 font-medium text-zinc-200 truncate max-w-[120px]" title={r.portico}>{r.portico}</td>
                          <td className="px-3 py-2 text-right">{(r.vehCat1 + r.vehCat2 + r.vehCat3).toLocaleString('es-CL')}</td>
                          <td className="px-3 py-2 text-right text-emerald-400 font-mono">${Math.round(r.revenue).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Download btn */}
              <button
                onClick={downloadCSV}
                className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 text-emerald-400 rounded-md font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar Excel (CSV)
              </button>
            </div>
          )}

          {/* Reset */}
          <button
            onClick={handleReset}
            className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-md font-medium py-2 text-xs transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3 h-3" /> {isSimulating ? 'Cancelar Calculo' : 'Nueva Simulación'}
          </button>

        </div>
      )}
    </div>
  );
}
