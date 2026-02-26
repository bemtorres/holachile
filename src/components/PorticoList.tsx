'use client';

import type { Portico } from '@/data';
import { useState } from 'react';
import { Search, MapPin, ExternalLink, Activity } from 'lucide-react';

type PorticoListProps = {
  porticos: (Portico & { autopista: string; color: string })[];
  selectedAutopista: string | null;
  onPorticoClick?: (p: Portico & { autopista: string; color: string }) => void;
};

const TAG_LABELS: Record<string, string> = {
  'highway': 'Type',
  'operator': 'Operator',
  'name': 'Name',
  'ref': 'Reference',
  'payment:electronic': 'Electronic Payment',
  'payment:cash': 'Cash Payment',
  'toll': 'Toll Active',
  'tunnel': 'Tunnel Node',
  'addr:city': 'City Node',
};

export default function PorticoList({ porticos, selectedAutopista, onPorticoClick }: PorticoListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = porticos.filter((p) => {
    const matchAuto = selectedAutopista ? p.autopista === selectedAutopista : true;
    const matchSearch = search
      ? p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.tramo.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchAuto && matchSearch;
  });

  return (
    <div className="flex flex-col h-full bg-black text-zinc-100">
      {/* Search */}
      <div className="p-6 border-b border-zinc-900 bg-zinc-950">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500 group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="BUSCAR NODO / TRAMO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:ring-4 focus:ring-white/5 transition-all font-mono tracking-widest uppercase"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">
            {filtered.length} NODO{filtered.length !== 1 ? 'S' : ''} DETECTADOS
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.map((p) => {
          const isExpanded = expandedId === p.id;
          return (
            <div key={p.id} className="group border-b border-zinc-900 border-dashed last:border-none relative">
              <button
                className={`w-full px-6 py-6 flex items-start gap-5 transition-all duration-300 text-left border-l-2 ${isExpanded ? 'bg-zinc-900/40 border-white' : 'hover:bg-zinc-900/20 border-transparent hover:border-zinc-800'}`}
                onClick={() => {
                  setExpandedId(isExpanded ? null : p.id);
                  onPorticoClick?.(p);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-none mt-1.5 shrink-0"
                        style={{ backgroundColor: p.color || '#fff' }}
                      />
                      <div>
                        <p className="text-sm font-bold text-white tracking-wider uppercase leading-snug">{p.nombre}</p>
                        <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">SEC: {p.tramo}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className="text-[10px] px-2 py-0.5 border font-mono tracking-widest whitespace-nowrap"
                        style={{ borderColor: p.color || '#fff', color: p.color || '#fff' }}
                      >
                        KM {p.km}
                      </span>
                      {p.sentido && (
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest">{p.sentido}</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded OSM tags */}
                  {isExpanded && (
                    <div className="mt-6 border border-zinc-800 bg-zinc-950/50 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                      <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-zinc-800/50">
                        <Activity className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-zinc-400 font-bold uppercase tracking-[0.2em] text-[11px]">TELEMETRÍA_RAW_DATA</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(p.tags).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-6 text-[10px]">
                            <span className="text-zinc-600 font-mono uppercase tracking-wider truncate">{TAG_LABELS[key] || key}</span>
                            <span className={`font-mono uppercase text-right tracking-tight ${value === 'yes' ? 'text-emerald-500' : value === 'no' ? 'text-red-500' : 'text-zinc-200'}`}>
                              {value}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between gap-6 mt-3 pt-3 border-t border-zinc-800 border-dashed text-[10px]">
                          <span className="text-zinc-600 font-mono uppercase tracking-wider">LATITUDE_COORD</span>
                          <span className="text-zinc-200 font-mono tracking-tight">{p.lat.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between gap-6 text-[10px]">
                          <span className="text-zinc-600 font-mono uppercase tracking-wider">LONGITUDE_COORD</span>
                          <span className="text-zinc-200 font-mono tracking-tight">{p.lng.toFixed(6)}</span>
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-zinc-800/50">
                        <a
                          href={`https://www.openstreetmap.org/node/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full justify-center bg-white text-zinc-900 rounded-lg py-2.5 text-[10px] font-black tracking-[0.2em] uppercase flex items-center gap-2 hover:bg-zinc-200 transition-all shadow-lg active:scale-95"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          VER_NODO_OSM
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
            <Activity className="w-8 h-8 mb-4 opacity-50" />
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase">No nodes intercepted</p>
          </div>
        )}
      </div>
    </div>
  );
}
