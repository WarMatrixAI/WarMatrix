'use client';

import React, { useState } from 'react';
import { AITerminalConsole, makeLog, LogEntry } from '@/components/AITerminalConsole';
import {
  Settings2,
  Plus,
  Trash2,
  Shield,
  Swords,
  Crosshair,
  Building2,
  Truck,
  Radio,
  Zap,
  Eye,
  Target,
  ChevronRight,
  ChevronLeft,
  MapPin,
  BrainCircuit,
  Wrench,
  Shuffle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Map,
  LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GenerateScenarioInput, GenerateScenarioOutput } from '@/ai/flows/generate-scenario';
import { GEMINI_MODEL_COOKIE, GEMINI_API_KEY_COOKIE_MAX_AGE_SECONDS } from '@/lib/gemini-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryMode = null | 'CUSTOM' | 'AI';
type UnitType = 'FRIENDLY' | 'ENEMY' | 'OBJECTIVE' | 'NEUTRAL' | 'INFRASTRUCTURE';
type TerrainType = 'Highland' | 'Forest' | 'Urban' | 'Plains' | 'Desert' | 'Mountain' | 'Coastal' | 'Arctic';
type WeatherType = 'Clear' | 'Partly Cloudy' | 'Storm' | 'Fog' | 'Heavy Rain' | 'Sandstorm';
type ForceBalance = 'Balanced Forces' | 'Friendly Advantage' | 'Hostile Advantage';
type ObjectiveType = 'Capture Territory' | 'Defend Position' | 'Supply Route Control' | 'Recon Operation';

type AssetClass =
  | 'Infantry'
  | 'Mechanized'
  | 'Armor'
  | 'Artillery'
  | 'Recon'
  | 'Logistics'
  | 'Command Unit'
  | 'Infrastructure'
  | 'Objective';

interface Unit {
  id: string;
  type: 'FRIENDLY' | 'ENEMY' | 'OBJECTIVE';
  x: number;
  y: number;
  label: string;
  assetClass?: AssetClass;
  allianceRole?: string;
}

interface ScenarioBuilderProps {
  units: Unit[];
  onUpdateUnits: (units: Unit[]) => void;
  isOpen: boolean;
  onClose: () => void;
  onScenarioGenerated?: (scenario: GenerateScenarioOutput, terrainType: TerrainType) => void;
  onBriefingGenerated?: (title: string, briefing: string) => void;
  onOperationConfigured?: (name: string, terrain: TerrainType, weather: WeatherType) => void;
  initialMode?: EntryMode;
  isInline?: boolean;
  modelInfo?: { service: string; model: string; model_loaded: boolean } | null;
  geminiModel?: string;
  onModelChange?: (model: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CLASSES: { label: AssetClass; icon: LucideIcon }[] = [
  { label: 'Infantry', icon: Shield },
  { label: 'Mechanized', icon: Zap },
  { label: 'Armor', icon: Swords },
  { label: 'Artillery', icon: Target },
  { label: 'Recon', icon: Eye },
  { label: 'Logistics', icon: Truck },
  { label: 'Command Unit', icon: Radio },
];

const ALLIANCE_OPTIONS: { value: UnitType; label: string }[] = [
  { value: 'FRIENDLY', label: 'Friendly (Blue Team)' },
  { value: 'ENEMY', label: 'Hostile (Red Team)' },
  { value: 'NEUTRAL', label: 'Objective' },
];

const TERRAIN_TYPES: TerrainType[] = ['Desert', 'Urban', 'Mountain', 'Forest', 'Coastal', 'Arctic'];
const WEATHER_TYPES: WeatherType[] = ['Clear', 'Partly Cloudy', 'Storm', 'Fog', 'Heavy Rain', 'Sandstorm'];
const AI_TERRAIN_TYPES: TerrainType[] = ['Highland', 'Forest', 'Urban', 'Plains', 'Desert'];
const FORCE_BALANCES: ForceBalance[] = ['Balanced Forces', 'Friendly Advantage', 'Hostile Advantage'];
const OBJECTIVE_TYPES: ObjectiveType[] = ['Capture Territory', 'Defend Position', 'Supply Route Control', 'Recon Operation'];

function cleanErrorText(rawError: string | null): string {
  if (!rawError) return '';
  const jsonMatch = rawError.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.details) return parsed.details;
      if (parsed.error) return parsed.error;
    } catch {}
  }
  return rawError.replace(/^Local backend error \(\d+\):\s*/, '');
}

function isHighDemandError(errorText: string | null, isGemini: boolean): boolean {
  if (!errorText) return false;
  const cleaned = cleanErrorText(errorText).toLowerCase();
  const rawLower = errorText.toLowerCase();
  return (
    isGemini && (
      cleaned.includes('experiencing high demand') ||
      cleaned.includes('high demand') ||
      cleaned.includes('overloaded') ||
      cleaned.includes('resource_exhausted') ||
      cleaned.includes('resource exhausted') ||
      cleaned.includes('rate limit') ||
      cleaned.includes('quota') ||
      cleaned.includes('limit') ||
      rawLower.includes('503') ||
      rawLower.includes('429')
    )
  );
}

function getReadableErrorMessage(errorText: string | null, isGemini: boolean): string {
  if (!errorText) return 'An unknown error occurred during scenario generation.';
  const cleaned = cleanErrorText(errorText);
  const rawLower = errorText.toLowerCase();

  if (rawLower.includes('gemini_key_required') || rawLower.includes('key_required') || rawLower.includes('api key must be entered')) {
    return 'Gemini API key is missing or invalid. Please check your credentials and save a valid API key in the Uplink Portal.';
  }

  if (rawLower.includes('connection refused') || rawLower.includes('econnrefused') || rawLower.includes('failed to fetch') || rawLower.includes('offline') || rawLower.includes('ai_server_offline')) {
    return 'Could not establish connection with the AI core. Ensure your local wargame server or Python backend is running on the correct port.';
  }

  if (isHighDemandError(errorText, isGemini)) {
    return `AI Core capacity reached: "${cleaned}". The service is currently experiencing high demand or rate limits.`;
  }

  return cleaned || 'The AI strategizing sequence was interrupted by an unexpected processing error.';
}

