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
      <div className="px-8 py-8 border-b border-zinc-900 bg-zinc-950/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-950 font-bold text-xl shadow-xl shadow-white/5">
            TG
          </div>
          <div>
            <h1 className="text-zinc-50 font-bold text-xl tracking-tight leading-tight">TAG Chile</h1>
            <p className="text-zinc-500 text-sm mt-1 font-medium">Gestión de Peajes</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-8 py-6 border-b border-zinc-900 bg-zinc-900/10">
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col space-y-1.5 border-r border-zinc-800/50">
            <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Pórticos</span>
            <span className="text-3xl font-bold text-zinc-50 tracking-tighter">{totalPorticos}</span>
          </div>
          <div className="flex flex-col space-y-1.5 pl-2">
            <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Sistemas</span>
            <span className="text-3xl font-bold text-zinc-50 tracking-tighter">{autopistas.length}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        {/* All button */}
        <button
          onClick={() => onSelectAutopista(null)}
          className={`group flex items-center justify-between w-full px-4 py-3.5 mb-6 rounded-xl transition-all duration-300 border ${selectedAutopista === null
            ? 'bg-zinc-100 text-zinc-900 font-bold shadow-xl shadow-white/5 border-white'
            : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 border-transparent hover:border-zinc-800'
            }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <Layers className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold truncate">Ver red completa</span>
          </div>
          <span className={`text-[10px] ml-2 px-2.5 py-1 rounded-full border font-bold ${selectedAutopista === null ? 'border-zinc-300 text-zinc-600 bg-zinc-200/50' : 'border-zinc-800 text-zinc-600 group-hover:border-zinc-700'
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
                className={`group flex flex-col w-full px-4 py-4 rounded-xl transition-all duration-300 text-left relative overflow-hidden focus-visible:outline-none border ${isSelected
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-50 shadow-xl'
                  : 'text-zinc-500 border-transparent hover:bg-zinc-900/50 hover:text-zinc-200 hover:border-zinc-800/50'
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
