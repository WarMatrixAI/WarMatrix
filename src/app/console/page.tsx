'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { TacticalMapDisplay } from '@/components/TacticalMapDisplay';
import { ScenarioBuilder } from '@/components/ScenarioBuilder';
import { SecureCommsConsole, ChatMessage, MessageSource, INITIAL_LOG, nowTs } from '@/components/SecureCommsConsole';
import { SidebarAccordion } from '@/components/SidebarAccordion';
import { GenerateScenarioOutput } from '@/ai/flows/generate-scenario';
import { useToast } from '@/hooks/use-toast';
import { TacticalWidget } from '@/components/TacticalWidget';
import { TacticalTerrainMapData, TacticalTeam, buildTerrainGridFromPeaks } from '@/lib/tacticalTerrain';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TacticalHandbookConsole } from '@/components/TacticalHandbookConsole';
import {
  Activity,
  CloudRain,
  Radio,
  Boxes,
  Zap,
  BrainCircuit,
  ShieldAlert,
  MessageSquare,
  Send,
  Maximize2,
  MapPin,
  AlertCircle,
  PlayCircle,
  Shuffle,
  X,
  Shield,
  Crosshair,
  Wind,
  Map,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TerrainType = 'Highland' | 'Forest' | 'Urban' | 'Plains' | 'Desert' | 'Mountain' | 'Coastal' | 'Arctic';
type WeatherType = 'Clear' | 'Partly Cloudy' | 'Storm' | 'Fog' | 'Heavy Rain' | 'Sandstorm';

interface Unit {
  id: string;
  type: 'FRIENDLY' | 'ENEMY' | 'OBJECTIVE';
  x: number;
  y: number;
  label: string;
  assetClass?: string;
  allianceRole?: string;
  hp?: number;
  maxHp?: number;
}

interface UnitMetadata {
  id?: string;
  label: string;
  assetClass?: string;
  allianceRole?: string;
}

interface ActiveScenario {
  title: string;
  briefing: string;
  terrainType: TerrainType;
  weather?: WeatherType;
  units: Unit[];
  mapPeaks?: { cx: number; cy: number; h: number; r2: number }[];
  terrainMapData?: TacticalTerrainMapData;
}

interface BattlefieldUnit {
  id: string;
  faction: 'FRIENDLY' | 'ENEMY';
  x: number;
  y: number;
  label: string;
  hp: number;
  max_hp: number;
  attack?: number;
  defense?: number;
  range?: number;
  mobility?: number;
  alive: boolean;
}

interface BattlefieldObjective {
  id: string;
  x: number;
  y: number;
  label: string;
  controller: 'FRIENDLY' | 'ENEMY' | 'NEUTRAL';
  progress_friendly: number;
  progress_enemy: number;
}

interface BattlefieldState {
  turn: number;
  width: number;
  height: number;
  weather: string;
  units: BattlefieldUnit[];
  objectives: BattlefieldObjective[];
  ended: boolean;
  winner?: string;
  end_reason?: string;
}

interface SimulationResponse {
  updated_battlefield_state: BattlefieldState;
  unit_movements: Array<{ unit_id: string; from: { x: number; y: number }; to: { x: number; y: number } }>;
  combat_results: Array<{ attacker_id: string; defender_id: string; outcome: string; damage: number }>;
  casualties: Array<{ unit_id: string; faction: string }>;
  simulation_results: {
    expected_success?: number;
    expected_risk_operational?: number;
    recommended_next_action?: string;
  };
  ai_narrative_output: string;
  terminated: boolean;
  termination_reason?: string;
}

interface StructuredCommandPayload {
  action_type: 'MOVE' | 'ATTACK' | 'HOLD' | 'CAPTURE' | 'RECON' | 'DEFEND';
  unit_id?: string;
  target?: {
    x?: number;
    y?: number;
    unit_id?: string;
    objective_id?: string;
  };
  raw_input: string;
}

function inferAssetClass(
  unit: BattlefieldUnit,
  known?: string,
): string {
  if (known) return known;

  const label = unit.label.toLowerCase();

  if (label.includes('artillery')) return 'Artillery';
  if (label.includes('recon') || label.includes('scout')) return 'Recon';
  if (label.includes('command') || label.includes('hq')) return 'Command Unit';
  if (label.includes('logistics') || label.includes('supply') || label.includes('support')) return 'Logistics';
  if (label.includes('armor') || label.includes('armour') || label.includes('tank')) return 'Armor';
  if (label.includes('mechanized') || label.includes('mechanised')) return 'Mechanized';
  if (label.includes('infantry') || label.includes('platoon') || label.includes('company')) return 'Infantry';

  if ((unit.attack ?? 0) >= 34 || (unit.defense ?? 0) >= 20) return 'Armor';
  if ((unit.range ?? 0) >= 4) return 'Artillery';
  if ((unit.mobility ?? 0) >= 4) return 'Recon';
  if ((unit.attack ?? 0) <= 18) return 'Logistics';

  return 'Infantry';
}

function mapBackendToDisplayUnits(state: BattlefieldState, metadata: UnitMetadata[] = []): Unit[] {
  const scaleX = (x: number) => Math.max(1, Math.min(44, Math.round(x)));
  const scaleY = (y: number) => Math.max(1, Math.min(28, Math.round(y)));

  const metadataById = new globalThis.Map(metadata.filter((m) => m.id).map((m) => [m.id as string, m]));
  const metadataByLabel = new globalThis.Map(metadata.map((m) => [m.label.trim().toLowerCase(), m]));

  const getMetadata = (id: string, label: string) => {
    const byId = metadataById.get(id);
    if (byId) return byId;
    return metadataByLabel.get(label.trim().toLowerCase());
  };

  const units: Unit[] = state.units
    .filter((u) => u.alive)
    .map((u) => {
      const meta = getMetadata(u.id, u.label);
      return {
        id: u.id,
        type: u.faction,
        x: scaleX(u.x),
        y: scaleY(u.y),
        label: u.label,
        allianceRole: meta?.allianceRole || u.faction,
        assetClass: inferAssetClass(u, meta?.assetClass),
        hp: u.hp,
        maxHp: u.max_hp,
      };
    });

  const objectives: Unit[] = state.objectives.map((o) => {
    const meta = getMetadata(o.id, o.label);
    return {
      id: o.id,
      type: 'OBJECTIVE',
      x: scaleX(o.x),
      y: scaleY(o.y),
      label: o.label,
      allianceRole: meta?.allianceRole || (o.controller === 'NEUTRAL' ? 'OBJECTIVE' : o.controller),
      assetClass: meta?.assetClass || 'Objective',
    };
  });

  return [...units, ...objectives];
}

function buildStructuredCommand(rawInput: string, state: BattlefieldState): StructuredCommandPayload {
  const lower = rawInput.toLowerCase();

  const inferAction = (): StructuredCommandPayload['action_type'] => {
    if (/(attack|engage|fire|strike|assault)/i.test(lower)) return 'ATTACK';
    if (/(capture|secure|seize|take objective)/i.test(lower)) return 'CAPTURE';
    if (/(recon|scout|observe|survey)/i.test(lower)) return 'RECON';
    if (/(defend|fortify|dig in|protect)/i.test(lower)) return 'DEFEND';
    if (/(move|advance|push|maneuver|reposition)/i.test(lower)) return 'MOVE';
    if (/(hold|wait|pause|maintain|stay)/i.test(lower)) return 'HOLD';
    return 'HOLD';
  };

  const action_type = inferAction();

  const friendlyAlive = state.units.filter((u) => u.alive && u.faction === 'FRIENDLY');
  const enemyAlive = state.units.filter((u) => u.alive && u.faction === 'ENEMY');

  const actor =
    friendlyAlive.find((u) => lower.includes(u.id.toLowerCase()) || lower.includes(u.label.toLowerCase())) ||
    friendlyAlive[0];

  const toSimX = (x: number) => {
    return Math.max(1, Math.min(44, Math.round(x)));
  };
  const toSimY = (y: number) => {
    return Math.max(1, Math.min(28, Math.round(y)));
  };

  const coordMatch = lower.match(/\[(\d{1,2})\s*,\s*(\d{1,2})\]|x\s*[:=]?\s*(\d{1,2})\D+y\s*[:=]?\s*(\d{1,2})/i);
  const parsedX = coordMatch ? Number(coordMatch[1] || coordMatch[3]) : undefined;
  const parsedY = coordMatch ? Number(coordMatch[2] || coordMatch[4]) : undefined;

  const target: StructuredCommandPayload['target'] = {};

  if (parsedX !== undefined && parsedY !== undefined) {
    target.x = toSimX(parsedX);
    target.y = toSimY(parsedY);
  }

  const objective = state.objectives.find((o) => lower.includes(o.id.toLowerCase()) || lower.includes(o.label.toLowerCase()));
  if (objective) {
    target.objective_id = objective.id;
    target.x = objective.x;
    target.y = objective.y;
  }

  if ((action_type === 'MOVE' || action_type === 'CAPTURE' || action_type === 'RECON') && (target.x === undefined || target.y === undefined)) {
    if (state.objectives.length > 0) {
      const nearestObj = actor
        ? state.objectives.reduce((best, o) => {
          const bd = Math.hypot(best.x - actor.x, best.y - actor.y);
          const od = Math.hypot(o.x - actor.x, o.y - actor.y);
          return od < bd ? o : best;
        }, state.objectives[0])
        : state.objectives[0];

      target.objective_id = nearestObj.id;
      target.x = nearestObj.x;
      target.y = nearestObj.y;
    } else if (enemyAlive.length > 0) {
      const nearestEnemy = actor
        ? enemyAlive.reduce((best, e) => {
          const bd = Math.hypot(best.x - actor.x, best.y - actor.y);
          const ed = Math.hypot(e.x - actor.x, e.y - actor.y);
          return ed < bd ? e : best;
        }, enemyAlive[0])
        : enemyAlive[0];
      target.x = nearestEnemy.x;
      target.y = nearestEnemy.y;
    }
  }

  if (action_type === 'ATTACK' && !target.unit_id && enemyAlive.length > 0) {
    const namedEnemy = enemyAlive.find((e) => lower.includes(e.id.toLowerCase()) || lower.includes(e.label.toLowerCase()));
    const chosenEnemy = namedEnemy ||
      (actor
        ? enemyAlive.reduce((best, e) => {
          const bd = Math.hypot(best.x - actor.x, best.y - actor.y);
          const ed = Math.hypot(e.x - actor.x, e.y - actor.y);
          return ed < bd ? e : best;
        }, enemyAlive[0])
        : enemyAlive[0]);

    target.unit_id = chosenEnemy.id;
    target.x = chosenEnemy.x;
    target.y = chosenEnemy.y;
  }

  return {
    action_type,
    unit_id: actor?.id,
    target,
    raw_input: rawInput,
  };
}

const WIDGET_SOURCE_STYLE: Record<MessageSource, { label: string; color: string; dot: string }> = {
  COMMAND_INPUT: { label: 'COMMANDER', color: '#E6EDF3', dot: '#9CA3AF' },
  AI_STRATEGIST: { label: 'AI STRATEGIST', color: '#3A8DFF', dot: '#1F6FEB' },
  SIMULATION_ENGINE: { label: 'SIMULATION ENGINE', color: '#A78BFA', dot: '#7C3AED' },
  INTEL_DIVISION: { label: 'INTEL DIVISION', color: '#38BDF8', dot: '#0EA5E9' },
  FOG_OF_WAR_MODULE: { label: 'FOG OF WAR MODULE', color: '#94A3B8', dot: '#475569' },
  SYSTEM: { label: 'SYSTEM', color: '#22C55E', dot: '#16A34A' },
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function WarMatrixPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [turn, setTurn] = useState(1);
  const [status, setStatus] = useState<'ACTIVE' | 'AWAITING COMMAND' | 'PROCESSING'>('ACTIVE');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [role, setRole] = useState<'BLUE_TEAM' | 'RED_TEAM'>('BLUE_TEAM');

  // ─── Authentication Guard ──────────────────────────────────────────────────
  useEffect(() => {
    const isAuth = localStorage.getItem("warmatrix_auth") === "true";
    const expires = localStorage.getItem("warmatrix_auth_expires");
    const isExpired = expires ? parseInt(expires, 10) < Date.now() : true;

    if (!isAuth || isExpired) {
      localStorage.removeItem("warmatrix_auth");
      localStorage.removeItem("warmatrix_auth_expires");
      router.push("/login"); // Emergency redirect to Authorization Portal
    }
  }, [router]);
  const [centerScenarioMode, setCenterScenarioMode] = useState<'default' | 'random' | 'custom'>('default');
  const [isBuilderWorkspaceActive, setIsBuilderWorkspaceActive] = useState(false);
  const [builderScenarioMode, setBuilderScenarioMode] = useState<'selection' | 'random' | 'custom'>('selection');
  const [isCommsConsoleOpen, setIsCommsConsoleOpen] = useState(false);
  const [isHandbookConsoleOpen, setIsHandbookConsoleOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
  const [lastAdvisoryAdvice, setLastAdvisoryAdvice] = useState<string>('');
  const [inputValue, setInputValue] = useState('');
  const [lastResult, setLastResult] = useState<{
    command: string;
    success: number;
    risk: number;
    outcome: string;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_LOG);
  const widgetChatEndRef = React.useRef<HTMLDivElement>(null);

  // ─── Combat Metrics State ────────────────────────────────────────────────────
  const [combatMetrics, setCombatMetrics] = useState({
    allyUnitsLost: 0,
    allyInfantryCasualties: 0,
    allyArmorDamaged: 0,
    allySupportLost: 0,
    enemyUnitsDestroyed: 0,
    enemyUnitsCaptured: 0,
    enemyArmorDestroyed: 0,
    enemySupportNeutralized: 0,
  });

  const [battlefieldState, setBattlefieldState] = useState<BattlefieldState | null>(null);
  const [movementEvents, setMovementEvents] = useState<SimulationResponse['unit_movements']>([]);
  const [combatEvents, setCombatEvents] = useState<SimulationResponse['combat_results']>([]);

  const handleBriefingGenerated = (title: string, briefing: string) => {
    const briefingMsg: ChatMessage = {
      id: `briefing-${Date.now()}`,
      source: 'AI_STRATEGIST',
      headline: `MISSION BRIEFING: ${title}`,
      body: briefing,
      timestamp: nowTs(),
      classification: 'SECRET',
    };

    const statusMsg: ChatMessage = {
      id: `status-${Date.now() + 1}`,
      source: 'INTEL_DIVISION',
      headline: 'OPERATIONAL STATUS REPORT',
      body: `Battlefield topography analyzed. Tactical deployment ready in sector. High-priority objectives identified. Communications uplink secure.`,
      timestamp: nowTs(),
      classification: 'CONFIDENTIAL',
    };

    setChatMessages(prev => [...prev, briefingMsg, statusMsg]);

    toast({
      title: "Incoming Transmission",
      description: "AI Strategist has uploaded the mission briefing.",
    });
  };

  useEffect(() => {
    const container = widgetChatEndRef.current?.parentElement;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      if (isAtBottom) {
        widgetChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [chatMessages]);

  // ── Scenario state ───────────────────────────────────────────────────────────
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);

  const updateMetricsFromState = (state: BattlefieldState) => {
    const classifyArmor = (unit: BattlefieldUnit) => {
      const label = unit.label.toLowerCase();
      return label.includes('armor') || label.includes('tank') || label.includes('mechanized') || (unit.defense ?? 0) >= 18;
    };

    const classifySupport = (unit: BattlefieldUnit) => {
      const label = unit.label.toLowerCase();
      return (
        label.includes('support') ||
        label.includes('logistics') ||
        label.includes('command') ||
        label.includes('artillery') ||
        (unit.attack ?? 0) <= 18
      );
    };

    const friendlyUnits = state.units.filter((u) => u.faction === 'FRIENDLY');
    const enemyUnits = state.units.filter((u) => u.faction === 'ENEMY');

    const allyUnitsLost = friendlyUnits.filter((u) => !u.alive).length;
    const allyDamageTaken = friendlyUnits.reduce((sum, u) => sum + Math.max(0, (u.max_hp ?? 100) - (u.hp ?? 0)), 0);
    const allyArmorDamaged = friendlyUnits.filter((u) => u.alive && classifyArmor(u) && (u.hp ?? 0) < (u.max_hp ?? 100)).length;
    const allySupportLost = friendlyUnits.filter((u) => !u.alive && classifySupport(u)).length;

    const enemyUnitsDestroyed = enemyUnits.filter((u) => !u.alive).length;
    const enemyUnitsCaptured = state.objectives.filter((o) => o.controller === 'FRIENDLY').length;
    const enemyArmorDestroyed = enemyUnits.filter((u) => !u.alive && classifyArmor(u)).length;
    const enemySupportNeutralized = enemyUnits.filter((u) => (!u.alive || (u.hp ?? 0) < Math.ceil((u.max_hp ?? 100) * 0.5)) && classifySupport(u)).length;

    setCombatMetrics((prev) => ({
      ...prev,
      allyUnitsLost,
      allyInfantryCasualties: allyDamageTaken,
      allyArmorDamaged,
      allySupportLost,
      enemyUnitsDestroyed,
      enemyUnitsCaptured,
      enemyArmorDestroyed,
      enemySupportNeutralized,
    }));
  };

  const initializeScenarioViaBackend = async (
    scenario: GenerateScenarioOutput,
    terrainType: TerrainType,
    weather: WeatherType
  ) => {
    const res = await fetch('/api/sitrep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initialize_scenario: true,
        scenario: {
          scenarioTitle: scenario.scenarioTitle,
          briefing: scenario.briefing,
          terrainType,
          weather,
          units: scenario.units,
          mapPeaks: scenario.mapPeaks ?? [],
          terrainMapData: scenario.terrainMapData,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.details || data?.error || 'Scenario initialization failed');
    }

    const state = data.updated_battlefield_state as BattlefieldState;
    const seededMetadata: UnitMetadata[] = scenario.units.map((u, idx) => ({
      id: undefined,
      label: u.label,
      assetClass: u.assetClass,
      allianceRole: u.allianceRole === 'NEUTRAL' || u.allianceRole === 'INFRASTRUCTURE' ? 'OBJECTIVE' : u.allianceRole,
    }));
    const displayUnits = mapBackendToDisplayUnits(state, seededMetadata);

    setBattlefieldState(state);
    setTurn(state.turn);
    setUnits(displayUnits);
    setActiveScenario({
      title: scenario.scenarioTitle,
      briefing: scenario.briefing,
      terrainType,
      weather,
      units: displayUnits,
      mapPeaks: scenario.mapPeaks,
      terrainMapData: scenario.terrainMapData,
    });
    setAnalysis(null);
    setMovementEvents([]);
    setCombatEvents([]);
    setCombatMetrics({
      allyUnitsLost: 0,
      allyInfantryCasualties: 0,
      allyArmorDamaged: 0,
      allySupportLost: 0,
      enemyUnitsDestroyed: 0,
      enemyUnitsCaptured: 0,
      enemyArmorDestroyed: 0,
      enemySupportNeutralized: 0,
    });
  };

  // Strategic analysis is now produced by backend after each authoritative simulation tick.

  // ── Handle scenario generated from ScenarioBuilder ───────────────────────────
  const handleScenarioGenerated = (
    scenario: GenerateScenarioOutput,
    terrainType: TerrainType,
  ) => {
    void (async () => {
      try {
        await initializeScenarioViaBackend(scenario, terrainType, 'Clear');
        toast({
          title: 'Scenario Loaded',
          description: `${scenario.scenarioTitle} initialized via backend authority.`,
        });
      } catch (err: any) {
        toast({
          title: 'Scenario Initialization Failed',
          description: err?.message ?? 'Unable to initialize scenario on backend.',
          variant: 'destructive',
        });
      }
    })();
  };

  // ── Pending operation config from custom builder ─────────────────────────────
  const [pendingOperationConfig, setPendingOperationConfig] = React.useState<{
    name: string;
    terrain: TerrainType;
    weather: WeatherType;
  } | null>(null);

  const handleOperationConfigured = (name: string, terrain: TerrainType, weather: WeatherType) => {
    setPendingOperationConfig({ name, terrain, weather });
  };

  // ── Handle custom builder closing ─────────────────────────────────────────────
  const handleBuilderWorkspaceClose = () => {
    setIsBuilderWorkspaceActive(false);
    setBuilderScenarioMode('selection');
    const cfg = pendingOperationConfig;
    if (units.length > 0 && !activeScenario) {
      const draft: GenerateScenarioOutput = {
        scenarioTitle: cfg?.name || 'Custom Scenario',
        briefing: 'Manually configured battlefield scenario.',
        units: units.map((u) => ({
          label: u.label,
          assetClass: (u.assetClass as any) || (u.type === 'OBJECTIVE' ? 'Objective' : 'Infantry'),
          allianceRole: (u.allianceRole as any) || (u.type === 'FRIENDLY' ? 'FRIENDLY' : u.type === 'ENEMY' ? 'ENEMY' : 'NEUTRAL'),
          x: u.x,
          y: u.y,
        })),
        mapPeaks: [],
      };
      void initializeScenarioViaBackend(draft, cfg?.terrain || 'Urban', cfg?.weather || 'Clear');
    } else if (cfg && activeScenario) {
      setActiveScenario(prev => prev ? {
        ...prev,
        title: cfg.name,
        terrainType: cfg.terrain,
        weather: cfg.weather,
      } : prev);
    }
    setPendingOperationConfig(null);
  };

  const handleCenterScenarioClose = () => {
    setCenterScenarioMode('default');
    const cfg = pendingOperationConfig;
    if (units.length > 0 && !activeScenario) {
      const draft: GenerateScenarioOutput = {
        scenarioTitle: cfg?.name || 'Custom Scenario',
        briefing: 'Manually configured battlefield scenario.',
        units: units.map((u) => ({
          label: u.label,
          assetClass: (u.assetClass as any) || (u.type === 'OBJECTIVE' ? 'Objective' : 'Infantry'),
          allianceRole: (u.allianceRole as any) || (u.type === 'FRIENDLY' ? 'FRIENDLY' : u.type === 'ENEMY' ? 'ENEMY' : 'NEUTRAL'),
          x: u.x,
          y: u.y,
        })),
        mapPeaks: [],
      };
      void initializeScenarioViaBackend(draft, cfg?.terrain || 'Urban', cfg?.weather || 'Clear');
    }
    setPendingOperationConfig(null);
  };

  const handleExecuteCommand = async (eOrCommand?: React.FormEvent | string) => {
    let command = "";
    
    if (typeof eOrCommand === "string") {
      command = eOrCommand.trim();
    } else {
      eOrCommand?.preventDefault();
      command = inputValue.trim();
      setInputValue("");
    }

    if (!command || status === "PROCESSING") return;
    if (!activeScenario) {
      toast({
        title: 'No Simulation Active',
        description: 'Deploy a scenario first before issuing commands.',
        variant: 'destructive',
      });
      return;
    }

    if (!battlefieldState) {
      toast({
        title: 'Simulation Not Initialized',
        description: 'Scenario state is still syncing with backend. Please retry in a moment.',
        variant: 'destructive',
      });
      return;
    }

    setStatus('PROCESSING');
    setLoadingAnalysis(true);

    // Add user message to shared chat feed
    const userMsg: ChatMessage = {
      id: `uw-${Date.now()}`,
      source: 'COMMAND_INPUT',
      body: command,
      timestamp: nowTs(),
    };
    setChatMessages(prev => [...prev, userMsg]);

    try {
      const lowerCmd = command.toLowerCase();
      const isExecutionCommand = /(proceed|execute|next turn|advance|continue)/i.test(lowerCmd);
      
      let res;
      if (isExecutionCommand) {
        // Execute Simulation Tick
        // Inject last advisory context if it exists to ensure AI carries out the plan
        const enrichedCommand = lastAdvisoryAdvice 
          ? `EXECUTE THE FOLLOWING PLAN: ${lastAdvisoryAdvice}. User Directive: ${command}`
          : command;

        const structuredCommand = buildStructuredCommand(enrichedCommand, battlefieldState);
        res = await fetch('/api/sitrep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: structuredCommand,
            end_simulation: false,
            current_state: battlefieldState,
            max_new_tokens: 320,
            temperature: 0.35,
            top_p: 0.9,
          }),
        });
      } else {
        // Advisory Chat Only
        res = await fetch('/api/sitrep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            directive: command,
            battlefield_data: JSON.stringify(battlefieldState),
            mode: 'GENERAL',
            max_new_tokens: 320,
            temperature: 0.45,
          }),
        });
      }

      const data = (await res.json()) as SimulationResponse;

      if (!isExecutionCommand && data.ai_narrative_output) {
        setLastAdvisoryAdvice(data.ai_narrative_output);
      }

      if (res.ok) {
        if (data.updated_battlefield_state) {
          const state = data.updated_battlefield_state;
          const displayUnits = mapBackendToDisplayUnits(state, units);

          setBattlefieldState(state);
          setUnits(displayUnits);
          setTurn(state.turn);
          setMovementEvents(data.unit_movements ?? []);
          setCombatEvents(data.combat_results ?? []);
          updateMetricsFromState(state);

          setActiveScenario((prev) => prev
            ? {
              ...prev,
              units: displayUnits,
              briefing: data.ai_narrative_output || prev.briefing,
              title: prev.title.split(' //')[0],
            }
            : prev);
        }

        const riskPct = Math.round((data.simulation_results?.expected_risk_operational ?? 0) * 100);
        const successPct = Math.round((data.simulation_results?.expected_success ?? 0) * 100);

        const currentState = data.updated_battlefield_state || battlefieldState;

        setAnalysis({
          strategicOverview: data.ai_narrative_output || `Turn ${currentState?.turn ?? 0} simulation resolved via backend engine.`,
          staffAnalysis: {
            maneuver: `Movement events: ${data.unit_movements?.length ?? 0}. Combat events: ${data.combat_results?.length ?? 0}.`,
            logistics: `Friendly alive: ${currentState?.units.filter((u) => u.alive && u.faction === 'FRIENDLY').length ?? 0}, Enemy alive: ${currentState?.units.filter((u) => u.alive && u.faction === 'ENEMY').length ?? 0}.`,
            intelligence: `Enemy actions updated from backend simulation.`,
          },
          riskAssessment: `Operational risk estimated at ${riskPct}%.`,
          predictedEnemyBehavior: `Expected next action: ${data.simulation_results?.recommended_next_action ?? 'HOLD'}.`,
          recommendedActions: [
            `Follow-up: ${data.simulation_results?.recommended_next_action ?? 'HOLD'}`,
            'Maintain objective pressure and update command for next turn.',
          ],
        });

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          source: 'AI_STRATEGIST',
          headline: 'TACTICAL AI RESPONSE',
          body: data.ai_narrative_output ?? '(No narrative returned from backend)',
          timestamp: nowTs(),
          classification: 'CONFIDENTIAL',
        };
        setChatMessages(prev => [...prev, aiMsg]);

        setLastResult({
          command,
          success: successPct,
          risk: riskPct,
          outcome: data.termination_reason || 'Backend simulation tick completed.',
        });

        if (data.terminated) {
          setStatus('AWAITING COMMAND');
        }
      } else {
        const errCode = (data as any).error;
        const errDetails = (data as any).details || (data as any).error || 'Simulation backend failed';

        if (errCode === 'invalid_action') {
          const sysMsg: ChatMessage = {
            id: `sys-${Date.now()}`,
            source: 'SYSTEM',
            body: `ACTION VALIDATION FAILED — ${errDetails}`,
            timestamp: nowTs(),
          };
          setChatMessages((prev) => [...prev, sysMsg]);
          toast({
            title: 'Invalid Action',
            description: errDetails,
            variant: 'destructive',
          });
          return;
        }

        throw new Error(errDetails);
      }
    } catch (err: any) {
      console.error('Command execution failed:', err);
      const sysMsg: ChatMessage = {
        id: `sw-${Date.now()}`,
        source: 'SYSTEM',
        body: `SIMULATION LINK FAILURE — ${err.message || 'Check backend simulation status.'}`,
        timestamp: nowTs(),
      };
      setChatMessages(prev => [...prev, sysMsg]);
    } finally {
      setStatus((prev) => (prev === 'AWAITING COMMAND' ? prev : 'ACTIVE'));
      setLoadingAnalysis(false);
    }
  };

  const handleEndSimulation = () => {
    if (typeof window !== 'undefined') {
      const reportData = {
        missionStatus: battlefieldState?.winner ? (battlefieldState.winner === "FRIENDLY" ? "SUCCESS" : "FAILED") : "COMPLETED",
        simulationTurns: String(turn).padStart(3, '0'),
        alliedCasualties: `${combatMetrics.allyUnitsLost} Units`,
        infantryLost: String(combatMetrics.allyInfantryCasualties),
        armorLost: String(combatMetrics.allyArmorDamaged),
        supportUnitsLost: String(combatMetrics.allySupportLost),
        enemyLosses: `${combatMetrics.enemyUnitsDestroyed} Units`,
        unitsDestroyed: String(combatMetrics.enemyUnitsDestroyed),
        unitsCaptured: String(combatMetrics.enemyUnitsCaptured),
        heavyArmorNeutralized: String(combatMetrics.enemyArmorDestroyed),
        objectivesCaptured: `${battlefieldState?.objectives.filter(o => o.controller === 'FRIENDLY').length ?? 0} / ${battlefieldState?.objectives.length ?? 0}`,
        defensiveObjectivesHeld: String(battlefieldState?.objectives.filter(o => o.controller === 'NEUTRAL').length ?? 0),
        enemyPersonnelCaptured: String(combatMetrics.enemyUnitsCaptured * 12),
        enemyVehiclesCaptured: String(combatMetrics.enemyArmorDestroyed),
        intelRecovered: "SECURED",
        commandScore: lastResult?.success ? `${lastResult.success}%` : "85%",
        operationalEffectiveness: analysis?.staffAnalysis?.maneuver ? analysis.staffAnalysis.maneuver.split('.')[0] : "Nominal",
        strategicExecution: analysis?.predictedEnemyBehavior ? analysis.predictedEnemyBehavior.split('.')[0] : "Nominal",
        riskManagement: lastResult?.risk ? `${lastResult.risk}%` : "Low",
        alliedVehiclesDamaged: String(combatMetrics.allyArmorDamaged),
        alliedInfantryWounded: String(combatMetrics.allyInfantryCasualties),
        enemyArmorDestroyed: String(combatMetrics.enemyArmorDestroyed),
        enemyArtilleryNeutralized: String(combatMetrics.enemySupportNeutralized),
        simulationActions: chatMessages
          .filter(m => m.source === 'COMMAND_INPUT' || (m.source === 'AI_STRATEGIST' && m.headline === 'TACTICAL AI RESPONSE'))
          .map((m, idx) => ({
            turn: Math.floor(idx / 2) + 1,
            action: m.headline === 'TACTICAL AI RESPONSE' && typeof m.body === 'string'
              ? 'AI Report: ' + m.body.substring(0, 100) + (m.body.length > 100 ? '...' : '')
              : (typeof m.body === 'string' ? m.body : 'Command executed')
          }))
      };
      sessionStorage.setItem('missionReportData', JSON.stringify(reportData));
    }
    // Navigate to Final Mission Report
    router.push('/final-report');
  };

  const visibleUnits = activeScenario ? units : [];

  const unitHpById = React.useMemo(() => {
    if (!battlefieldState) return {} as Record<string, { hp: number; maxHp: number }>;
    return battlefieldState.units.reduce((acc, u) => {
      acc[u.id] = { hp: u.hp, maxHp: u.max_hp };
      return acc;
    }, {} as Record<string, { hp: number; maxHp: number }>);
  }, [battlefieldState]);

  const objectiveProgressById = React.useMemo(() => {
    if (!battlefieldState) return {} as Record<string, { friendly: number; enemy: number; controller: 'FRIENDLY' | 'ENEMY' | 'NEUTRAL' }>;
    return battlefieldState.objectives.reduce((acc, o) => {
      acc[o.id] = {
        friendly: o.progress_friendly,
        enemy: o.progress_enemy,
        controller: o.controller,
      };
      return acc;
    }, {} as Record<string, { friendly: number; enemy: number; controller: 'FRIENDLY' | 'ENEMY' | 'NEUTRAL' }>);
  }, [battlefieldState]);

  const terrainType = activeScenario?.terrainType ?? 'Highland';
  const displayScenarioTitle = activeScenario?.title.split(' //')[0] ?? '';

  const terrainVersionKey = React.useMemo(() => {
    if (!activeScenario) return 'no-simulation';
    return `${activeScenario.title}|${activeScenario.terrainType}|${JSON.stringify(activeScenario.terrainMapData?.map_size ?? [])}|${JSON.stringify(activeScenario.mapPeaks ?? [])}`;
  }, [activeScenario]);

  const tacticalTerrainMapData = React.useMemo<TacticalTerrainMapData | undefined>(() => {
    if (!activeScenario) return undefined;

    const mapSize: [number, number] = activeScenario.terrainMapData?.map_size ?? [44, 28];
    const terrain = activeScenario.terrainMapData?.terrain ?? buildTerrainGridFromPeaks(
      mapSize[0],
      mapSize[1],
      activeScenario.terrainType,
      activeScenario.mapPeaks,
    );

    const unitData = visibleUnits.map((unit) => {
      const team: TacticalTeam = unit.type === 'FRIENDLY'
        ? 'ally'
        : unit.type === 'ENEMY'
          ? 'enemy'
          : 'objective';

      return {
        id: unit.id,
        type: unit.assetClass ?? unit.type,
        team,
        x: unit.x,
        y: unit.y,
        label: unit.label,
      };
    });

    return {
      map_size: mapSize,
      terrain,
      units: unitData,
    };
  }, [activeScenario, visibleUnits]);

  return (
    <div className="flex flex-col h-screen select-none bg-[#0A0A0A] overflow-hidden">
      <Header
        turn={turn}
        status={status}
        onOpenBuilder={() => {
          setBuilderScenarioMode('selection');
          setIsBuilderWorkspaceActive(true);
        }}
      />

      <main className="flex-1 p-4 flex gap-4 overflow-hidden">
        {/* LEFT ZONE: Intel Widgets */}
        <div className="w-64 flex flex-col gap-4 shrink-0 h-full overflow-y-auto custom-scrollbar pr-2">
          {/* Tactical Dashboard Launcher */}
          <button
            suppressHydrationWarning
            onClick={() => setIsDashboardOpen(true)}
            className="w-full flex items-center justify-between p-3 rounded-sm group transition-all relative overflow-hidden"
            style={{
              background: 'rgba(31,111,235,0.1)',
              border: '1px solid rgba(31,111,235,0.3)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(31,111,235,0.1)] to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <div className="flex items-center gap-2 relative z-10">
              <Activity className="w-4 h-4 text-[#3A8DFF]" />
              <span className="text-[12px] font-bold text-[#E6EDF3] tracking-widest uppercase group-hover:text-[#3A8DFF] transition-colors">
                Command Dashboard
              </span>
            </div>
            <Maximize2 className="w-3 h-3 text-[#3A8DFF] opacity-50 group-hover:opacity-100 relative z-10" />
          </button>

          <TacticalWidget title="Comm Status" icon={Radio}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full ${activeScenario ? 'bg-[#22C55E] animate-pulse' : 'bg-[#4B5563]'}`} />
                <span className="text-[10px] font-mono text-[#E6EDF3]">
                  {activeScenario ? 'LINK_ESTABLISHED' : 'LINK_IDLE'}
                </span>
              </div>
              <span className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-tighter">ENCRYPTION: AES-256</span>
            </div>
          </TacticalWidget>


          {/* Active Scenario — clickable briefing panel */}
          <div className="flex flex-col min-h-0">
            {activeScenario ? (
              <button
                suppressHydrationWarning
                onClick={() => setIsBriefingModalOpen(true)}
                className="w-full text-left group flex flex-col"
                style={{
                  background: 'rgba(8,14,28,0.85)',
                  border: '1px solid rgba(31,111,235,0.22)',
                  borderRadius: '2px',
                  padding: '10px 12px',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = 'rgba(31,111,235,0.55)';
                  el.style.boxShadow = '0 0 14px rgba(31,111,235,0.08)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = 'rgba(31,111,235,0.22)';
                  el.style.boxShadow = 'none';
                }}
              >
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" style={{ boxShadow: '0 0 5px #22C55E80' }} />
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#3A8DFF]">Active Scenario</span>
                  <span className="ml-auto text-[7px] font-mono text-[#1F6FEB]/50 group-hover:text-[#3A8DFF] transition-colors uppercase tracking-wider">View Briefing ›</span>
                </div>
                <span className="text-[10px] font-bold text-[#E6EDF3] leading-tight block mb-1 truncate shrink-0">{displayScenarioTitle}</span>
                <p className="text-[8px] font-mono text-[#6B7280] leading-snug">{activeScenario.briefing}</p>
                <div className="flex items-center gap-2 mt-auto pt-2 shrink-0">
                  <span className="text-[7px] font-mono text-[#8B5CF6] uppercase">{activeScenario.terrainType}</span>
                  <span className="text-[7px] font-mono text-[#4B5563]">·</span>
                  <span className="text-[7px] font-mono text-[#4B5563]">{units.length} units</span>
                </div>
              </button>
            ) : (
              <div
                className="w-full flex flex-col items-center justify-center p-4 text-center border border-[#1F6FEB]/10 rounded-sm bg-[#080E1C]/40"
              >
                <div className="w-8 h-8 rounded-full border border-[#1F6FEB]/20 flex items-center justify-center mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#374151]" />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#4B6A83] mb-1">No Active Scenario</span>
                <p className="text-[7px] font-mono text-[#374151] leading-tight">Awaiting initial tactical deployment</p>
              </div>
            )}
          </div>

          <TacticalWidget title="Ally Damage Report" icon={Zap}>
            <div className="flex flex-col gap-1">
              {[
                { label: 'Units Lost', value: combatMetrics.allyUnitsLost.toString() },
                { label: 'Infantry Casualties', value: combatMetrics.allyInfantryCasualties.toString() },
                { label: 'Armor Damaged', value: combatMetrics.allyArmorDamaged.toString() },
                { label: 'Support Units Lost', value: combatMetrics.allySupportLost.toString() },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center py-0.5 border-b border-[#1F6FEB]/05 last:border-0">
                  <span className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-tighter">{item.label}</span>
                  <span className="text-[10px] font-mono text-[#E6EDF3]">{item.value}</span>
                </div>
              ))}
            </div>
          </TacticalWidget>

          <TacticalWidget title="Enemy Damage Report" icon={Activity}>
            <div className="flex flex-col gap-1">
              {[
                { label: 'Enemy Units Destroyed', value: combatMetrics.enemyUnitsDestroyed.toString() },
                { label: 'Enemy Units Captured', value: combatMetrics.enemyUnitsCaptured.toString() },
                { label: 'Enemy Armor Destroyed', value: combatMetrics.enemyArmorDestroyed.toString() },
                { label: 'Enemy Support Units Neutralized', value: combatMetrics.enemySupportNeutralized.toString() },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center py-0.5 border-b border-[#1F6FEB]/05 last:border-0">
                  <span className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-tighter">{item.label}</span>
                  <span className="text-[10px] font-mono text-[#E6EDF3]">{item.value}</span>
                </div>
              ))}
            </div>
          </TacticalWidget>
        </div>

        {/* ── MISSION BRIEFING MODAL ── */}
        {isBriefingModalOpen && activeScenario && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-6"
            style={{ background: 'rgba(2,4,10,0.82)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setIsBriefingModalOpen(false); }}
          >
            <div
              className="relative w-full max-w-xl flex flex-col gap-0"
              style={{
                background: 'rgba(8,14,28,0.97)',
                border: '1px solid rgba(31,111,235,0.35)',
                borderRadius: '2px',
                boxShadow: '0 0 60px rgba(31,111,235,0.12), 0 0 120px rgba(31,111,235,0.04)',
                animation: 'hudFadeIn 0.2s ease-out',
                maxHeight: '85vh',
                overflowY: 'auto',
              }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'rgba(31,111,235,0.20)', background: 'rgba(12,20,40,0.80)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" style={{ boxShadow: '0 0 6px #22C55E' }} />
                  <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#3A8DFF]">Mission Briefing</span>
                </div>
                <button
                  suppressHydrationWarning
                  onClick={() => setIsBriefingModalOpen(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-sm border border-[#1F6FEB]/20 text-[#4B6A8A] hover:text-white hover:border-[#1F6FEB]/50 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="flex flex-col gap-5 p-5">

                {/* Operation Name */}
                <div>
                  <span className="text-[7px] font-bold uppercase tracking-[0.25em] text-[#4B6A8A] block mb-1">Operation</span>
                  <h2 className="text-base font-headline font-bold uppercase tracking-widest text-[#E6EDF3] leading-tight">{displayScenarioTitle}</h2>
                </div>

                {/* Mission Description */}
                <div style={{ borderLeft: '2px solid rgba(31,111,235,0.35)', paddingLeft: '12px' }}>
                  <span className="text-[7px] font-bold uppercase tracking-[0.25em] text-[#4B6A8A] block mb-1.5">Mission Description</span>
                  <p className="text-[9px] font-mono text-[#9CA3AF] leading-relaxed">{activeScenario.briefing}</p>
                </div>

                {/* Environment row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 p-2.5 rounded-sm" style={{ background: 'rgba(31,111,235,0.06)', border: '1px solid rgba(31,111,235,0.14)' }}>
                    <div className="flex items-center gap-1.5">
                      <Map className="w-2.5 h-2.5 text-[#4B6A8A]" />
                      <span className="text-[7px] font-bold uppercase tracking-wider text-[#6B7280]">Terrain</span>
                    </div>
                    <span className="text-[11px] font-bold font-mono text-[#E6EDF3]">{activeScenario.terrainType}</span>
                    <span className="text-[7px] font-mono text-[#F59E0B] uppercase">Operational</span>
                  </div>
                  <div className="flex flex-col gap-1 p-2.5 rounded-sm" style={{ background: 'rgba(31,111,235,0.06)', border: '1px solid rgba(31,111,235,0.14)' }}>
                    <div className="flex items-center gap-1.5">
                      <Wind className="w-2.5 h-2.5 text-[#4B6A8A]" />
                      <span className="text-[7px] font-bold uppercase tracking-wider text-[#6B7280]">Weather</span>
                    </div>
                    <span className="text-[11px] font-bold font-mono text-[#E6EDF3]">{activeScenario.weather ?? 'Partly Cloudy'}</span>
                    <span className="text-[7px] font-mono text-[#22C55E] uppercase">Visibility Good</span>
                  </div>
                </div>

                {/* Forces Summary */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="h-px flex-1" style={{ background: 'rgba(31,111,235,0.15)' }} />
                    <span className="text-[7px] font-bold uppercase tracking-[0.25em] text-[#4B6A8A]">Forces Summary</span>
                    <div className="h-px flex-1" style={{ background: 'rgba(31,111,235,0.15)' }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Friendly', value: units.filter(u => u.type === 'FRIENDLY').length, color: '#3B82F6' },
                      { label: 'Enemy', value: units.filter(u => u.type === 'ENEMY').length, color: '#EF4444' },
                      { label: 'Objectives', value: units.filter(u => u.type === 'OBJECTIVE').length, color: '#F59E0B' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex flex-col items-center py-2.5 rounded-sm" style={{ background: 'rgba(10,16,30,0.70)', border: '1px solid rgba(31,111,235,0.10)' }}>
                        <span className="text-lg font-headline font-bold leading-none" style={{ color }}>{value}</span>
                        <span className="text-[7px] font-mono text-[#4B5563] uppercase mt-1">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mission Objectives */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crosshair className="w-2.5 h-2.5 text-[#F59E0B]" />
                    <span className="text-[7px] font-bold uppercase tracking-[0.25em] text-[#4B6A8A]">Mission Objectives</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {units.filter(u => u.type === 'OBJECTIVE').length > 0 ? (
                      units.filter(u => u.type === 'OBJECTIVE').map((obj, i) => (
                        <div key={obj.id} className="flex items-center gap-2.5 p-2 rounded-sm" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                          <Crosshair className="w-2.5 h-2.5 text-[#F59E0B] shrink-0" />
                          <span className="text-[9px] font-mono text-[#E6EDF3]">{obj.label}</span>
                          <span className="ml-auto text-[7px] font-mono text-[#4B5563]">Grid [{obj.x},{obj.y}]</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 rounded-sm" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.10)' }}>
                        <p className="text-[8px] font-mono text-[#6B7280] italic">No specific objectives marked. Engage targets of opportunity.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'rgba(31,111,235,0.15)', background: 'rgba(8,12,24,0.60)' }}>
                <span className="text-[7px] font-mono text-[#374151] uppercase tracking-widest">WARMATRIX // MISSION BRIEF // CLASSIFIED</span>
                <button
                  onClick={() => setIsBriefingModalOpen(false)}
                  className="px-4 py-1.5 rounded-sm text-[8px] font-bold uppercase tracking-widest transition-all"
                  style={{ background: 'rgba(31,111,235,0.15)', border: '1px solid rgba(31,111,235,0.35)', color: '#3A8DFF' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.28)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.15)'; }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CENTER ZONE */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* MAP ZONE */}
          <div className="flex-1 relative overflow-hidden border border-[#1F6FEB]/20">
            {isBuilderWorkspaceActive ? (
              <ScenarioBuilder
                units={units as any}
                onUpdateUnits={(u) => setUnits(u as Unit[])}
                isOpen={true}
                onClose={handleBuilderWorkspaceClose}
                onScenarioGenerated={handleScenarioGenerated}
                onBriefingGenerated={handleBriefingGenerated}
                onOperationConfigured={handleOperationConfigured}
                initialMode={builderScenarioMode === 'selection' ? null : builderScenarioMode === 'random' ? 'AI' : 'CUSTOM'}
                isInline={true}
              />
            ) : activeScenario ? (
              <TacticalMapDisplay
                units={visibleUnits}
                terrainType={terrainType as any}
                weather={activeScenario.weather}
                scenarioTitle={displayScenarioTitle}
                mapPeaks={activeScenario.mapPeaks}
                movements={movementEvents}
                combatEvents={combatEvents}
                unitHpById={unitHpById}
                objectiveProgressById={objectiveProgressById}
                onEndSimulation={handleEndSimulation}
                onExecuteTurn={() => handleExecuteCommand("Proceed to next turn")}
                terrainMapData={tacticalTerrainMapData}
                terrainVersionKey={terrainVersionKey}
              />
            ) : centerScenarioMode !== 'default' ? (
              <ScenarioBuilder
                units={units as any}
                onUpdateUnits={(u) => setUnits(u as Unit[])}
                isOpen={true}
                onClose={handleCenterScenarioClose}
                onScenarioGenerated={handleScenarioGenerated}
                onOperationConfigured={handleOperationConfigured}
                initialMode={centerScenarioMode === 'random' ? 'AI' : 'CUSTOM'}
                isInline={true}
              />
            ) : (
              /* ── NO SIMULATION STATE ── */
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-6"
                style={{
                  background: 'linear-gradient(160deg, rgba(4,8,16,0.98) 0%, rgba(6,14,28,0.98) 50%, rgba(4,8,18,0.98) 100%)',
                }}
              >
                {/* Subtle grid overlay */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(31,111,235,0.15) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(31,111,235,0.15) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px',
                  }}
                />

                {/* Corner brackets */}
                <div className="absolute top-3 left-3 w-5 h-5 border-t border-l border-[#1F6FEB]/30" />
                <div className="absolute top-3 right-3 w-5 h-5 border-t border-r border-[#1F6FEB]/30" />
                <div className="absolute bottom-3 left-3 w-5 h-5 border-b border-l border-[#1F6FEB]/30" />
                <div className="absolute bottom-3 right-3 w-5 h-5 border-b border-r border-[#1F6FEB]/30" />

                {/* Status icon */}
                <div className="relative z-10 flex flex-col items-center gap-5">
                  <div
                    className="w-20 h-20 flex items-center justify-center rounded-sm border"
                    style={{
                      background: 'rgba(31,111,235,0.06)',
                      borderColor: 'rgba(31,111,235,0.20)',
                      boxShadow: '0 0 30px rgba(31,111,235,0.08)',
                    }}
                  >
                    <AlertCircle className="w-9 h-9 text-[#1F6FEB]/40" />
                  </div>

                  <div className="text-center">
                    <p className="text-[11px] font-mono font-bold uppercase tracking-[0.3em] text-[#E6EDF3]/30 mb-2">
                      NO SIMULATION ACTIVE
                    </p>
                    <p className="text-[9px] font-mono text-[#374151] uppercase tracking-wider">
                      Deploy a scenario to initialize the tactical map
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      suppressHydrationWarning
                      onClick={() => { setCenterScenarioMode('random'); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-sm border text-[9px] font-bold uppercase tracking-widest transition-all"
                      style={{
                        background: 'rgba(139,92,246,0.10)',
                        borderColor: 'rgba(139,92,246,0.35)',
                        color: '#A78BFA',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.20)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(139,92,246,0.20)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.10)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                      }}
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      Random Scenario
                    </button>
                    <button
                      suppressHydrationWarning
                      onClick={() => { setCenterScenarioMode('custom'); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-sm border text-[9px] font-bold uppercase tracking-widest transition-all"
                      style={{
                        background: 'rgba(31,111,235,0.08)',
                        borderColor: 'rgba(31,111,235,0.25)',
                        color: '#3A8DFF',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.16)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(31,111,235,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.08)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                      }}
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      Custom Build
                    </button>
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#374151]" />
                    <span className="text-[7px] font-mono text-[#374151] uppercase tracking-widest">
                      WARMATRIX ENGINE STANDBY
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT ZONE: Command Link */}
        <div className="w-80 flex flex-col shrink-0">
          <TacticalWidget
            title="Command Link"
            icon={MessageSquare}
            className="flex-1"
            headerAction={
              <button
                suppressHydrationWarning
                onClick={() => setIsCommsConsoleOpen(true)}
                className="w-5 h-5 flex items-center justify-center rounded-sm border border-[#1F6FEB]/20 text-[#1F6FEB]/50 hover:text-[#3A8DFF] hover:border-[#1F6FEB]/50 transition-all"
                title="Open Strategic Ops Console"
              >
                <Maximize2 className="w-2.5 h-2.5" />
              </button>
            }
          >
            <div className="flex-1 flex flex-col min-h-0">
              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto warmatrix-scrollbar py-2 flex flex-col gap-2 min-h-0">
                {chatMessages.map((msg) => {
                  const style = WIDGET_SOURCE_STYLE[msg.source as MessageSource] || WIDGET_SOURCE_STYLE.SYSTEM;
                  const isUser = msg.source === 'COMMAND_INPUT';
                  return (
                    <div key={msg.id} className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 px-0.5">
                        {!isUser && <div className="w-1 h-1 rounded-full" style={{ background: style.dot, boxShadow: `0 0 3px ${style.dot}` }} />}
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: style.color }}>{style.label}</span>
                        <span className="text-[8px] font-mono text-[#4B5563]">{msg.timestamp}</span>
                        {isUser && <div className="w-1 h-1 rounded-full" style={{ background: style.dot }} />}
                      </div>
                      <div
                        className="max-w-[90%] rounded-sm p-1.5 border"
                        style={isUser ? {
                          background: 'rgba(31,111,235,0.08)',
                          borderColor: 'rgba(31,111,235,0.20)',
                        } : {
                          background: 'rgba(10,16,30,0.60)',
                          borderColor: 'rgba(31,111,235,0.10)',
                        }}
                      >
                        {msg.headline && (
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#E6EDF3] mb-1 leading-tight">
                            {msg.headline}
                          </p>
                        )}
                        <div className="text-[10px] font-mono leading-relaxed text-[#9CA3AF] max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({node, ...props}) => <table className="border-collapse border border-[#1F6FEB]/20 my-1.5 w-full text-[8px]" {...props} />,
                              th: ({node, ...props}) => <th className="border border-[#1F6FEB]/20 px-1.5 py-0.5 bg-[#1F6FEB]/10 text-[#3A8DFF] font-bold uppercase tracking-wider text-[7px]" {...props} />,
                              td: ({node, ...props}) => <td className="border border-[#1F6FEB]/20 px-1.5 py-0.5 text-[8px]" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc ml-3 my-1.5 flex flex-col gap-0.5" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal ml-3 my-1.5 flex flex-col gap-0.5" {...props} />,
                              li: ({node, ...props}) => <li className="mb-0" {...props} />,
                              strong: ({node, ...props}) => <strong className="text-[#3A8DFF] font-bold" {...props} />
                            }}
                          >
                            {msg.body}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={widgetChatEndRef} />
              </div>

              {/* Input Bar */}
              <div className="pt-3 border-t border-[#1F6FEB]/10">
                <form onSubmit={handleExecuteCommand} className="flex gap-1.5">
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#1F6FEB]/50 bg-transparent">&gt; _</span>
                    <input
                      suppressHydrationWarning
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={activeScenario ? 'Enter tactical directive to initiate system simulation...' : 'System ready. Enter command link directive...'}
                      className="w-full h-8 bg-[#0D223A]/30 border border-[#1F6FEB]/20 rounded-sm pl-8 pr-2 text-[10px] font-mono text-white placeholder:text-[#374151] focus:outline-none focus:border-[#3A8DFF]/40 transition-all"
                      disabled={status === 'PROCESSING'}
                    />
                  </div>
                  <button
                    suppressHydrationWarning
                    type="submit"
                    disabled={!inputValue.trim() || status === 'PROCESSING'}
                    className="w-8 h-8 bg-[#0D1830] hover:bg-[#1A3B5D] disabled:opacity-30 flex items-center justify-center rounded-sm border border-[#1F6FEB]/25 transition-all text-[#3A8DFF]"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </form>
              </div>
            </div>
          </TacticalWidget>
        </div>
      </main>

      <SecureCommsConsole
        messages={chatMessages}
        onMessagesChange={setChatMessages}
        isOpen={isCommsConsoleOpen}
        onClose={() => setIsCommsConsoleOpen(false)}
        battlefieldContext={activeScenario
          ? `Turn ${turn}. Role: ${role}. Scenario: ${activeScenario.title}. Terrain: ${activeScenario.terrainType}. ${units.map(u => `${u.label} (${u.type}) at [${u.x},${u.y}]`).join(', ')}.`
          : `No scenario active. Role: ${role}.`}
      />

      <TacticalHandbookConsole 
        isOpen={isHandbookConsoleOpen}
        onClose={() => setIsHandbookConsoleOpen(false)}
      />

      <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      {/* Sidebar Dashboard Modal */}
      {isDashboardOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-[#02060E]/80 backdrop-blur-md">
          <div className="w-[90vw] max-w-[800px] h-[85vh] flex flex-col rounded-sm shadow-2xl relative" style={{
            background: 'linear-gradient(160deg, rgba(8,14,28,0.95) 0%, rgba(10,16,30,0.98) 100%)',
            border: '1px solid rgba(31,111,235,0.4)',
          }}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#1F6FEB]/20 bg-[#0A101C]/80 shadow-[0_4px_20px_rgba(31,111,235,0.05)]">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-[#3A8DFF] animate-pulse" />
                <h2 className="text-[16px] font-mono font-bold text-[#E6EDF3] tracking-[0.2em] uppercase">
                  Tactical Command Dashboard
                </h2>
              </div>
              <button
                onClick={() => setIsDashboardOpen(false)}
                className="text-[#4B6A8A] hover:text-[#EF4444] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 warmatrix-scrollbar">
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                <SidebarAccordion
                  activeScenario={activeScenario}
                  lastResult={lastResult}
                  loadingAnalysis={loadingAnalysis}
                  analysis={analysis}
                  turn={turn}
                  onMaximizeHandbook={() => {
                    setIsDashboardOpen(false);
                    setIsHandbookConsoleOpen(true);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
