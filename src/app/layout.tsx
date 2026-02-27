import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'HolaChile - Plataforma de Consulta de Peajes',
  description: 'Visualización interactiva de pórticos TAG y peajes de Chile por HolaChile. Incluye cálculo de rutas, simulación de tráfico y costos detallados.',
  keywords: 'HolaChile, TAG Chile, peajes Chile, pórticos, Autopista Central, Costanera Norte, Vespucio, OpenStreetMap, toll_gantry',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans antialiased bg-slate-950 text-slate-100 h-screen overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
