'use client';

import { useState, useMemo } from 'react';
import { Search, MapPin, Users, Building2, ChevronRight, X, Globe, Instagram, Fingerprint, Scan, ShieldAlert, Terminal, BadgeInfo, Mail, Link as LinkIcon, Lock, User } from 'lucide-react';
import { allComunas, type Comuna } from '@/data';
import ComunaCard from './ComunaCard';

export default function ComunasTab({
  selectedComuna,
  onSelectComuna
}: {
  selectedComuna?: Comuna | null;
  onSelectComuna?: (c: Comuna | null) => void;
}) {
  const [search, setSearch] = useState('');

  const filteredComunas = useMemo(() => {
    return allComunas.filter(c =>
      c.comuna.toLowerCase().includes(search.toLowerCase()) ||
      c.provincia.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 relative overflow-hidden">
      {/* Search Header - now always visible at top */}
      <div className="sticky top-0 z-20 px-6 py-6 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
          <input
            type="text"
            placeholder="Buscar comuna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all shadow-inner"
          />
          {selectedComuna && (
            <button
              onClick={() => onSelectComuna?.(null)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-800 rounded-md text-zinc-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Product-style Cards */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {filteredComunas.map((comuna) => (
            <div
              key={comuna.cut}
              onClick={() => onSelectComuna?.(comuna)}
              className={`group relative bg-zinc-900/30 border rounded-2xl overflow-hidden hover:bg-zinc-900/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-blue-500/5
                ${selectedComuna?.cut === comuna.cut ? 'border-blue-500 bg-blue-500/5 shadow-blue-500/10' : 'border-zinc-800/80 hover:border-zinc-700/50'}`}
            >
              {/* Product Header / Image Placeholder */}
              <div className="h-32 bg-zinc-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-blue-600/10 via-transparent to-purple-600/10" />

                {/* Logo Float */}
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comuna.logo_url}
                    alt={comuna.comuna}
                    className="w-full h-full object-contain drop-shadow-2xl translate-y-2 group-hover:translate-y-0 group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                </div>

                {/* Province Badge */}
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-0.5 rounded-full bg-zinc-950/60 backdrop-blur-md border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-widest shadow-sm">
                    {comuna.provincia.split(' ')[1] || comuna.provincia}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 group-hover:text-blue-400 transition-colors leading-tight">{comuna.comuna}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500 font-medium">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>Distrito RM</span>
                    </div>
                  </div>
                  <div className="bg-blue-500/10 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                </div>

                {/* Key Stats */}
                <div className="grid grid-cols-2 gap-2 border-t border-zinc-800/50 pt-3">
                  <div className="flex flex-col text-center">
                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Población</span>
                    <div className="text-xs font-semibold text-zinc-300">
                      {comuna.poblacion.toLocaleString('es-CL')}
                    </div>
                  </div>
                  <div className="flex flex-col text-center border-l border-zinc-800/50">
                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">CUT</span>
                    <div className="text-xs font-semibold text-zinc-300">
                      {comuna.cut}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Decoration */}
              <div className="h-1 w-0 bg-blue-500 transition-all duration-500 group-hover:w-full opacity-50" />
            </div>
          ))}
        </div>

        {filteredComunas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <Search className="w-10 h-10 text-zinc-800 mb-4" />
            <p className="text-zinc-500 text-sm font-medium">No se encontraron comunas.</p>
          </div>
        )}
      </div>

      {/* Detail Overlay */}
      {selectedComuna && (
        <div className="absolute inset-0 z-30 bg-zinc-950 flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedComuna.logo_url} alt="" className="w-8 h-8 object-contain" />
              <div>
                <h2 className="text-sm font-bold text-zinc-100 tracking-tight">{selectedComuna.comuna}</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{selectedComuna.provincia}</p>
              </div>
            </div>
            <button
              onClick={() => onSelectComuna?.(null)}
              className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
            <ComunaCard comuna={selectedComuna.comuna} />

            {/* Mayor Profile Section - Wanted Style */}
            {selectedComuna.mayores?.actual && (
              <div className="mt-8 font-sans">
                {/* Header Title Outside */}
                <h2 className="text-white text-base sm:text-lg font-bold mb-1 uppercase tracking-wider pl-1 font-arial">
                  {selectedComuna.mayores.actual.name || 'UNKNOWN SUBJECT'}
                </h2>

                {/* Main Card */}
                <div className="relative bg-linear-to-br from-[#1b3a57] to-[#0a192f] border border-[#2c5282] rounded-lg shadow-2xl p-4 overflow-hidden border-t-2 border-t-[#3b82f6]/30">
                  {/* Subtle Map Background Simulation */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at center, #60a5fa 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                  <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent" />

                  <div className="relative z-10 flex flex-row gap-4">
                    {/* Image Area with Silver Border */}
                    <div className="shrink-0 flex flex-col">
                      <div className="w-[100px] sm:w-[120px] aspect-[3/4] rounded-xl border-[4px] border-[#cbd5e1] shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_3px_6px_rgba(255,255,255,0.4)] overflow-hidden bg-slate-800 relative">
                        <div className="absolute top-0 w-full h-1/4 bg-linear-to-b from-white/30 to-transparent z-10 pointer-events-none mix-blend-overlay" />
                        {selectedComuna.mayores.actual.img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedComuna.mayores.actual.img}
                            alt="Subject"
                            className="w-full h-full object-cover object-top filter contrast-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-700">
                            <User className="w-10 h-10 text-slate-400" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Data Area */}
                    <div className="flex-1 flex flex-col justify-between min-w-0 pt-1">
                      <div className="space-y-2 text-xs sm:text-sm text-blue-50/90 leading-snug wrap-break-word">
                        <p>
                          <span className="font-bold text-white">Jurisdiction: </span>
                          Alcaldía de {selectedComuna.comuna}
                        </p>
                        <p>
                          <span className="font-bold text-white">Comms: </span>
                          {selectedComuna.mayores.actual.email || 'N/A'}
                        </p>
                        <p>
                          <span className="font-bold text-white">Digital: </span>
                          {selectedComuna.mayores.actual.instagram ? `@${selectedComuna.mayores.actual.instagram.replace(/\/$/, '').split('/').pop()}` : (selectedComuna.mayores.actual.twitter ? 'X/Twitter account detected' : 'N/A')}
                        </p>
                        <p>
                          <span className="font-bold text-white">Status: </span>
                          Active
                        </p>
                      </div>

                      {/* Pill Button Container */}
                      <div className="flex justify-end mt-4">
                        <div className="bg-linear-to-b from-[#dc2626] to-[#991b1b] text-white text-[10px] sm:text-xs font-bold px-4 pt-1 pb-1.5 rounded-full border-[1.5px] border-[#fca5a5] shadow-[0_2px_4px_rgba(0,0,0,0.5)] cursor-default tracking-wide">
                          Classified Dossier...
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="hidden grid grid-cols-2 gap-4 pb-12">
              <a
                href={selectedComuna.url_municipal}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-2xl py-6 transition-all shadow-lg hover:-translate-y-1"
              >
                <Building2 className="w-6 h-6" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-center">Sitio Municipal</span>
              </a>
              <a
                href={selectedComuna.wiki_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 rounded-2xl py-6 transition-all shadow-lg hover:-translate-y-1"
              >
                <Globe className="w-6 h-6" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-center">Wikipedia</span>
              </a>
              {selectedComuna.mayores?.actual?.web && (
                <a
                  href={selectedComuna.mayores.actual.web}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col col-span-2 items-center justify-center gap-3 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-800/50 text-emerald-400 rounded-2xl py-6 transition-all shadow-lg hover:-translate-y-1 font-mono group"
                >
                  <LinkIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-center">Directorio Autoridades [EXT]</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
