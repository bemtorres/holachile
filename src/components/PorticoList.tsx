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
      <div className="p-4 border-b border-zinc-900 bg-zinc-950">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="SEARCH NODE / SECTION..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-black border border-zinc-800 rounded-none text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white focus:ring-0 transition-all font-mono tracking-widest uppercase"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Activity className="w-3 h-3 text-zinc-500" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">
            {filtered.length} NODE{filtered.length !== 1 ? 'S' : ''} DETECTED
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.map((p) => {
          const isExpanded = expandedId === p.id;
          return (
            <div key={p.id} className="group border-b border-zinc-900 border-dashed last:border-none relative">
              {isExpanded && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white" />}
              <button
                className={`w-full px-5 py-4 flex items-start gap-4 transition-colors text-left ${isExpanded ? 'bg-zinc-900/50' : 'hover:bg-zinc-950'}`}
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
                    <div className="mt-4 border border-zinc-800 bg-black p-4">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
                        <MapPin className="w-3 h-3 text-zinc-400" />
                        <span className="text-zinc-400 font-bold uppercase tracking-[0.2em] text-[10px]">Telemetry Raw Data</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(p.tags).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-4 text-[10px]">
                            <span className="text-zinc-600 font-mono uppercase truncate">{TAG_LABELS[key] || key}</span>
                            <span className={`font-mono uppercase text-right truncate ${value === 'yes' ? 'text-emerald-500' : value === 'no' ? 'text-red-500' : 'text-zinc-300'}`}>
                              {value}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between gap-4 mt-2 pt-2 border-t border-zinc-800 border-dashed text-[10px]">
                          <span className="text-zinc-600 font-mono uppercase">LATITUDE</span>
                          <span className="text-zinc-300 font-mono">{p.lat.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-[10px]">
                          <span className="text-zinc-600 font-mono uppercase">LONGITUDE</span>
                          <span className="text-zinc-300 font-mono">{p.lng.toFixed(6)}</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-zinc-800">
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}&zoom=16`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white hover:text-zinc-300 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Verify node online
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
