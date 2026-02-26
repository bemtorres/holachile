'use client';

import { useEffect, useState } from 'react';
import {
  Globe, Users, User, MapPin, Loader2, ExternalLink,
  Building2, Mountain, Hash, Navigation, Scale
} from 'lucide-react';
import comunasData from '@/data/comunas-metropolitanas.json';

// ── types ─────────────────────────────────────────────────────────────────────

interface ComunaLocal {
  comuna: string;
  cut: string;
  lat: number;
  lng: number;
  poblacion: number;
  direccion_municipal: string;
  url_municipal: string;
  wiki_url: string;
  logo_url: string;
}

interface WikiExtra {
  extract?: string;
  description?: string;
  thumbnail?: string;
  alcalde?: string;
  superficie?: string;
  densidad?: string;
  region?: string;
}

// Build a flat lookup: "nombre" → ComunaLocal
const LOCAL_MAP: Record<string, ComunaLocal & { provincia: string }> = {};
for (const [provincia, comunas] of Object.entries(comunasData as Record<string, ComunaLocal[]>)) {
  for (const c of comunas) {
    LOCAL_MAP[c.comuna.toLowerCase()] = { ...c, provincia };
  }
}

function findLocal(nombre: string): (ComunaLocal & { provincia: string }) | undefined {
  return LOCAL_MAP[nombre.toLowerCase()];
}

// ── Wikipedia enrichment ──────────────────────────────────────────────────────

async function fetchWikiExtra(wiki_url: string): Promise<WikiExtra> {
  // Derive the exact Wikipedia page title from our authoritative wiki_url.
  // e.g. "https://es.wikipedia.org/wiki/Cerrillos_(comuna)" → "Cerrillos_(comuna)"
  const rawTitle = wiki_url.split('/wiki/')[1];
  if (!rawTitle) return {};

  // Decode in case the URL itself has %-encoding, then re-encode cleanly for API calls
  const pageTitle = decodeURIComponent(rawTitle);
  const encoded = encodeURIComponent(pageTitle);  // safe for both REST path & query params

  // REST summary (thumbnail + extract)
  let thumbnail: string | undefined;
  let extract: string | undefined;
  let description: string | undefined;
  try {
    const res = await fetch(
      `https://es.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.ok) {
      const d = await res.json();
      thumbnail = d?.thumbnail?.source;
      extract = d?.extract;
      description = d?.description;
    }
  } catch (_) { /* ignore */ }

  // MediaWiki wikitext infobox
  let alcalde: string | undefined;
  let superficie: string | undefined;
  let densidad: string | undefined;
  let region: string | undefined;
  try {
    const mwRes = await fetch(
      `https://es.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=revisions&rvprop=content&rvslots=main&format=json&origin=*`
    );
    if (mwRes.ok) {
      const mwData = await mwRes.json();
      const pages = mwData?.query?.pages;
      const page = Object.values(pages ?? {})[0] as any;
      const wikitext: string = page?.revisions?.[0]?.slots?.main?.['*'] ?? '';

      const ex = (key: string) => {
        const m = wikitext.match(new RegExp(`\\|\\s*${key}\\s*=\\s*([^|\\n}]+)`, 'i'));
        if (!m) return undefined;
        return m[1]
          .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
          .replace(/{{[^}]+}}/g, '')
          .replace(/<[^>]+>/g, '')
          .trim();
      };
      alcalde = ex('alcalde') || ex('alcaldesa') || ex('jefe de gobierno');
      superficie = ex('superficie') || ex('área');
      densidad = ex('densidad');
      region = ex('región') || ex('region');
    }
  } catch (_) { /* ignore */ }

  return { thumbnail, extract, description, alcalde, superficie, densidad, region };
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props { comuna: string; }

