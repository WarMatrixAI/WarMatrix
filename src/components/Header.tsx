'use client';

import React from 'react';
import { Courier_Prime } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { Cpu, Terminal, Settings2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const courierNew = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
});

interface HeaderProps {
  turn: number;
  status: 'ACTIVE' | 'AWAITING COMMAND' | 'PROCESSING';
  onOpenBuilder: () => void;
  role?: 'BLUE_TEAM' | 'RED_TEAM';
  onRoleSwitch?: (role: 'BLUE_TEAM' | 'RED_TEAM') => void;
  modelInfo?: { service: string; model: string; model_loaded: boolean } | null;
  geminiModel?: string;
  onModelChange?: (model: string) => void;
}

export function Header({ turn, status, onOpenBuilder, role, onRoleSwitch, modelInfo, geminiModel, onModelChange }: HeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("warmatrix_auth");
    localStorage.removeItem("warmatrix_auth_expires");
    router.push('/');
  };

  return (
    <header className="h-14 border-b border-[#1F6FEB]/20 bg-[#0F1115] grid grid-cols-3 items-center px-6 shrink-0 z-50 shadow-2xl">
      {/* LEFT: Logo Section */}
      <div className="flex items-center gap-6 justify-self-start">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="WARMATRIX logo" className="w-8 h-8 invert brightness-75" />
          <div>
            <h1 className={`${courierNew.className} font-bold text-lg tracking-tight text-[#1F6FEB] uppercase`}>
              WAR<span className="text-[#E6EDF3]">MATRIX</span>
            </h1>
          </div>
        </div>
        {role && (
          <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded-sm border text-[9px] font-bold uppercase tracking-wider ${role === 'BLUE_TEAM' ? 'bg-[#1F6FEB]/10 border-[#1F6FEB]/30 text-[#1F6FEB]' : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'}`}>
              {role === 'BLUE_TEAM' ? 'Friendly Forces' : 'Hostile Perspective'}
            </div>
            {onRoleSwitch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRoleSwitch(role === 'BLUE_TEAM' ? 'RED_TEAM' : 'BLUE_TEAM')}
                className="h-6 px-1.5 text-[7px] font-mono text-[#4B5563] hover:text-[#E6EDF3] uppercase"
              >
                Switch
              </Button>
            )}
          </div>
        )}
      </div>

      {/* CENTER: Mission Status (Perfectly Centered) */}
      <div className="flex items-center gap-8 justify-self-center">
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-[0.2em] mb-0.5">Mission Turn</span>
          <span className="font-headline text-xl leading-none text-[#E6EDF3] tracking-tighter">{turn.toString().padStart(3, '0')}</span>
        </div>

        <div className="h-8 w-px bg-[#1F6FEB]/20" />

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-[0.2em] mb-0.5">System Link</span>
            <span className={`text-[10px] font-bold ${status === 'ACTIVE' ? 'text-[#22C55E]' : status === 'PROCESSING' ? 'text-[#F59E0B]' : 'text-[#1F6FEB]'} flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-[#22C55E] animate-pulse shadow-[0_0_5px_#22C55E]' : status === 'PROCESSING' ? 'bg-[#F59E0B] animate-pulse shadow-[0_0_5px_#F59E0B]' : 'bg-[#1F6FEB]'}`} />
              {status}
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-[#1F6FEB]/20" />

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenBuilder}
          className="bg-[#0D223A] border-[#1F6FEB]/30 text-[#1F6FEB] hover:bg-[#1A3B5D] hover:text-white h-9 px-4 gap-2 text-[10px] uppercase font-bold tracking-widest"
        >
          <Settings2 className="w-3.5 h-3.5" /> Scenario Builder
        </Button>
      </div>

      {/* RIGHT: System Indicators */}
      <div className="flex items-center gap-4 justify-self-end">
        {modelInfo && modelInfo.service === 'gemini-api' && onModelChange && (
          <div className="flex items-center gap-2 mr-2">
            <span className="text-[8px] font-mono text-[#8B5CF6] uppercase tracking-wider">CORE:</span>
            <Select value={geminiModel} onValueChange={onModelChange}>
              <SelectTrigger className="h-7 w-[160px] bg-[#050810]/80 border border-[#8B5CF6]/30 hover:border-[#8B5CF6]/60 rounded-sm px-2 text-[9px] font-mono text-[#E6EDF3] focus:ring-0 focus:border-[#8B5CF6] transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#050810] border border-[#8B5CF6]/30 text-white font-mono">
                <SelectItem value="gemini-3.5-flash">Gemini 3.5 Flash</SelectItem>
                <SelectItem value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</SelectItem>
                <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {modelInfo && modelInfo.service !== 'gemini-api' && (
          <div className="flex items-center gap-1.5 mr-2" title={modelInfo.model}>
            <span className="text-[8px] font-mono text-[#4D637F] uppercase tracking-wider">LOCAL:</span>
            <span className="text-[9px] font-mono text-[#8B9EB7] max-w-[100px] truncate select-none border border-[#1F6FEB]/15 bg-[#050810]/40 rounded-sm px-1.5 py-0.5">{modelInfo.model}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-[#4B5563]">
          <Cpu className="w-3.5 h-3.5" />
          <span className="text-[9px] font-mono tracking-tighter uppercase">N_77_BETA</span>
        </div>
        <div className="flex items-center gap-2 text-[#4B5563]">
          <Terminal className="w-3.5 h-3.5" />
          <span className="text-[9px] font-mono tracking-tighter uppercase">SEC_UPLINK</span>
        </div>

        <div className="h-5 w-px bg-[#1F6FEB]/20 mx-1" />

        <button 
           onClick={handleLogout}
           className="flex items-center gap-1.5 text-[#4B5563] hover:text-[#EF4444] transition-colors group ml-2"
           title="Terminate Secure Session"
        >
           <LogOut className="w-3.5 h-3.5" />
           <span className="text-[9px] font-bold tracking-[0.1em] uppercase opacity-0 group-hover:opacity-100 transition-opacity w-0 group-hover:w-auto overflow-hidden text-nowrap block">EXTRICATION</span>
        </button>
      </div>
    </header>
  );
}