const MISSION_CONTEXT_TEMPLATES = [
  'Forward elements have reported hostile incursion across the northern ridge. Command requires immediate assessment and counter-offensive positioning.',
  'Coalition forces are consolidating supply lines through contested valley terrain. Enemy recon units have been sighted in the vicinity.',
  'Urban district has fallen into contested status following civilian evacuation. Tactical sweep authorized to establish perimeter control.',
  'Intelligence indicates a sizeable enemy armored column is advancing along the eastern flank. Defensive positions must be established immediately.',
  'A joint operation to capture the strategic hilltop observation post is underway. Air support is unavailable due to adverse weather conditions.',
  'Enemy forces have established a fortified outpost near the water treatment facility. Friendly forces must displace them without structural damage.',
  'Recon elements report enemy logistics depot in Sector 7. Interdiction mission approved. Precision strike assets are on standby.',
];

// Map extended UnitType → core grid type
function toGridType(role: UnitType): 'FRIENDLY' | 'ENEMY' | 'OBJECTIVE' {
  if (role === 'ENEMY') return 'ENEMY';
  if (role === 'OBJECTIVE' || role === 'NEUTRAL' || role === 'INFRASTRUCTURE') return 'OBJECTIVE';
  return 'FRIENDLY';
}

const roleStyle: Record<string, { color: string; label: string }> = {
  FRIENDLY: { color: '#22C55E', label: 'Friendly' },
  ENEMY: { color: '#EF4444', label: 'Hostile' },
  NEUTRAL: { color: '#9CA3AF', label: 'Neutral' },
  INFRASTRUCTURE: { color: '#60A5FA', label: 'Infrastructure' },
  OBJECTIVE: { color: '#F59E0B', label: 'Objective' },
};

