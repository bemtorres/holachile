'use client';

import type { Autopista } from '@/data';
import { ChevronRight, Layers, MapPin } from 'lucide-react';

type SidebarProps = {
  autopistas: Autopista[];
  selectedAutopista: string | null;
  onSelectAutopista: (name: string | null) => void;
  totalPorticos: number;
};

export default function Sidebar({ autopistas, selectedAutopista, onSelectAutopista, totalPorticos }: SidebarProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800 text-zinc-100 font-sans">
      {/* Header */}
      <div className="px-6 py-6 border-b border-zinc-900 bg-zinc-950/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-white flex items-center justify-center text-zinc-950 font-bold text-lg shadow-sm">
            TG
          </div>
          <div>
            <h1 className="text-zinc-50 font-semibold text-lg tracking-tight leading-tight">TAG Chile</h1>
            <p className="text-zinc-400 text-sm mt-0.5">Gestión de Peajes</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-4 border-b border-zinc-900 bg-zinc-900/20">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col space-y-1">
            <span className="text-zinc-500 text-xs font-medium">Pórticos</span>
            <span className="text-2xl font-semibold text-zinc-50 tracking-tight">{totalPorticos}</span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-zinc-500 text-xs font-medium">Sistemas</span>
            <span className="text-2xl font-semibold text-zinc-50 tracking-tight">{autopistas.length}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        {/* All button */}
        <button
          onClick={() => onSelectAutopista(null)}
          className={`group flex items-center justify-between w-full px-3 py-2.5 mb-4 rounded-md transition-all duration-200 ${selectedAutopista === null
              ? 'bg-zinc-100 text-zinc-900 font-medium shadow-sm'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <Layers className="w-4 h-4 shrink-0" />
            <span className="text-sm truncate">Ver red completa</span>
          </div>
          <span className={`text-xs ml-2 px-2 py-0.5 rounded-full border ${selectedAutopista === null ? 'border-zinc-300 text-zinc-600' : 'border-zinc-800 text-zinc-500 group-hover:border-zinc-700'
            }`}>
            {totalPorticos}
          </span>
        </button>

        {/* Autopista list */}
        <div className="flex flex-col space-y-1">
          <span className="text-xs font-semibold text-zinc-500 px-3 mb-2 uppercase tracking-wider">Concesiones</span>
          {autopistas.map((a) => {
            const isSelected = selectedAutopista === a.autopista;
            return (
              <button
                key={a.autopista}
                onClick={() => onSelectAutopista(isSelected ? null : a.autopista)}
                className={`group flex flex-col w-full px-3 py-2.5 rounded-md transition-all duration-200 text-left relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${isSelected
                    ? 'bg-zinc-800 text-zinc-50 shadow-sm'
                    : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-100'
                  }`}
              >
                <div className="flex items-center justify-between w-full relative z-10">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div
                      className="w-2 h-2 shrink-0 rounded-full"
                      style={{ backgroundColor: a.color || '#fff' }}
                    />
                    <span className="text-sm font-medium truncate">{a.autopista}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isSelected ? 'rotate-90 text-zinc-300' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                </div>

                {isSelected && (
                  <div className="mt-4 pl-5 animate-in fade-in slide-in-from-top-2 duration-200 relative z-10">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="flex justify-start gap-2 items-center">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-xs text-zinc-300">{a.totalPorticos} Nodos</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold mb-0.5">Operador</span>
                        <span className="text-xs text-zinc-400 truncate pr-2" title={a.concesionario}>{a.concesionario.split(' ')[0]}</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed border-l-2 border-zinc-800 pl-2">&quot;{a.descripcion}&quot;</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
