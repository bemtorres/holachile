'use client';

import type { Portico } from '@/data';
import { useState } from 'react';

type PorticoListProps = {
  porticos: (Portico & { autopista: string; color: string })[];
  selectedAutopista: string | null;
  onPorticoClick?: (p: Portico & { autopista: string; color: string }) => void;
};

const TAG_LABELS: Record<string, string> = {
  'highway': 'Tipo vial',
  'operator': 'Operador',
  'name': 'Nombre',
  'ref': 'Referencia',
  'payment:electronic': 'Pago electrónico',
  'payment:cash': 'Pago efectivo',
  'toll': 'Peaje',
  'tunnel': 'Túnel',
  'addr:city': 'Ciudad',
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
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-slate-700/50">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar pórtico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {filtered.length} pórtico{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-700/30">
        {filtered.map((p) => (
          <div key={p.id} className="group">
            <button
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-700/30 transition-colors text-left"
              onClick={() => {
                setExpandedId(expandedId === p.id ? null : p.id);
                onPorticoClick?.(p);
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-200 leading-snug">{p.nombre}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.tramo}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                      style={{ backgroundColor: `${p.color}20`, color: p.color }}
                    >
                      Km {p.km}
                    </span>
                    {p.sentido && (
                      <span className="text-xs text-slate-500">{p.sentido}</span>
                    )}
                    {p.salida && (
                      <span className="text-xs text-slate-500">Salida {p.salida}</span>
                    )}
                  </div>
                </div>

                {/* Expanded OSM tags */}
                {expandedId === p.id && (
                  <div className="mt-3 rounded-lg bg-slate-900/60 border border-slate-700/40 p-3 text-xs">
                    <div className="text-slate-400 font-semibold mb-2 uppercase tracking-wider text-[10px]">OSM Tags</div>
                    <div className="grid grid-cols-1 gap-1">
                      {Object.entries(p.tags).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2">
                          <span className="text-slate-500 font-mono">{TAG_LABELS[key] || key}</span>
                          <span className={`font-medium ${value === 'yes' ? 'text-emerald-400' : value === 'no' ? 'text-red-400' : 'text-slate-300'}`}>
                            {value}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between gap-2 mt-1 pt-1 border-t border-slate-700/40">
                        <span className="text-slate-500 font-mono">Latitud</span>
                        <span className="text-slate-300 font-mono">{p.lat.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500 font-mono">Longitud</span>
                        <span className="text-slate-300 font-mono">{p.lng.toFixed(5)}</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-700/40">
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}&zoom=16`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-[10px] flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Ver en OpenStreetMap
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600">
            <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-sm">No se encontraron pórticos</p>
          </div>
        )}
      </div>
    </div>
  );
}