export default function ComunaCard({ comuna }: Props) {
  const local = findLocal(comuna);
  const [wiki, setWiki] = useState<WikiExtra | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastComuna, setLastComuna] = useState('');

  useEffect(() => {
    if (!comuna || comuna === lastComuna) return;
    setLastComuna(comuna);
    setWiki(null);
    if (!local) return;           // no local data → skip
    setLoading(true);
    fetchWikiExtra(local.wiki_url)
      .then(setWiki)
      .catch(() => setWiki({}))
      .finally(() => setLoading(false));
  }, [comuna, lastComuna, local]);

  if (!comuna) return null;

  // ── No local data ─────────────────────────────────────────────────────────
  if (!local) {
    return (
      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center">
        <p className="text-xs text-zinc-500">
          No se encontraron datos locales para <span className="text-zinc-400 font-medium">{comuna}</span>.
        </p>
      </div>
    );
  }

  const heroImage = wiki?.thumbnail;
  const displayPop = local.poblacion.toLocaleString('es-CL');

  return (
    <div className="mt-4 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950 shadow-lg">

      {/* ── Hero image / header ── */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: 100 }}>
        {heroImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={`Foto de ${comuna}`}
              className="w-full h-36 object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          </>
        ) : (
          <div className="w-full h-24 bg-linear-to-br from-zinc-900 to-zinc-950" />
        )}

        {/* Logo + name */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 px-3 pb-3">
          {/* Municipality shield */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={local.logo_url}
            alt={`Escudo ${local.comuna}`}
            className="w-10 h-10 object-contain drop-shadow-lg rounded"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <h3 className="text-sm font-bold text-white leading-tight drop-shadow">{local.comuna}</h3>
            {wiki?.description && (
              <p className="text-[10px] text-zinc-300 drop-shadow leading-tight">{wiki.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── CUT + provincia badge ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
          <Hash className="w-2.5 h-2.5" /> CUT {local.cut}
        </span>
        <span className="ml-auto text-[9px] font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-900/40 px-2 py-0.5 rounded-full">
          {local.provincia}
        </span>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {/* Population (local → always present) */}
        <StatChip
          icon={<Users className="w-3 h-3 text-emerald-400" />}
          label="Población"
          value={displayPop}
          color="emerald"
        />

        {/* Coords */}
        <StatChip
          icon={<Navigation className="w-3 h-3 text-sky-400" />}
          label="Coordenadas"
          value={`${local.lat.toFixed(4)}, ${local.lng.toFixed(4)}`}
          color="sky"
        />

        {/* Superficie (wiki) */}
        {wiki?.superficie && (
          <StatChip
            icon={<Scale className="w-3 h-3 text-blue-400" />}
            label="Superficie"
            value={`${wiki.superficie} km²`}
            color="blue"
          />
        )}

        {/* Densidad (wiki) */}
        {wiki?.densidad && (
          <StatChip
            icon={<Users className="w-3 h-3 text-orange-400" />}
            label="Densidad"
            value={`${wiki.densidad} hab/km²`}
            color="orange"
          />
        )}

        {/* Region (wiki or static) */}
        {(wiki?.region || true) && (
          <StatChip
            icon={<Mountain className="w-3 h-3 text-purple-400" />}
            label="Región"
            value={wiki?.region ?? 'Región Metropolitana de Santiago'}
            color="purple"
          />
        )}
      </div>

      {/* ── Alcalde (wiki, async) ── */}
      {loading && (
        <div className="flex items-center gap-2 px-3 pb-2 text-zinc-600">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[9px]">Cargando Wikipedia…</span>
        </div>
      )}
      {!loading && wiki?.alcalde && (
        <div className="mx-3 mb-3 flex flex-col bg-zinc-900/60 border border-yellow-900/30 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <User className="w-3 h-3 text-yellow-400" />
            <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Alcalde/sa</span>
          </div>
          <span className="text-xs font-semibold text-yellow-300 leading-tight">{wiki.alcalde}</span>
        </div>
      )}

      {/* ── Address ── */}
      <div className="mx-3 mb-3 flex items-start gap-2 bg-zinc-900/40 border border-zinc-800 rounded-lg p-2.5">
        <MapPin className="w-3 h-3 text-rose-400 mt-0.5 shrink-0" />
        <span className="text-[10px] text-zinc-300 leading-snug">{local.direccion_municipal}</span>
      </div>

      {/* ── Extract ── */}
      {wiki?.extract && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-4">{wiki.extract}</p>
        </div>
      )}

      {/* ── Links row ── */}
      <div className="flex items-center gap-2 px-3 pb-3 flex-wrap">
        <a
          href={local.wiki_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Globe className="w-3 h-3" />
          Wikipedia
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
        <span className="text-zinc-700">·</span>
        <a
          href={local.url_municipal}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <Building2 className="w-3 h-3" />
          Municipio
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
        <a
          href={`https://www.google.com/maps?q=${local.lat},${local.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
        >
          <MapPin className="w-3 h-3" />
          Mapa
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function StatChip({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'emerald' | 'blue' | 'sky' | 'purple' | 'zinc' | 'orange';
}) {
  const border = {
    emerald: 'border-emerald-900/40',
    blue: 'border-blue-900/40',
    sky: 'border-sky-900/40',
    purple: 'border-purple-900/40',
    zinc: 'border-zinc-800',
    orange: 'border-orange-900/40',
  }[color];

  return (
    <div className={`flex flex-col bg-zinc-900/60 border ${border} rounded-lg p-2.5`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs font-semibold text-zinc-200 leading-tight truncate" title={value}>
        {value}
      </span>
    </div>
  );
}
