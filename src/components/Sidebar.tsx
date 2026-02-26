'use client';

import type { Autopista } from '@/data';

type SidebarProps = {
  autopistas: Autopista[];
  selectedAutopista: string | null;
  onSelectAutopista: (name: string | null) => void;
  totalPorticos: number;
};

export default function Sidebar({ autopistas, selectedAutopista, onSelectAutopista, totalPorticos }: SidebarProps) {
  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">TAG Chile</h1>
            <p className="text-slate-400 text-xs">OpenStreetMap Data</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{totalPorticos}</div>
          <div className="text-xs text-slate-400 mt-0.5">Pórticos totales</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{autopistas.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">Autopistas</div>
        </div>
      </div>

      {/* Source badge */}
      <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/30 rounded-lg px-3 py-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-emerald-400 text-xs font-medium">Fuente: OpenStreetMap</span>
        <span className="text-emerald-600 text-xs ml-auto">highway=toll_gantry</span>
      </div>

      {/* All button */}
      <button
        onClick={() => onSelectAutopista(null)}
        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all duration-200 ${selectedAutopista === null
          ? 'bg-slate-700 border-slate-500 text-white'
          : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-700/40'
          }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-linear-to-br from-blue-400 to-violet-400" />
          <span className="font-medium text-sm">Todas las autopistas</span>
        </div>
        <span className="text-xs text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded-full">
          {totalPorticos}
        </span>
      </button>

      {/* Autopista list */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">Autopistas</span>
        {autopistas.map((a) => (
          <button
            key={a.autopista}
            onClick={() => onSelectAutopista(selectedAutopista === a.autopista ? null : a.autopista)}
            className={`flex flex-col gap-2 w-full px-4 py-3 rounded-xl border transition-all duration-200 text-left ${selectedAutopista === a.autopista
              ? 'border-opacity-60 text-white'
              : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-700/40'
              }`}
            style={
              selectedAutopista === a.autopista
                ? {
                  backgroundColor: `${a.color}18`,
                  borderColor: `${a.color}60`,
                }
                : {}
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: a.color }}
                />
                <span className="font-semibold text-sm leading-tight">{a.autopista}</span>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${a.color}25`,
                  color: a.color,
                }}
              >
                {a.totalPorticos}
              </span>
            </div>
            <p className="text-xs text-slate-500 pl-6 leading-relaxed">{a.descripcion}</p>
            <div className="flex items-center gap-2 pl-6">
              <span className="text-xs text-slate-600">{a.concesionario}</span>
            </div>
          </button>
        ))}
      </div>

      {/* OSM Query */}
      <div className="mt-auto">
        <div className="bg-slate-900/80 rounded-xl border border-slate-700/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overpass Query</span>
            <span className="text-xs text-slate-600">OSM</span>
          </div>
          <code className="text-xs text-emerald-400 font-mono leading-relaxed block whitespace-pre-wrap break-all">
            {`node["highway"="toll_gantry"]\n(around:50000,-33.45,-70.66);\nout body;`}
          </code>
        </div>
      </div>
    </div>
  );
}
