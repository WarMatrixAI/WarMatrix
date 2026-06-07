'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProceduralGeneration } from '@/hooks/procedural/useProceduralGeneration';
import { SeedInput } from '@/components/procedural/SeedInput';
import { ProceduralMap } from '@/components/procedural/ProceduralMap';
import { Button } from '@/components/ui/button';
import { Shield, Home, Cpu, Terminal } from 'lucide-react';
import { Courier_Prime } from 'next/font/google';

const courierNew = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
});

export default function ProceduralSandboxPage() {
  const router = useRouter();
  const { mapData, loading, error, generate } = useProceduralGeneration();

  // Active layer visibility toggles
  const [activeLayers, setActiveLayers] = useState({
    roads: true,
    districts: true,
    buildings: true,
    metadata: false,
  });

  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [metadataField, setMetadataField] = useState<'cover' | 'movement' | 'visibility' | 'comms'>('cover');

  // Generate a random 32-bit seed once on page load
  const [initialSeed] = useState(() => Math.floor(Math.random() * 4294967296));

  // Trigger initial generation on page load
  useEffect(() => {
    generate(initialSeed, 'Medium');
  }, [generate, initialSeed]);

  return (
    <div className="flex flex-col h-screen bg-[#02050A] text-[#E6EDF3] overflow-hidden select-none font-mono">
      {/* ── HEADER ── */}
      <header className="h-14 border-b border-[#1F6FEB]/20 bg-[#0F1115] flex items-center justify-between px-6 shrink-0 z-50 shadow-2xl">
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="WARMATRIX logo" className="w-8 h-8 invert brightness-75 cursor-pointer" onClick={() => router.push('/')} />
          <div>
            <h1 className={`${courierNew.className} font-bold text-lg tracking-tight text-[#1F6FEB] uppercase`}>
              WAR<span className="text-[#E6EDF3]">MATRIX</span>
            </h1>
          </div>
          <div className="px-2 py-0.5 rounded-sm border text-[9px] font-bold uppercase tracking-wider bg-[#00e5ff]/10 border-[#00e5ff]/30 text-[#00e5ff] ml-2">
            Procedural Sandbox
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/procedural/editor')}
            className="bg-[#1F6FEB]/10 border-[#1F6FEB]/30 text-[#00e5ff] hover:bg-[#1F6FEB]/25 hover:text-white h-9 px-4 gap-2 text-[10px] uppercase font-bold tracking-widest shadow-[0_0_8px_rgba(0,229,255,0.15)]"
          >
            <Cpu className="w-3.5 h-3.5" /> Asset Scale Editor
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/console')}
            className="bg-[#0D223A] border-[#1F6FEB]/30 text-[#1F6FEB] hover:bg-[#1A3B5D] hover:text-white h-9 px-4 gap-2 text-[10px] uppercase font-bold tracking-widest"
          >
            <Shield className="w-3.5 h-3.5" /> Simulation Console
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="text-[#9CA3AF] hover:text-white h-9 px-3 gap-1.5 text-[10px] uppercase font-bold"
          >
            <Home className="w-3.5 h-3.5" /> Return Home
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[#4B5563]">
            <Cpu className="w-3.5 h-3.5" />
            <span className="text-[9px] font-mono tracking-tighter uppercase">PROC_GEN_V1</span>
          </div>
          <div className="flex items-center gap-2 text-[#4B5563]">
            <Terminal className="w-3.5 h-3.5" />
            <span className="text-[9px] font-mono tracking-tighter uppercase">SECURE_LINK</span>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side Control Panel */}
        <SeedInput
          initialSeed={initialSeed}
          mapData={mapData}
          onGenerate={generate}
          loading={loading}
          activeLayers={activeLayers}
          setActiveLayers={setActiveLayers}
          viewMode={viewMode}
          setViewMode={setViewMode}
          metadataField={metadataField}
          setMetadataField={setMetadataField}
        />

        {/* Right Side Map Display Area */}
        <div className="flex-1 flex flex-col p-6 bg-[#02050A] relative h-full overflow-hidden">
          {error && (
            <div className="absolute top-4 right-4 bg-[#EF4444]/15 border border-[#EF4444]/30 px-4 py-3 rounded text-xs text-[#EF4444] z-50 max-w-sm flex flex-col gap-1 shadow-2xl">
              <span className="font-bold uppercase tracking-wider">Simulation Core Offline</span>
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-[#02050A]/70 backdrop-blur-sm z-40 flex flex-col items-center justify-center font-mono gap-3">
              <div className="w-8 h-8 border-2 border-t-transparent border-[#00e5ff] rounded-full animate-spin shadow-[0_0_15px_#00e5ff]" />
              <span className="text-xs uppercase tracking-widest text-[#00e5ff] animate-pulse">
                Synthesizing Urban Matrix...
              </span>
            </div>
          )}

          <ProceduralMap
            mapData={mapData}
            activeLayers={activeLayers}
            viewMode={viewMode}
            metadataField={metadataField}
          />
        </div>
      </div>
    </div>
  );
}