function UnitIcon({ type }: { type: 'FRIENDLY' | 'ENEMY' | 'OBJECTIVE' }) {
  if (type === 'FRIENDLY') return <Shield className="w-3.5 h-3.5 text-[#22C55E]" />;
  if (type === 'ENEMY') return <Swords className="w-3.5 h-3.5 text-[#EF4444]" />;
  return <Crosshair className="w-3.5 h-3.5 text-[#F59E0B]" />;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── AI Mode State ─────────────────────────────────────────────────────────────

type AIGenStatus = 'idle' | 'rolling' | 'generating' | 'done' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export function ScenarioBuilder({
  units,
  onUpdateUnits,
  isOpen,
  onClose,
  onScenarioGenerated,
  onBriefingGenerated,
  onOperationConfigured,
  initialMode = null,
  isInline = false,
  modelInfo: propModelInfo,
  geminiModel: propGeminiModel,
  onModelChange: propOnModelChange,
}: ScenarioBuilderProps) {

  // ── Entry mode gate ──────────────────────────────────────────────────────────
  const [entryMode, setEntryMode] = useState<EntryMode>(initialMode);

  const [internalModelInfo, setInternalModelInfo] = useState<{
    service: string;
    model: string;
    model_loaded: boolean;
  } | null>(null);

  const [internalGeminiModel, setInternalGeminiModel] = useState('gemini-3.5-flash');

  const modelInfo = propModelInfo !== undefined ? propModelInfo : internalModelInfo;
  const geminiModel = propGeminiModel !== undefined ? propGeminiModel : internalGeminiModel;
  const setModelInfo = propModelInfo !== undefined ? () => {} : setInternalModelInfo;

  React.useEffect(() => {
    if (isOpen && propModelInfo === undefined) {
      // Get model info from backend health check only if not provided by parent
      fetch('/api/sitrep')
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            const info = {
              service: data.service || 'local',
              model: data.model || 'Local Model',
              model_loaded: !!data.model_loaded,
            };
            setInternalModelInfo(info);
            if (data.service === 'gemini-api' && data.model) {
              setInternalGeminiModel(data.model);
            }
            pushLog('SYS', `Operational AI Core: ${info.service.toUpperCase()} // ${info.model}`);
          } else {
            setInternalModelInfo(null);
            pushLog('ERR', 'AI Server status offline or unreachable.');
          }
        })
        .catch(() => {
          setInternalModelInfo(null);
          pushLog('ERR', 'AI Server status offline or unreachable.');
        });
    } else if (isOpen && propModelInfo) {
      pushLog('SYS', `Operational AI Core: ${propModelInfo.service.toUpperCase()} // ${propModelInfo.model}`);
    }
  }, [isOpen, propModelInfo]);

  const handleModelChange = (val: string) => {
    if (propOnModelChange) {
      propOnModelChange(val);
    } else {
      setInternalGeminiModel(val);
      setInternalModelInfo(prev => prev ? { ...prev, model: val } : null);
      const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${GEMINI_MODEL_COOKIE}=${encodeURIComponent(val)}; Path=/; Max-Age=${GEMINI_API_KEY_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;
    }
    pushLog('SYS', `Selected Gemini Model switched to: ${val}`);
  };

  // ── Reset state on open ──────────────────────────────────────────────────────
  React.useEffect(() => {
    if (isOpen) {
      setEntryMode(initialMode);
      setAiStatus('idle');
      setAiResult(null);
      setAiError(null);
      setAiParams(null);
      setRollStep(0);
      setTermLogs([]);
      setNewLabel('');
      setGridX('');
      setGridY('');
      setOperationName('');
      setSelectedTerrain('Urban');
      setSelectedWeather('Clear');
    }
  }, [isOpen, initialMode]);

  // ── Scenario configuration state ─────────────────────────────────────────────
  const [operationName, setOperationName] = useState('');
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>('Urban');
  const [selectedWeather, setSelectedWeather] = useState<WeatherType>('Clear');

  // ── Manual deployment state ──────────────────────────────────────────────────
  const [newLabel, setNewLabel] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('Infantry');
  const [allianceRole, setAllianceRole] = useState<UnitType>('FRIENDLY');
  const [gridX, setGridX] = useState('');
  const [gridY, setGridY] = useState('');

  // ── AI generation state ──────────────────────────────────────────────────────
  const [aiStatus, setAiStatus] = useState<AIGenStatus>('idle');
  const [aiParams, setAiParams] = useState<GenerateScenarioInput | null>(null);
  const [aiResult, setAiResult] = useState<GenerateScenarioOutput | null>(null);
  const [aiTerrain, setAiTerrain] = useState<TerrainType>('Highland');
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rollStep, setRollStep] = useState(0);
  const [termLogs, setTermLogs] = useState<LogEntry[]>([]);

  const pushLog = (level: LogEntry['level'], msg: string) =>
    setTermLogs(prev => [...prev, makeLog(level, msg)]);

  // ── Deploy ───────────────────────────────────────────────────────────────────
  const handleDeploy = () => {
    if (!newLabel.trim()) return;
    const x = Math.max(1, Math.min(44, parseInt(gridX) || Math.floor(Math.random() * 44) + 1));
    const y = Math.max(1, Math.min(28, parseInt(gridY) || Math.floor(Math.random() * 28) + 1));
    onUpdateUnits([...units, {
      id: Math.random().toString(36).substr(2, 9),
      type: toGridType(allianceRole),
      x, y,
      label: newLabel.trim(),
      assetClass,
      allianceRole,
    }]);
    setNewLabel('');
    setGridX('');
    setGridY('');
  };

  // ── Remove ───────────────────────────────────────────────────────────────────
  const handleRemove = (id: string) => onUpdateUnits(units.filter(u => u.id !== id));

  // ── Random scenario generation ────────────────────────────────────────────────
  const handleRandomGenerate = async () => {
    setAiError(null);
    setAiResult(null);
    setAiStatus('rolling');
    setRollStep(0);
    setTermLogs([]);

    // Roll random values
    const terrain = pickRandom(AI_TERRAIN_TYPES);
    const forceBalance = pickRandom(FORCE_BALANCES);
    const objectiveType = pickRandom(OBJECTIVE_TYPES);
    const missionContext = pickRandom(MISSION_CONTEXT_TEMPLATES);

    const params: GenerateScenarioInput = {
      missionContext,
      terrainType: terrain as GenerateScenarioInput['terrainType'],
      forceBalance,
      objectiveType,
    };

    setAiTerrain(terrain);
    setAiParams(params);

    // ── Terminal log: parameter roll ──
    pushLog('SYS', 'WARMATRIX SCENARIO ENGINE — initialising');
    pushLog('SYS', 'Random parameter generator activated');

    await new Promise(r => setTimeout(r, 400));
    setRollStep(1);
    pushLog('DATA', `TERRAIN_TYPE    = ${terrain}`);

    await new Promise(r => setTimeout(r, 350));
    setRollStep(2);
    pushLog('DATA', `FORCE_BALANCE   = ${forceBalance}`);

    await new Promise(r => setTimeout(r, 350));
    setRollStep(3);
    pushLog('DATA', `OBJECTIVE_TYPE  = ${objectiveType}`);

    await new Promise(r => setTimeout(r, 350));
    setRollStep(4);
    pushLog('DATA', `MISSION_CONTEXT = "${missionContext.slice(0, 70)}…"`);
    await new Promise(r => setTimeout(r, 300));

    // ── Terminal log: AI call ──
    setAiStatus('generating');
    pushLog('INFO', '─'.repeat(44));
    pushLog('PROC', 'Sending request to models...');
    pushLog('PROC', 'Awaiting model inference...');

    const t0 = Date.now();
    try {
      const res = await fetch('/api/generate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const raw = await res.text();
      let payload: any = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        throw new Error(
          payload?.details ||
          payload?.error ||
          raw ||
          `Scenario API failed (${res.status})`,
        );
      }

      if (!payload) {
        throw new Error('Scenario API returned a non-JSON response.');
      }

      const result = payload as GenerateScenarioOutput;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      pushLog('OK', `Response received in ${elapsed}s`);
      pushLog('OK', `Scenario title: "${result.scenarioTitle}"`);
      pushLog('DATA', `Topography map dict: ${result.mapPeaks?.length || 0} peaks matched`);
      if (result.mapPeaks && result.mapPeaks.length > 0) {
        result.mapPeaks.forEach((p, i) => {
          pushLog('INFO', `  Peak[${i}] → [${p.cx},${p.cy}] Elev(H):${p.h.toFixed(2)}`);
        });
      }

      pushLog('DATA', `Units generated: ${result.units.length}`);
      result.units.forEach((u, i) => {
        pushLog('INFO', `  [${i + 1}] ${u.allianceRole.padEnd(14)} ${u.assetClass.padEnd(13)} @ [${u.x},${u.y}]  "${u.label}"`);
      });
      pushLog('INFO', '─'.repeat(44));
      pushLog('OK', 'Scenario ready — deploy to battlefield');

      setAiResult(result);
      setAiStatus('done');

      // Trigger briefing callback if provided
      if (onBriefingGenerated) {
        onBriefingGenerated(result.scenarioTitle, result.briefing);
      }
    } catch (err: any) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const isGemini = modelInfo?.service === 'gemini-api';
      const cleanMsg = cleanErrorText(err?.message || 'Unknown error');
      
      pushLog('ERR', `Generation failed after ${elapsed}s`);
      pushLog('ERR', cleanMsg);
      
      if (isHighDemandError(err?.message, isGemini)) {
        pushLog('SYS', 'ADVISORY: Try selecting a different Gemini model in the header/panel.');
      } else {
        pushLog('INFO', 'Check if ai_server/backend_server.py is running on port 8000');
      }
      
      console.error('Scenario generation failed:', err);
      setAiError(err?.message || 'AI generation failed. Check your connection and try again.');
      setAiStatus('error');
    }
  };

  // ── Deploy AI scenario ────────────────────────────────────────────────────────
  const handleDeployAIScenario = () => {
    if (!aiResult) return;

    const newUnits: Unit[] = aiResult.units.map((u, i) => ({
      id: `ai-${Date.now()}-${i}`,
      type: (u.allianceRole === 'NEUTRAL' || u.allianceRole === 'INFRASTRUCTURE')
        ? 'OBJECTIVE'
        : (u.allianceRole as 'FRIENDLY' | 'ENEMY') ?? 'OBJECTIVE',
      x: u.x,
      y: u.y,
      label: u.label,
      assetClass: u.assetClass as AssetClass,
      allianceRole: u.allianceRole,
    }));

    onUpdateUnits(newUnits);
    if (onScenarioGenerated) {
      onScenarioGenerated(aiResult, aiTerrain);
    }
    onClose();
  };

  // ── Mission summary ───────────────────────────────────────────────────────────
  const friendlyCount = units.filter(u => u.type === 'FRIENDLY').length;
  const hostileCount = units.filter(u => u.type === 'ENEMY').length;
  const objectiveCount = units.filter(u => (u.allianceRole || u.type) === 'OBJECTIVE').length;
  const infrastructureCount = units.filter(u => u.allianceRole === 'INFRASTRUCTURE').length;

  if (!isOpen) return null;

  // ── Mode selection entry cards ────────────────────────────────────────────────
  const ENTRY_OPTIONS: {
    mode: 'CUSTOM' | 'AI';
    icon: LucideIcon;
    title: string;
    description: string;
    available: boolean;
    badge?: string;
    accentColor: string;
  }[] = [
      {
        mode: 'AI',
        icon: BrainCircuit,
        title: 'Random Scenario Generator',
        description: 'AI generates a full battlefield scenario from randomized parameters — terrain, forces, and objectives.',
        available: true,
        accentColor: '#8B5CF6',
      },
      {
        mode: 'CUSTOM',
        icon: Wrench,
        title: 'Custom Scenario Builder',
        description: 'Manually configure battlefield units, objectives, and deployment positions.',
        available: true,
        accentColor: '#1F6FEB',
      },
    ];

  return (
    <div className={isInline ? "relative h-full w-full flex flex-col" : "fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"}>
      <div className={isInline ? "flex-1 bg-[#0F1115] border-0 flex flex-col min-h-0" : "w-full max-w-3xl bg-[#0F1115] border border-[#1F6FEB]/30 rounded-sm shadow-2xl flex flex-col max-h-[90vh]"}>

        {/* ── HEADER ── */}
        <div className="p-4 border-b border-[#1F6FEB]/20 flex items-center justify-between bg-[#151A20] shrink-0">
          <div className="flex items-center gap-3">
            <Settings2 className="w-4 h-4 text-[#1F6FEB]" />
            <div>
              <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-[#E6EDF3]">
                Modular Scenario Builder
              </h2>
              <span className="text-[7px] font-mono text-[#1F6FEB]/50 uppercase tracking-[0.2em]">
                Ground Operations Deployment Console
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entryMode !== null && (
              <button
                onClick={() => {
                  setEntryMode(null);
                  setAiStatus('idle');
                  setAiResult(null);
                  setAiError(null);
                  setAiParams(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm border border-[#1F6FEB]/20 text-[8px] font-bold uppercase tracking-wider text-[#4B5563] hover:text-[#9CA3AF] hover:border-[#1F6FEB]/40 transition-all"
              >
                <ChevronLeft className="w-2.5 h-2.5" />
                Change Mode
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="text-[#9CA3AF] hover:text-white">✕</Button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ════════════════════════════════════════
              MODE: NULL — SCENARIO TYPE SELECTION
              ════════════════════════════════════════ */}
          {entryMode === null && (
            <div className="flex-1 flex flex-col justify-center p-8 gap-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#1F6FEB]/15" />
                <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#9CA3AF]/70 shrink-0">
                  Scenario Type
                </span>
                <div className="h-px flex-1 bg-[#1F6FEB]/15" />
              </div>

              <div className="grid grid-cols-2 gap-5">
                {ENTRY_OPTIONS.map(({ mode, icon: Icon, title, description, available, badge, accentColor }) => (
                  <button
                    key={mode}
                    onClick={() => available && setEntryMode(mode)}
                    disabled={!available}
                    className="relative flex flex-col items-start text-left p-5 rounded-sm border transition-all group"
                    style={{
                      background: 'rgba(10,15,30,0.70)',
                      borderColor: 'rgba(31,111,235,0.18)',
                      cursor: available ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(e) => {
                      if (!available) return;
                      (e.currentTarget as HTMLButtonElement).style.borderColor = accentColor + '90';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${accentColor}18, inset 0 0 20px ${accentColor}06`;
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,25,50,0.80)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(31,111,235,0.18)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(10,15,30,0.70)';
                    }}
                  >
                    {badge && (
                      <div className="absolute top-3 right-3">
                        <span className="text-[6px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm border border-[#1F6FEB]/20 text-[#1F6FEB]/40">
                          {badge}
                        </span>
                      </div>
                    )}

                    <div
                      className="w-10 h-10 flex items-center justify-center rounded-sm border mb-4 transition-all"
                      style={{
                        background: `${accentColor}18`,
                        borderColor: `${accentColor}40`,
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: accentColor }} />
                    </div>

                    <h3
                      className="text-[11px] font-bold uppercase tracking-[0.15em] mb-2 transition-colors"
                      style={{ color: available ? '#E6EDF3' : '#374151' }}
                    >
                      {title}
                    </h3>

                    <p
                      className="text-[9px] font-mono leading-relaxed"
                      style={{ color: available ? '#4B5563' : '#2D3748' }}
                    >
                      {description}
                    </p>

                    {available && (
                      <div className="mt-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: accentColor }}>Select</span>
                        <ChevronRight className="w-2.5 h-2.5" style={{ color: accentColor }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <p className="text-center text-[7px] font-mono text-[#374151] uppercase tracking-wider">
                Select a scenario type to begin configuration
              </p>
            </div>
          )}

          {/* ════════════════════════════════════════
              MODE: CUSTOM — FULL MANUAL BUILDER
              ════════════════════════════════════════ */}
          {entryMode === 'CUSTOM' && (
            <>
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 custom-scrollbar">

                {/* ──────── SCENARIO CONFIGURATION ──────── */}
                <div className="rounded-sm border border-[#1F6FEB]/20 bg-[#0A0F1E]/70 p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2 pb-1 border-b border-[#1F6FEB]/15">
                    <div className="w-1 h-3 bg-[#1F6FEB]/60 rounded-full" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#1F6FEB]/80">Scenario Configuration</span>
                  </div>

                  {/* Operation Name */}
                  <div className="space-y-1.5">
                    <label className="text-[8px] text-[#9CA3AF] uppercase font-bold tracking-wider">Operation Name</label>
                    <Input
                      placeholder="Operation Phantom Dune"
                      value={operationName}
                      onChange={(e) => setOperationName(e.target.value)}
                      className="h-9 bg-[#0A0F1C] border-[#1F6FEB]/20 text-[11px] font-mono placeholder:text-[#374151] focus:border-[#3A8DFF]/60"
                    />
                    {operationName.trim() && (
                      <p className="text-[7px] font-mono text-[#1F6FEB]/50 uppercase tracking-wider">
                        Mission title: {operationName.trim()}
                      </p>
                    )}
                  </div>

                  {/* Terrain Type */}
                  <div className="space-y-2">
                    <label className="text-[8px] text-[#9CA3AF] uppercase font-bold tracking-wider">Terrain Type</label>
                    <div className="flex flex-wrap gap-1.5">
                      {TERRAIN_TYPES.map((terrain) => {
                        const active = selectedTerrain === terrain;
                        return (
                          <button
                            key={terrain}
                            onClick={() => setSelectedTerrain(terrain)}
                            className="px-2.5 py-1 rounded-sm text-[8px] font-bold uppercase tracking-wider border transition-all duration-200"
                            style={
                              active
                                ? {
                                  background: 'rgba(31,111,235,0.22)',
                                  borderColor: 'rgba(31,111,235,0.75)',
                                  color: '#60A5FA',
                                  boxShadow: '0 0 10px rgba(31,111,235,0.30)',
                                }
                                : {
                                  background: 'rgba(10,15,30,0.55)',
                                  borderColor: 'rgba(31,111,235,0.15)',
                                  color: '#4B5563',
                                }
                            }
                          >
                            {terrain}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Weather Type */}
                  <div className="space-y-2">
                    <label className="text-[8px] text-[#9CA3AF] uppercase font-bold tracking-wider">Weather Conditions</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEATHER_TYPES.map((weather) => {
                        const active = selectedWeather === weather;
                        return (
                          <button
                            key={weather}
                            onClick={() => setSelectedWeather(weather)}
                            className="px-2.5 py-1 rounded-sm text-[8px] font-bold uppercase tracking-wider border transition-all duration-200"
                            style={
                              active
                                ? {
                                  background: 'rgba(31,111,235,0.18)',
                                  borderColor: 'rgba(96,165,250,0.65)',
                                  color: '#93C5FD',
                                  boxShadow: '0 0 8px rgba(96,165,250,0.25)',
                                }
                                : {
                                  background: 'rgba(10,15,30,0.55)',
                                  borderColor: 'rgba(31,111,235,0.12)',
                                  color: '#4B5563',
                                }
                            }
                          >
                            {weather}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">

                  {/* ──────── LEFT: DEPLOYMENT CONTROLS ──────── */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-[10.5px] font-bold text-[#1F6FEB] uppercase tracking-[0.25em]">
                      Deployment Controls
                    </h3>

                    <div className="space-y-2">
                      <label className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-wider">Asset Class</label>
                      <div className="flex flex-wrap gap-1.5">
                        {ASSET_CLASSES.map(({ label, icon: Icon }) => {
                          const active = assetClass === label;
                          return (
                            <button
                              key={label}
                              onClick={() => setAssetClass(label)}
                              className="flex items-center gap-1 px-2 py-1 rounded-sm text-[8px] font-bold uppercase tracking-wider border transition-all"
                              style={
                                active
                                  ? {
                                    background: 'rgba(31,111,235,0.20)',
                                    borderColor: 'rgba(31,111,235,0.70)',
                                    color: '#60A5FA',
                                    boxShadow: '0 0 8px rgba(31,111,235,0.25)',
                                  }
                                  : {
                                    background: 'rgba(10,15,30,0.60)',
                                    borderColor: 'rgba(31,111,235,0.15)',
                                    color: '#4B5563',
                                  }
                              }
                            >
                              <Icon className="w-2.5 h-2.5" />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-wider">Entity Label</label>
                      <Input
                        placeholder="e.g., Alpha Armor Division"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDeploy()}
                        className="h-9 bg-[#0A0F1C] border-[#1F6FEB]/20 text-[11px] font-mono placeholder:text-[#374151] placeholder:opacity-60"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-wider">Alliance Role</label>
                      <Select value={allianceRole} onValueChange={(v: any) => setAllianceRole(v)}>
                        <SelectTrigger className="h-9 bg-[#0A0F1C] border-[#1F6FEB]/20 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0F1115] border-[#1F6FEB]/30 text-white">
                          {ALLIANCE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-wider">Deployment Location</label>
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                          <span className="text-[7px] font-mono text-[#4B5563] uppercase">Grid X (1–44)</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="X"
                            value={gridX}
                            onChange={(e) => setGridX(e.target.value)}
                            className="h-9 bg-[#0A0F1C] border-[#1F6FEB]/20 text-[11px] font-mono placeholder:text-[#374151] placeholder:opacity-60"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <span className="text-[7px] font-mono text-[#4B5563] uppercase">Grid Y (1–28)</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Y"
                            value={gridY}
                            onChange={(e) => setGridY(e.target.value)}
                            className="h-9 bg-[#0A0F1C] border-[#1F6FEB]/20 text-[11px] font-mono placeholder:text-[#374151] placeholder:opacity-60"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-2.5 h-2.5 text-[#1F6FEB]/40" />
                        <span className="text-[8px] font-mono text-[#374151]">
                          Leave blank to auto-place on tactical grid
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={handleDeploy}
                      disabled={!newLabel.trim()}
                      className="w-full h-10 bg-[#1A3B5D] hover:bg-[#1F6FEB] disabled:opacity-30 text-[10px] font-bold uppercase tracking-widest border border-[#1F6FEB]/30 hover:border-[#3A8DFF] transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 mr-2" />
                      Deploy Unit
                    </Button>
                  </div>

                  {/* ──────── RIGHT: ACTIVE DEPLOYMENTS ──────── */}
                  <div className="flex flex-col gap-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[9px] font-bold text-[#F59E0B] uppercase tracking-[0.25em]">Active Deployments</h3>
                      <span className="text-[8px] font-mono text-[#4B5563]">
                        {units.length} UNIT{units.length !== 1 ? 'S' : ''} DEPLOYED
                      </span>
                    </div>

                    <ScrollArea className="flex-1 bg-[#0A0A0A]/50 border border-[#1F6FEB]/10 rounded-sm p-2">
                      <div className="space-y-1.5">
                        {units.map((unit) => {
                          const rs = roleStyle[unit.allianceRole || unit.type] || roleStyle['FRIENDLY'];
                          const AssetIcon = ASSET_CLASSES.find(a => a.label === unit.assetClass)?.icon;
                          return (
                            <div
                              key={unit.id}
                              className="flex items-start justify-between p-2.5 bg-[#151A20] border border-[#1F6FEB]/10 rounded-sm group hover:border-[#1F6FEB]/25 transition-colors"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="mt-0.5 shrink-0">
                                  <UnitIcon type={unit.type} />
                                </div>
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="text-[10px] font-mono text-[#E6EDF3] leading-tight truncate">
                                    {unit.label}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    {unit.assetClass && (
                                      <span className="flex items-center gap-1 text-[7px] font-bold uppercase text-[#3A8DFF]/80">
                                        {AssetIcon && <AssetIcon className="w-2 h-2" />}
                                        {unit.assetClass}
                                      </span>
                                    )}
                                    <span className="text-[7px] font-bold uppercase tracking-tight" style={{ color: rs.color }}>
                                      {rs.label}
                                    </span>
                                    <span className="text-[7px] font-mono text-[#4B5563]">
                                      [{unit.x},{unit.y}]
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemove(unit.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-[#EF4444]/60 hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-sm transition-all shrink-0 ml-2"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                        {units.length === 0 && (
                          <div className="text-center py-10 text-[9px] text-[#374151] uppercase font-bold italic">
                            No units deployed
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* ──────── MISSION CONFIGURATION SUMMARY ──────── */}
                <div className="rounded-sm p-3 border border-[#1F6FEB]/15 bg-[#0A1020]/60">
                  <div className="flex items-center gap-2 mb-2.5">
                    <ChevronRight className="w-3 h-3 text-[#1F6FEB]/60" />
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#1F6FEB]/70">Mission Configuration</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: 'Friendly Units', value: friendlyCount, color: '#22C55E' },
                      { label: 'Hostile Units', value: hostileCount, color: '#EF4444' },
                      { label: 'Objectives', value: objectiveCount, color: '#F59E0B' },
                      { label: 'Infrastructure', value: infrastructureCount, color: '#60A5FA' },
                      { label: 'Total Deployed', value: units.length, color: '#9CA3AF' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex flex-col items-center p-2 rounded-sm bg-[#0A0F1C]/60 border border-[#1F6FEB]/08">
                        <span className="text-base font-headline font-bold leading-none" style={{ color }}>{value}</span>
                        <span className="text-[7px] font-mono text-[#4B5563] uppercase mt-1 text-center leading-tight">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── FOOTER ── */}
              <div className="px-5 py-4 border-t border-[#1F6FEB]/20 bg-[#151A20] flex items-center justify-between shrink-0">
                <span className="text-[8px] font-mono text-[#374151] uppercase">
                  {units.length > 0 ? `${units.length} unit${units.length !== 1 ? 's' : ''} ready for deployment` : 'Add units to configure scenario'}
                </span>
                <Button
                  onClick={() => {
                    if (onOperationConfigured) {
                      onOperationConfigured(
                        operationName.trim() || 'Custom Scenario',
                        selectedTerrain,
                        selectedWeather,
                      );
                    }
                    onClose();
                  }}
                  className="bg-[#1F6FEB] hover:bg-[#3A8DFF] text-[10px] font-bold uppercase tracking-widest px-8 h-9 transition-all"
                >
                  Finalize Scenario
                </Button>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════
              MODE: AI — RANDOM SCENARIO GENERATOR
              ════════════════════════════════════════ */}
          {entryMode === 'AI' && (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* ── IDLE STATE ── */}
                {aiStatus === 'idle' && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                    <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                      <div
                        className="w-16 h-16 flex items-center justify-center rounded-sm border"
                        style={{ background: 'rgba(139,92,246,0.10)', borderColor: 'rgba(139,92,246,0.30)' }}
                      >
                        <BrainCircuit className="w-8 h-8 text-[#8B5CF6]" />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#E6EDF3] mb-2">
                          AI Scenario Generator
                        </h3>
                        <p className="text-[9px] font-mono text-[#4B5563] leading-relaxed">
                          Generate a complete battlefield scenario from randomized parameters. The AI will determine terrain, force composition, unit positions, and mission briefing automatically.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {(['Terrain', 'Force Balance', 'Objective', 'Context', 'Units'] as const).map((tag) => (
                          <span key={tag} className="px-2 py-1 text-[7px] font-mono uppercase tracking-wider rounded-sm border border-[#8B5CF6]/20 text-[#8B5CF6]/60">
                            {tag}
                          </span>
                        ))}
                      </div>

                      {modelInfo ? (
                        <div className="flex flex-col gap-1.5 w-full max-w-[240px] mt-2 mb-2">
                          <label 
                            className="text-[9px] font-mono uppercase tracking-wider text-center"
                            style={{ color: modelInfo.service === 'gemini-api' ? '#A78BFA' : '#4D637F' }}
                          >
                            {modelInfo.service === 'gemini-api' ? 'Active Gemini Core' : 'Active Local LLM Core'}
                          </label>
                          {modelInfo.service === 'gemini-api' ? (
                            <Select value={geminiModel} onValueChange={handleModelChange}>
                              <SelectTrigger className="w-full h-9 bg-[#050810]/80 border border-[#8B5CF6]/30 rounded-sm px-3 text-[11px] font-mono text-[#E6EDF3] focus:ring-0 focus:border-[#8B5CF6] transition-all">
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
                          ) : (
                            <div 
                              className="w-full bg-[#050810]/40 border border-[#1F6FEB]/15 rounded-sm py-2 px-3 text-[11px] font-mono text-[#8B9EB7] text-center select-none truncate"
                              title={modelInfo.model}
                            >
                              {modelInfo.model}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 w-full max-w-[240px] mt-2 mb-2">
                          <label className="text-[9px] font-mono text-[#4D637F] uppercase tracking-wider text-center">
                            Core Status
                          </label>
                          <div className="w-full bg-[#050810]/40 border border-[#1F6FEB]/15 rounded-sm py-2 px-3 text-[11px] font-mono text-[#8B9EB7] text-center select-none animate-pulse">
                            Awaiting AI Core response...
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleRandomGenerate}
                        className="mt-2 flex items-center gap-3 px-8 py-3 rounded-sm border font-bold text-[10px] uppercase tracking-widest transition-all"
                        style={{
                          background: 'rgba(139,92,246,0.15)',
                          borderColor: 'rgba(139,92,246,0.50)',
                          color: '#A78BFA',
                          boxShadow: '0 0 20px rgba(139,92,246,0.15)',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.25)';
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(139,92,246,0.30)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.15)';
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(139,92,246,0.15)';
                        }}
                      >
                        <Shuffle className="w-4 h-4" />
                        Roll Random Parameters
                      </button>
                    </div>
                  </div>
                )}

                {/* ── ROLLING STATE ── */}
                {aiStatus === 'rolling' && aiParams && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                    <div className="w-full max-w-md flex flex-col gap-4">
                      <div className="text-center mb-2">
                        <span className="text-[9px] font-mono text-[#8B5CF6] uppercase tracking-widest">Randomizing Parameters...</span>
                      </div>

                      {[
                        { label: 'TERRAIN TYPE', value: aiParams.terrainType, step: 1 },
                        { label: 'FORCE BALANCE', value: aiParams.forceBalance, step: 2 },
                        { label: 'OBJECTIVE TYPE', value: aiParams.objectiveType, step: 3 },
                        { label: 'MISSION CONTEXT', value: aiParams.missionContext.slice(0, 60) + '...', step: 4 },
                      ].map(({ label, value, step }) => (
                        <div
                          key={label}
                          className="flex items-start gap-3 p-3 rounded-sm border transition-all duration-500"
                          style={{
                            background: rollStep >= step ? 'rgba(139,92,246,0.10)' : 'rgba(10,15,30,0.60)',
                            borderColor: rollStep >= step ? 'rgba(139,92,246,0.40)' : 'rgba(31,111,235,0.15)',
                            transform: rollStep >= step ? 'translateX(0)' : 'translateX(-8px)',
                            opacity: rollStep >= step ? 1 : 0.3,
                          }}
                        >
                          <div className="shrink-0 mt-0.5">
                            {rollStep >= step
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-[#8B5CF6]" />
                              : <div className="w-3.5 h-3.5 rounded-full border border-[#374151]" />
                            }
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[7px] font-mono text-[#4B5563] uppercase tracking-wider">{label}</span>
                            <span className="text-[10px] font-mono text-[#E6EDF3] leading-snug break-words">{value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── GENERATING STATE ── */}
                {aiStatus === 'generating' && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
                    <div
                      className="flex flex-col items-center gap-4 p-8 rounded-sm border max-w-sm w-full text-center"
                      style={{ background: 'rgba(10,15,30,0.70)', borderColor: 'rgba(139,92,246,0.25)' }}
                    >
                      <div
                        className="w-14 h-14 flex items-center justify-center rounded-sm border"
                        style={{ background: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.30)' }}
                      >
                        <Loader2 className="w-7 h-7 text-[#8B5CF6] animate-spin" />
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-[#8B5CF6] uppercase tracking-wider mb-1">AI Synthesizing Scenario</p>
                        <p className="text-[8px] font-mono text-[#4B5563]">
                          WARMATRIX ENGINE processing battlefield parameters and generating unit deployments...
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[0, 150, 300].map((delay) => (
                          <div
                            key={delay}
                            className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]/50 animate-pulse"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                    {aiParams && (
                      <div className="flex flex-wrap gap-2 justify-center">
                        <span className="px-2 py-0.5 text-[7px] font-mono bg-[#151A20] border border-[#1F6FEB]/15 text-[#4B5563] uppercase rounded-sm">
                          {aiParams.terrainType}
                        </span>
                        <span className="px-2 py-0.5 text-[7px] font-mono bg-[#151A20] border border-[#1F6FEB]/15 text-[#4B5563] uppercase rounded-sm">
                          {aiParams.forceBalance}
                        </span>
                        <span className="px-2 py-0.5 text-[7px] font-mono bg-[#151A20] border border-[#1F6FEB]/15 text-[#4B5563] uppercase rounded-sm">
                          {aiParams.objectiveType}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── ERROR STATE ── */}
                {aiStatus === 'error' && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 overflow-y-auto">
                    <div
                      className="flex flex-col items-center gap-4 p-6 rounded-sm border max-w-md w-full text-center"
                      style={{ background: 'rgba(25,5,5,0.70)', borderColor: 'rgba(239,68,68,0.30)' }}
                    >
                      <AlertTriangle className="w-8 h-8 text-[#EF4444] shrink-0" />
                      
                      <div className="w-full">
                        <p className="text-[10px] font-mono text-[#EF4444] uppercase tracking-wider mb-2 font-bold">
                          Scenario Generation Uplink Failure
                        </p>
                        
                        <p className="text-[11px] font-mono text-[#E6EDF3] leading-relaxed mb-4">
                          {getReadableErrorMessage(aiError, modelInfo?.service === 'gemini-api')}
                        </p>

                        {aiError && (
                          <div className="w-full text-left mb-4">
                            <span className="text-[8px] font-mono text-[#4B6A8A] uppercase tracking-wider block mb-1">
                              Raw Telemetry Log
                            </span>
                            <div className="relative">
                              <pre className="w-full bg-[#050810]/95 border border-[#EF4444]/20 rounded-sm p-3 text-[9px] font-mono text-[#FCA5A5] whitespace-pre-wrap max-h-32 overflow-y-auto break-all scrollbar-thin">
                                {aiError}
                              </pre>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(aiError);
                                  setCopied(true);
                                  setTimeout(() => setCopied(false), 2000);
                                }}
                                className="absolute top-1.5 right-1.5 px-2 py-0.5 text-[7px] font-mono border border-[#FCA5A5]/30 text-[#FCA5A5]/70 hover:text-white hover:border-[#EF4444] rounded-sm transition-all bg-[#050810]"
                              >
                                {copied ? 'COPIED' : 'COPY'}
                              </button>
                            </div>
                          </div>
                        )}

                        {isHighDemandError(aiError, modelInfo?.service === 'gemini-api') && (
                          <div className="w-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 p-3 rounded-sm text-left mb-4">
                            <span className="text-[9px] font-mono text-[#A78BFA] uppercase tracking-wider block font-bold mb-1">
                              Tactical Advisory
                            </span>
                            <span className="text-[9px] font-mono text-[#C4B5FD] leading-relaxed block">
                              The selected model is experiencing high demand. Please try selecting a different Gemini model from the dropdown (e.g. Gemini 3.1 Flash Lite or 2.5 Flash) and try again.
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => { setAiStatus('idle'); setAiError(null); }}
                        className="px-6 py-2 text-[9px] font-bold uppercase tracking-widest rounded-sm border border-[#EF4444]/30 text-[#EF4444]/70 hover:border-[#EF4444]/60 hover:text-[#EF4444] transition-all"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* ── DONE STATE ── */}
                {aiStatus === 'done' && aiResult && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Scenario header */}
                    <div className="p-4 border-b border-[#8B5CF6]/20 bg-[#0A0F1C]/60 shrink-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-[#8B5CF6]" />
                          <span className="text-[8px] font-mono text-[#8B5CF6] uppercase tracking-wider">Scenario Generated</span>
                        </div>
                        <button
                          onClick={() => { setAiStatus('idle'); setAiResult(null); }}
                          className="text-[7px] font-mono text-[#4B5563] hover:text-[#9CA3AF] uppercase tracking-wider transition-colors shrink-0"
                        >
                          Re-roll
                        </button>
                      </div>
                      <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#E6EDF3] mt-2">
                        {aiResult.scenarioTitle}
                      </h3>
                      <p className="text-[9px] font-mono text-[#6B7280] leading-relaxed mt-1.5">
                        {aiResult.briefing}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="px-1.5 py-0.5 text-[6px] font-mono uppercase tracking-wider rounded-sm border border-[#8B5CF6]/20 text-[#8B5CF6]/60">
                          {aiTerrain}
                        </span>
                        {aiParams && (
                          <>
                            <span className="px-1.5 py-0.5 text-[6px] font-mono uppercase tracking-wider rounded-sm border border-[#1F6FEB]/15 text-[#4B5563]">
                              {aiParams.forceBalance}
                            </span>
                            <span className="px-1.5 py-0.5 text-[6px] font-mono uppercase tracking-wider rounded-sm border border-[#1F6FEB]/15 text-[#4B5563]">
                              {aiParams.objectiveType}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Unit list */}
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 mb-3">
                          <Cpu className="w-3 h-3 text-[#4B5563]" />
                          <span className="text-[8px] font-mono text-[#4B5563] uppercase tracking-wider">
                            {aiResult.units.length} Units Generated
                          </span>
                        </div>
                        {aiResult.units.map((unit, i) => {
                          const isF = unit.allianceRole === 'FRIENDLY';
                          const isE = unit.allianceRole === 'ENEMY';
                          const isN = unit.allianceRole === 'NEUTRAL' || unit.allianceRole === 'INFRASTRUCTURE';
                          const color = isF ? '#22C55E' : isE ? '#EF4444' : '#F59E0B';
                          const roleLabel = isF ? 'Friendly' : isE ? 'Hostile' : unit.allianceRole || 'Neutral';
                          return (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-2.5 rounded-sm border"
                              style={{
                                background: 'rgba(10,15,30,0.60)',
                                borderColor: isF ? 'rgba(34,197,94,0.15)' : isE ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                              }}
                            >
                              <div
                                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                                style={{ background: color, boxShadow: `0 0 4px ${color}80` }}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] font-mono text-[#E6EDF3] block leading-tight">{unit.label}</span>
                                <div className="flex gap-2 mt-0.5">
                                  <span className="text-[7px] font-bold uppercase" style={{ color }}>{roleLabel}</span>
                                  <span className="text-[7px] font-mono text-[#4B5563] uppercase">{unit.assetClass}</span>
                                  <span className="text-[7px] font-mono text-[#374151]">[{unit.x},{unit.y}]</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    {/* Deploy footer */}
                    <div className="px-5 py-4 border-t border-[#8B5CF6]/20 bg-[#151A20] flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <Map className="w-3.5 h-3.5 text-[#4B5563]" />
                        <span className="text-[8px] font-mono text-[#4B5563] uppercase">
                          {aiResult.units.length} units ready — {aiTerrain} terrain
                        </span>
                      </div>
                      <Button
                        onClick={handleDeployAIScenario}
                        className="text-[10px] font-bold uppercase tracking-widest px-8 h-9 transition-all border"
                        style={{
                          background: 'rgba(139,92,246,0.20)',
                          borderColor: 'rgba(139,92,246,0.50)',
                          color: '#A78BFA',
                        }}
                      >
                        Deploy to Battlefield
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── AI STRATEGIC TERMINAL ── */}
              <div
                className="w-80 shrink-0 flex flex-col p-4 z-10"
                style={{
                  background: '#0B0F19',
                  borderLeft: '1px solid rgba(139,92,246,0.15)',
                  boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
                }}
              >
                <div className="flex-1 flex flex-col min-h-0">
                  <AITerminalConsole
                    logs={termLogs}
                    isRunning={aiStatus === 'rolling' || aiStatus === 'generating'}
                    title="SCENARIO_GEN_UPLINK"
                    modelName={modelInfo?.model}
                    isGemini={modelInfo?.service === 'gemini-api'}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
