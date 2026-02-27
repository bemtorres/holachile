'use client';

import { useState, useEffect } from 'react';

interface MatrixConsoleProps {
  onCommand?: (command: string, args: string[], onResult: (data: any) => void) => void;
}

const MESSAGES = [
  { text: '> INICIANDO PROTOCOLO DE ACCESO...', delay: 500 },
  { text: '> ESCANEANDO REDES DISPONIBLES...', delay: 800 },
  { text: '> BYPASSANDO FIREWALL SEGURIDAD...', delay: 600 },
  { text: '> CAMBIANDO DIRECCIÓN IP...', delay: 1200, dynamic: true },
  { text: '> ESTABLECIENDO CONEXIÓN SEGURA...', delay: 900 },
  { text: '> RECONECTANDO SERVIDOR...', delay: 1500, dynamic: true },
  { text: '> OPERANDO EN RED MOSKU...', delay: 700 },
  { text: '> ACCEDIENDO A BASES DE DATOS...', delay: 1000 },
  { text: '> RUTEANDO TRAFICO INTERNACIONAL...', delay: 800 },
  { text: '> ESTABLECIENDO NODOS DE CONEXIÓN...', delay: 600 },
];

const CITIES = [
  'BEIJING', 'SHANGHAI', 'HONG KONG', 'TOKYO', 'SEOUL',
  'TAIPEI', 'BANGKOK', 'SINGAPORE', 'MUMBAI', 'DUBAI',
  'SHENZHEN', 'GUANGZHOU', 'HANOI', 'JAKARTA', 'MANILA',
  'KUALA LUMPUR', 'OSAKA', 'KYOTO', 'BUSAN', 'HO CHI MINH',
];

const IP_PREFIXES = [
  '192.168.', '10.0.', '172.16.', '203.0.', '45.32.', 
  '89.12.', '101.2.', '175.4.', '221.0.', '180.15.',
];

export default function MatrixConsole({ onCommand }: MatrixConsoleProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [currentMsg, setCurrentMsg] = useState(0);
  const [showCities, setShowCities] = useState(false);
  const [ipAddress, setIpAddress] = useState('***.***.***.***');
  const [history, setHistory] = useState<string[]>([]);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (currentMsg >= MESSAGES.length) {
      setShowCities(true);
      return;
    }

    const msg = MESSAGES[currentMsg];
    
    const showText = () => {
      setLines(prev => [...prev, msg.text]);
      
      if (msg.dynamic) {
        const interval = setInterval(() => {
          const prefix = IP_PREFIXES[Math.floor(Math.random() * IP_PREFIXES.length)];
          const suffix = Math.floor(Math.random() * 255);
          setIpAddress(`${prefix}${suffix}`);
        }, 100);
        
        setTimeout(() => {
          clearInterval(interval);
          setIpAddress('***.***.***.***');
        }, msg.delay - 200);
      }
      
      setCurrentMsg(prev => prev + 1);
    };

    const timer = setTimeout(showText, msg.delay);
    return () => clearTimeout(timer);
  }, [currentMsg]);

  const addHistory = (newLines: string[]) => {
    setHistory(prev => [...prev, ...newLines]);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory(prev => {
        if (prev.length > 50) return prev.slice(-30);
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`fixed bottom-0 left-0 w-80 bg-black/95 border-t border-r border-emerald-500/30 overflow-hidden z-50 font-mono text-[10px] transition-all duration-300 ${minimized ? 'h-8' : 'h-72'} ${minimized ? 'border-b' : 'p-3'}`}>
      <div 
        className="text-emerald-400 text-xs mb-2 border-b border-emerald-500/30 pb-1 flex justify-between items-center cursor-pointer"
        onClick={() => setMinimized(!minimized)}
      >
        <span>◆ TERMINAL DE ACCESO REMOTO</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-emerald-600">{minimized ? '▲' : '▼'}</span>
          <span className="animate-pulse">●</span>
        </div>
      </div>
      
      {!minimized && (
        <>
          <div className="space-y-0.5 h-44 overflow-y-auto pr-2 custom-scrollbar">
            {lines.map((line, i) => (
              <div key={i} className="text-emerald-400 opacity-80">
                {line}
              </div>
            ))}
            
            {history.map((line, i) => (
              <div key={`h-${i}`} className="text-emerald-300 text-[9px]">
                {line}
              </div>
            ))}
            
            {showCities && (
              <div className="mt-2 pt-2 border-t border-emerald-500/30">
                <div className="text-yellow-400 mb-1">{'>'} CONEXIONES ACTIVAS:</div>
                <div className="grid grid-cols-2 gap-1">
                  {CITIES.slice(0, 6).map((city) => (
                    <div key={city} className="text-emerald-300 text-[9px]">
                      ● {city}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
