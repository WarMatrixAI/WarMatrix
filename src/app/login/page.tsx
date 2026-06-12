"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Terminal, Fingerprint, ChevronRight, Activity, Cpu, Globe, Wifi, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { GEMINI_API_KEY_COOKIE, GEMINI_MODEL_COOKIE, GEMINI_API_KEY_COOKIE_MAX_AGE_SECONDS } from "@/lib/gemini-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- Sub-Components ---

const WireframeGlobe = ({ mousePos }: { mousePos: { x: number; y: number } }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none transition-transform duration-300 ease-out"
         style={{ 
           transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px) scale(1.1)`,
         }}>
      <div className="relative w-[600px] h-[600px]">
        {/* Latitudes */}
        {[...Array(6)].map((_, i) => (
          <div 
            key={`lat-${i}`}
            className="absolute inset-0 border border-[#1F6FEB] rounded-full"
            style={{ 
              transform: `rotateX(${i * 30}deg)`,
              opacity: 0.3 - (i * 0.05)
            }}
          />
        ))}
        {/* Longitudes */}
        {[...Array(6)].map((_, i) => (
          <div 
            key={`long-${i}`}
            className="absolute inset-0 border border-[#1F6FEB] rounded-full"
            style={{ 
              transform: `rotateY(${i * 30}deg)`,
              opacity: 0.3 - (i * 0.05)
            }}
          />
        ))}
        {/* Pulse Effect */}
        <div className="absolute inset-0 border-2 border-[#3A8DFF] rounded-full animate-ping opacity-10" />
      </div>
    </div>
  );
};

const UplinkTerminal = ({ progress }: { progress: number }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const logPool = [
    "ESTABLISHING SATELLITE HANDSHAKE...",
    "NODE: SECTOR-9 CONNECTED",
    "ENCRYPTION: AES-256 INITIALIZED",
    "BYPASSING QUANTUM FIREWALL...",
    "HANDSHAKE: 0x88A2-FF01",
    "UPLINK STRENGTH: 98.4%",
    "SYNCING NEURAL INTERFACE...",
    "AUTHORIZING COMMANDER PRIVILEGES...",
    "DECRYPTING SECURITY PROTOCOLS...",
    "GATEWAY ACCESS: GRANTED",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(prev => {
        const nextLog = logPool[Math.floor(Math.random() * logPool.length)];
        return [...prev.slice(-8), `[${new Date().toLocaleTimeString()}] ${nextLog}`];
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full font-mono text-[11px] text-[#1F6FEB]/80 bg-black/40 p-4 rounded border border-[#1F6FEB]/20 min-h-[160px] flex flex-col gap-1">
      {logs.map((log, i) => (
        <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300">
          {log}
        </div>
      ))}
      <div className="mt-auto pt-4">
        <div className="flex justify-between mb-1">
          <span>CONNECTION STABILITY</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full h-1 bg-[#050810] rounded-full overflow-hidden">
          <div className="h-full bg-[#1F6FEB] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

const DecryptionTerminal = ({ progress }: { progress: number }) => {
  const [hexCode, setHexCode] = useState<string>("0x00000000");

  useEffect(() => {
    const interval = setInterval(() => {
      const randomHex = Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, '0');
      setHexCode(`0x${randomHex}`);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full font-mono text-[11px] text-[#A78BFA] bg-black/40 p-4 rounded border border-[#A78BFA]/20 min-h-[160px] flex flex-col justify-center items-center gap-4">
      <div className="text-[20px] font-bold tracking-[0.2em] animate-pulse">
        {progress >= 100 ? "DECRYPTED" : hexCode}
      </div>
      <div className="w-full">
        <div className="flex justify-between mb-1 text-[9px] uppercase">
          <span>Decryption Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full h-1 bg-[#050810] rounded-full overflow-hidden">
          <div className="h-full bg-[#A78BFA] transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

const NodeSyncTerminal = ({ progress }: { progress: number }) => {
  const [nodes, setNodes] = useState<{ id: string, active: boolean }[]>(
    Array.from({ length: 12 }, (_, i) => ({ id: `N-${i+1}`, active: false }))
  );

  useEffect(() => {
    const activeCount = Math.floor((progress / 100) * 12);
    setNodes(prev => prev.map((n, i) => ({ ...n, active: i < activeCount })));
  }, [progress]);

  return (
    <div className="w-full font-mono text-[11px] text-[#22C55E] bg-black/40 p-4 rounded border border-[#22C55E]/20 min-h-[160px] flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-2">
        {nodes.map(n => (
          <div key={n.id} className={cn("p-1 text-center border text-[9px] transition-colors duration-300", n.active ? "bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]" : "bg-transparent border-[#22C55E]/20 text-[#22C55E]/40")}>
            {n.id}
          </div>
        ))}
      </div>
      <div className="mt-auto">
        <div className="flex justify-between mb-1 text-[9px] uppercase">
          <span>Satellite Network Sync</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full h-1 bg-[#050810] rounded-full overflow-hidden">
          <div className="h-full bg-[#22C55E] transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

// --- Main Page ---

export default function LoginPage() {
  const router = useRouter();
  const [commanderId, setCommanderId] = useState("");
  const [authKey, setAuthKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-3.5-flash");
  const [isVercel, setIsVercel] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"IDLE" | "UPLINKING" | "DECRYPTING_KEY" | "SYNCING_NODES" | "SCANNING" | "VERIFYING" | "SUCCESS">("IDLE");
  const [progress, setProgress] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsVercel(window.location.hostname.endsWith(".vercel.app"));
      
      // Pre-fill existing API key & model if found in cookies
      const matchKey = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${GEMINI_API_KEY_COOKIE}=`));
      if (matchKey) {
        setGeminiApiKey(decodeURIComponent(matchKey.split("=")[1] ?? ""));
      }

      const matchModel = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${GEMINI_MODEL_COOKIE}=`));
      if (matchModel) {
        setGeminiModel(decodeURIComponent(matchModel.split("=")[1] ?? ""));
      }
    }
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth) - 0.5;
    const y = (clientY / innerHeight) - 0.5;
    setMousePos({ x, y });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commanderId || !authKey) {
      setError("COMMANDER ID AND AUTHORIZATION KEY ARE REQUIRED");
      return;
    }

    const trimmedKey = geminiApiKey.trim();
    if (isVercel && !trimmedKey) {
      setError("GEMINI API KEY IS REQUIRED FOR VERCEL DEPLOYMENT");
      return;
    }

    setError("");
    setStatus("UPLINKING");
    let p = 0;
    
    // Step 1: Uplinking (2 seconds)
    const uplinkInterval = setInterval(() => {
      p += 5;
      setProgress(p);
      if (p >= 100) {
        clearInterval(uplinkInterval);
        setStatus("DECRYPTING_KEY");
        p = 0;
        setProgress(0);
        
        // Step 2: Decrypting (2 seconds)
        const decryptInterval = setInterval(() => {
          p += 5;
          setProgress(p);
          if (p >= 100) {
            clearInterval(decryptInterval);
            setStatus("SYNCING_NODES");
            p = 0;
            setProgress(0);
            
            // Step 3: Syncing Nodes (2 seconds)
            const syncInterval = setInterval(() => {
              p += 5;
              setProgress(p);
              if (p >= 100) {
                clearInterval(syncInterval);
                setStatus("SCANNING");
                p = 0;
                setProgress(0);
                
                // Step 4: Scanning (2 seconds)
                const scanInterval = setInterval(() => {
                  p += 5;
                  setProgress(p);
                  if (p >= 100) {
                    clearInterval(scanInterval);
                    setStatus("VERIFYING");
                    setTimeout(() => {
                      setStatus("SUCCESS");
                      localStorage.setItem("warmatrix_auth", "true");
                      localStorage.setItem("warmatrix_auth_expires", (Date.now() + 1000 * 60 * 60 * 24).toString()); // Expires in 24 hours
                      
                      // Save Gemini API key & model to cookie
                      const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
                      if (trimmedKey) {
                        document.cookie = `${GEMINI_API_KEY_COOKIE}=${encodeURIComponent(trimmedKey)}; Path=/; Max-Age=${GEMINI_API_KEY_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;
                        document.cookie = `${GEMINI_MODEL_COOKIE}=${encodeURIComponent(geminiModel)}; Path=/; Max-Age=${GEMINI_API_KEY_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;
                      } else {
                        // Clear cookie if left empty
                        document.cookie = `${GEMINI_API_KEY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
                        document.cookie = `${GEMINI_MODEL_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
                      }

                      setTimeout(() => {
                        const params = new URLSearchParams(window.location.search);
                        const next = params.get('next');
                        router.push(next && next.startsWith('/') ? next : "/console");
                      }, 800);
                    }, 1000);
                  }
                }, 100);
              }
            }, 100);
          }
        }, 100);
      }
    }, 100);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="min-h-screen bg-[#050810] flex items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-[#1F6FEB]/10 blur-[150px] rounded-full transition-transform duration-500 ease-out"
          style={{ transform: `translate(${mousePos.x * 50}px, ${mousePos.y * 50}px) translate(-50%, -50%)` }}
        />
        {/* CRT Scan lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_2px,3px_100%] z-20" />
      </div>

      <WireframeGlobe mousePos={mousePos} />

      <div 
        className="w-full max-w-[450px] relative z-30 transition-transform duration-300 ease-out"
        style={{ 
          transform: `perspective(1000px) rotateY(${mousePos.x * 10}deg) rotateX(${-mousePos.y * 10}deg)`,
          animation: 'fadeIn 1s ease-out' 
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-sm border-2 border-[#1F6FEB] flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(31,111,235,0.3)] bg-[#0A1020]">
            <Shield className="w-8 h-8 text-[#1F6FEB]" />
          </div>
          <h1 className="text-[24px] font-bold text-white uppercase tracking-[0.4em] text-center">
            WAR MATRIX
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3A8DFF] animate-pulse" />
            <span className="text-[10px] font-mono text-[#4B6A8A] uppercase tracking-[0.2em]">
              Authorization Gateway v4.2.0
            </span>
          </div>
        </div>

        {/* Login Card */}
        <div 
          className="bg-[#0A1020]/90 backdrop-blur-xl border border-[#1F6FEB]/30 p-8 rounded-sm shadow-2xl relative overflow-hidden"
          style={{ boxShadow: '0 0 50px rgba(0,0,0,0.8), inset 0 0 20px rgba(31,111,235,0.05)' }}
        >
          {status === "IDLE" ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[#4B6A8A] uppercase tracking-wider pl-1">Commander ID</label>
                <div className="relative">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1F6FEB]/60" />
                  <input 
                    type="text"
                    value={commanderId}
                    onChange={(e) => setCommanderId(e.target.value)}
                    placeholder="E.G. CMD-99"
                    className="w-full bg-[#050810] border border-[#1F6FEB]/30 rounded-sm py-3 pl-10 pr-4 text-[13px] font-mono text-[#E6EDF3] placeholder:text-[#273444] focus:outline-none focus:border-[#1F6FEB] transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[#4B6A8A] uppercase tracking-wider pl-1">Authorization Key</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1F6FEB]/60" />
                  <input 
                    type="password"
                    value={authKey}
                    onChange={(e) => setAuthKey(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#050810] border border-[#1F6FEB]/30 rounded-sm py-3 pl-10 pr-4 text-[13px] font-mono text-[#E6EDF3] placeholder:text-[#273444] focus:outline-none focus:border-[#1F6FEB] transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center pl-1">
                  <label className="text-[10px] font-mono text-[#4B6A8A] uppercase tracking-wider">
                    Gemini API Key
                  </label>
                  {isVercel ? (
                    <span className="text-[9px] font-mono text-[#FCA5A5] uppercase tracking-wider animate-pulse font-bold">
                      * Required on Vercel
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-[#4B6A8A] uppercase tracking-wider">
                      Optional (Local setup)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1F6FEB]/60" />
                  <input 
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="w-full bg-[#050810] border border-[#1F6FEB]/30 rounded-sm py-3 pl-10 pr-4 text-[13px] font-mono text-[#E6EDF3] placeholder:text-[#273444] focus:outline-none focus:border-[#1F6FEB] transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[#4B6A8A] uppercase tracking-wider pl-1">
                  Gemini Model
                </label>
                <Select value={geminiModel} onValueChange={(v) => setGeminiModel(v)}>
                  <SelectTrigger className="w-full h-12 bg-[#050810] border border-[#1F6FEB]/30 rounded-sm px-3 text-[13px] font-mono text-[#E6EDF3] focus:ring-0 focus:border-[#1F6FEB] transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050810] border border-[#1F6FEB]/30 text-white font-mono">
                    <SelectItem value="gemini-3.5-flash">Gemini 3.5 Flash (Default)</SelectItem>
                    <SelectItem value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</SelectItem>
                    <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                    <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                    <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="text-[11px] font-mono text-[#FCA5A5] border border-[#FCA5A5]/30 bg-[#FCA5A5]/10 p-2.5 rounded-sm text-center uppercase tracking-wider font-bold">
                  {error}
                </div>
              )}

              <button 
                type="submit"
                className="mt-4 w-full bg-[#1F6FEB] hover:bg-[#3A8DFF] text-white font-bold py-3.5 rounded-sm uppercase tracking-widest text-[12px] transition-all flex items-center justify-center gap-2 group shadow-[0_0_15px_rgba(31,111,235,0.2)]"
              >
                Intialize Uplink
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : status === "UPLINKING" ? (
            <div className="flex flex-col gap-6 py-2">
              <div className="flex items-center gap-3 text-[#1F6FEB]">
                <Wifi className="w-5 h-5 animate-pulse" />
                <span className="text-[14px] font-mono font-bold uppercase tracking-widest text-white">Global Uplink Establishing...</span>
              </div>
              <UplinkTerminal progress={progress} />
            </div>
          ) : status === "DECRYPTING_KEY" ? (
            <div className="flex flex-col gap-6 py-2">
              <div className="flex items-center gap-3 text-[#A78BFA]">
                <Lock className="w-5 h-5 animate-pulse" />
                <span className="text-[14px] font-mono font-bold uppercase tracking-widest text-white">Decrypting Authorization...</span>
              </div>
              <DecryptionTerminal progress={progress} />
            </div>
          ) : status === "SYNCING_NODES" ? (
            <div className="flex flex-col gap-6 py-2">
              <div className="flex items-center gap-3 text-[#22C55E]">
                <Globe className="w-5 h-5 animate-pulse" />
                <span className="text-[14px] font-mono font-bold uppercase tracking-widest text-white">Syncing Satellite Nodes...</span>
              </div>
              <NodeSyncTerminal progress={progress} />
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 gap-6">
              <div className="relative">
                <div className={cn(
                   "w-24 h-24 rounded-full border-2 border-dashed border-[#1F6FEB]/20 flex items-center justify-center",
                   status === "SCANNING" ? "animate-spin-slow" : ""
                )}>
                  <Fingerprint className={cn(
                    "w-12 h-12 transition-all duration-500",
                    status === "SCANNING" ? "text-[#1F6FEB] scale-110" : 
                    status === "VERIFYING" ? "text-[#A78BFA] scale-125 duration-200" : 
                    "text-[#22C55E] scale-100"
                  )} />
                </div>
                {status === "SCANNING" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-[#3A8DFF]/40 animate-scan-y shadow-[0_0_10px_#3A8DFF]" />
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-[13px] font-mono font-bold text-white uppercase tracking-[0.2em]">
                  {status === "SCANNING" ? "Biometric Scan in Progress..." : 
                   status === "VERIFYING" ? "Verifying Authorization..." : 
                   "Access Granted"}
                </span>
                <div className="w-48 h-1 bg-[#050810] rounded-full overflow-hidden border border-[#1F6FEB]/10">
                  <div 
                    className="h-full bg-[#1F6FEB] transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[#4B6A8A] uppercase tracking-tighter">
                  {status === "SCANNING" ? `${progress}% SCAN COMPLETE` : "ENCRYPTION MATCHED"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 flex items-center justify-between px-2 opacity-50">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-[#1F6FEB]" />
            <span className="text-[9px] font-mono text-[#4B6A8A] uppercase">Encryption: AES-256</span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-3 h-3 text-[#A78BFA]" />
            <span className="text-[9px] font-mono text-[#4B6A8A] uppercase">Node: SECTOR-9</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scan-y {
          0% { transform: translateY(-40px); opacity: 0.2; }
          50% { opacity: 1; }
          100% { transform: translateY(40px); opacity: 0.2; }
        }
        .animate-scan-y {
          animation: scan-y 1.5s infinite ease-in-out;
        }
        .animate-spin-slow {
          animation: spin 12s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
