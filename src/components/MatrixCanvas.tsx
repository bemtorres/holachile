'use client';

import { useEffect, useRef } from 'react';

export default function MatrixCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const chars = '0123456789ABCDEF%@#$&?!<>[]{}|=+-*/';
    const fontSize = 16;
    let columns = Math.floor(canvas.width / fontSize);
    let drops: number[] = new Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px "JetBrains Mono", "Fira Code", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        
        const brightness = Math.random();
        if (brightness > 0.9) {
          ctx.fillStyle = '#ffffff';
        } else if (brightness > 0.7) {
          ctx.fillStyle = '#00ff41';
        } else {
          ctx.fillStyle = 'rgba(0, 255, 65, 0.6)';
        }
        
        ctx.fillText(char, x, y);
        
        if (y > canvas.height && Math.random() > 0.98) {
          drops[i] = 0;
        }
        
        const trailLength = Math.floor(Math.random() * 15) + 5;
        for (let j = 0; j < trailLength; j++) {
          const trailY = y - j * fontSize;
          if (trailY > 0) {
            const alpha = 1 - (j / trailLength);
            ctx.fillStyle = `rgba(0, 255, 65, ${alpha * 0.3})`;
            ctx.fillText(char, x, trailY);
          }
        }
        
        drops[i]++;
      }
      
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ 
        background: 'transparent',
        mixBlendMode: 'screen',
        zIndex: 1
      }}
    />
  );
}
