import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'TAG Chile - Pórticos de Peaje | OpenStreetMap',
  description: 'Visualización interactiva de pórticos TAG y peajes de Chile extraídos de OpenStreetMap. Incluye Autopista Central, Costanera Norte, Vespucio Norte/Sur y AVO I.',
  keywords: 'TAG Chile, peajes Chile, pórticos, Autopista Central, Costanera Norte, Vespucio, OpenStreetMap, toll_gantry',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-slate-950 text-slate-100 h-screen overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
