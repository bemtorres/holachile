'use client';

import { useState } from 'react';

interface MatrixCommandTerminalProps {
  onCommand?: (command: string, args: string[], onResult: (data: any) => void) => void;
}

const CITIES = [
  'BEIJING', 'SHANGHAI', 'HONG KONG', 'TOKYO', 'SEOUL',
  'TAIPEI', 'BANGKOK', 'SINGAPORE', 'MUMBAI', 'DUBAI',
  'SHENZHEN', 'GUANGZHOU', 'HANOI', 'JAKARTA', 'MANILA',
  'KUALA LUMPUR', 'OSAKA', 'KYOTO', 'BUSAN', 'HO CHI MINH',
];

export default function MatrixCommandTerminal({ onCommand }: MatrixCommandTerminalProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [minimized, setMinimized] = useState(false);

  const addHistory = (lines: string[]) => {
    setHistory(prev => [...prev, ...lines]);
  };

  const handleCommand = (cmd: string) => {
    const parts = cmd.trim().toUpperCase().split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    addHistory([`> ${command}${args.length > 0 ? ' ' + args.join(' ') : ''}`]);
    
    switch (command) {
      case 'HELP':
        addHistory([
          '═══════════════════════════',
          'COMANDOS DISPONIBLES:',
          '═══════════════════════════',
          'HELP        - Mostrar comandos',
          'CLEAR       - Limpiar consola',
          'STATUS      - Estado del sistema',
          'PORTICOS    - Listar pórticos',
          'VERSION     - Versión del sistema',
          'IP          - Mostrar IP actual',
          'MAP         - Ver ayuda de mapa',
          'MAP -C [C]  - Centrar en comuna',
          'RESET       - Reiniciar simulación',
          'COMUNAS     - Listar comunas',
        ]);
        break;
      case 'CLEAR':
        setHistory([]);
        break;
      case 'STATUS':
        addHistory([
          '═══════════════════════════',
          '◆ SISTEMA: ONLINE',
          '◆ CONEXIÓN: SEGURA',
          '◆ NODOS: ' + CITIES.slice(0, 4).join(', '),
          '◆ UPTIME: ' + Math.floor(Math.random() * 9999) + 's',
        ]);
        break;
      case 'VERSION':
        addHistory([
          '═══════════════════════════',
          'TAG CHILE v2.0.0-MATRIX',
          'BUILD: 2026.02.26',
          'PROTOCOL: SECURE/ENCRYPTED',
        ]);
        break;
      case 'IP':
        addHistory([`IP: 192.168.0.${Math.floor(Math.random() * 255)}`]);
        break;
      case 'PORTICOS':
        addHistory([
          '═══════════════════════════',
          'PÓRTICOS: 508',
          'AUTOPISTAS: 35',
          'COMUNAS: 344',
        ]);
        break;
      case 'MAP':
        if (args[0] === '-C' && args[1]) {
          const comunaArg = args.slice(1).join(' ');
          addHistory([
            `>> BUSCANDO COMUNA: ${comunaArg.toUpperCase()}...`,
            '>> ANALIZANDO COORDENADAS...',
            '>> OBTENIENDO DATOS GEOGRAFICOS...',
          ]);
          
          setTimeout(() => {
            onCommand?.('map', [comunaArg], (data) => {
              if (data) {
                addHistory([
                  `>> COMUNA "${data.nombre}" ENCONTRADA`,
                  `>> COORDENADAS: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`,
                  `>> POBLACIÓN: ${data.poblacion?.toLocaleString() || 'N/A'}`,
                  `>> PROVINCIA: ${data.provincia || 'N/A'}`,
                  `>> DIRECCIÓN: ${data.direccion || 'N/A'}`,
                  '>> CENTRANDO MAPA... ✓',
                ]);
              }
            });
          }, 800);
        } else {
          addHistory([
            '═══════════════════════════',
            'MAP COMMANDS:',
            '═══════════════════════════',
            'MAP -C [COMUNA] - Centrar mapa',
            'Ejemplo: MAP -C SANTIAGO',
          ]);
        }
        break;
      case 'COMUNAS':
        addHistory([
          '═══════════════════════════',
          'COMUNAS PRINCIPALES:',
          '═══════════════════════════',
          'SANTIAGO, LAS CONDES, MAIPÚ',
          'PUENTE ALTO, ÑUÑOA, VITACURA',
          'PROVIDENCIA, LA FLORIDA',
          'SAN BERNARDO, LA REINA',
        ]);
        break;
      case 'RESET':
        addHistory(['>> REINICIANDO SIMULACIÓN...']);
        setTimeout(() => {
          setHistory([]);
        }, 1000);
        break;
      default:
        if (command) {
          addHistory([`ERROR: "${command}" no reconocido. Escribe HELP.`]);
        }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(input);
      setInput('');
    }
  };

  return (
    <div className={`fixed bottom-0 right-0 w-96 bg-black/95 border-t border-l border-emerald-500/30 overflow-hidden z-50 font-mono text-[10px] transition-all duration-300 ${minimized ? 'h-8' : 'h-48'} ${minimized ? 'border-b' : 'p-3'}`}>
      <div 
        className="text-emerald-400 text-xs mb-2 border-b border-emerald-500/30 pb-1 flex justify-between items-center cursor-pointer"
        onClick={() => setMinimized(!minimized)}
      >
        <span>◆ TERMINAL DE COMANDOS</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-emerald-600">{minimized ? '▲' : '▼'}</span>
          <span className="animate-pulse">●</span>
        </div>
      </div>
      
      {!minimized && (
        <>
          <div className="space-y-0.5 h-24 overflow-y-auto pr-2 custom-scrollbar">
            {history.map((line, i) => (
              <div key={i} className={`text-[9px] ${line.startsWith('>>') ? 'text-emerald-300' : line.startsWith('◆') ? 'text-yellow-400' : line.startsWith('ERROR') ? 'text-red-400' : 'text-emerald-400'}`}>
                {line}
              </div>
            ))}
          </div>
          
          <div className="mt-2 border-t border-emerald-500/30 pt-2 flex items-center gap-2">
            <span className="text-emerald-400 text-[9px]">{'>>'}</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe comando..."
              className="flex-1 bg-transparent border-none outline-none text-emerald-300 text-[10px] placeholder-emerald-700/50 font-mono"
              autoFocus
            />
          </div>
        </>
      )}
    </div>
  );
}
