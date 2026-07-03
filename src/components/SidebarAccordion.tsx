'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    CloudRain,
    Eye,
    Wind,
    Thermometer,
    MapIcon,
    Shield,
    Crosshair,
    AlertTriangle,
    Swords,
    Activity,
    Radio,
    ChevronDown,
    ChevronRight,
    Users,
    Truck,
    PlaneTakeoff,
    Boxes as BoxesIcon,
    BrainCircuit,
    Zap,
    FileText,
    Bell,
    BookOpen,
    MapPin,
    Clock,
    LucideIcon,
} from 'lucide-react';
import { TacticalHandbook } from './TacticalHandbook';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveScenario {
    title: string;
    briefing: string;
    terrainType: string;
    units: any[];
}

interface SidebarAccordionProps {
    activeScenario: ActiveScenario | null;
    lastResult: { command: string; success: number; risk: number; outcome: string } | null;
    loadingAnalysis: boolean;
    analysis: any;
    turn: number;
    onMaximizeHandbook?: () => void;
}

// ─── Accordion Panel ─────────────────────────────────────────────────────────

interface AccordionPanelProps {
    id: string;
    title: string;
    icon: LucideIcon;
    activeId: string | null;
    onToggle: (id: string) => void;
    children: React.ReactNode;
    statusDot?: 'green' | 'red' | 'amber' | 'gray';
    overrideIconColor?: string;
}

function AccordionPanel({
    id,
    title,
    icon: Icon,
    activeId,
    onToggle,
    children,
    statusDot,
    overrideIconColor,
}: AccordionPanelProps) {
    const isOpen = activeId === id;
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);
    const [isTransitioned, setIsTransitioned] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsTransitioned(false);
            if (contentRef.current) {
                setHeight(contentRef.current.scrollHeight);
            }
        } else {
            setIsTransitioned(false);
            if (contentRef.current) {
                setHeight(contentRef.current.scrollHeight);
                void contentRef.current.offsetHeight; // force reflow
            }
            const timer = setTimeout(() => {
                setHeight(0);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
        if (e.propertyName === 'height' && isOpen) {
            setIsTransitioned(true);
        }
    };

    const dotColors = {
        green: '#22C55E',
        red: '#EF4444',
        amber: '#F59E0B',
        gray: '#4B5563',
    };

    return (
        <div
            className="rounded-sm overflow-hidden"
            style={{
                background: 'rgba(8,14,28,0.85)',
                border: `1px solid ${isOpen ? 'rgba(31,111,235,0.45)' : 'rgba(31,111,235,0.18)'}`,
                transition: 'border-color 0.25s ease',
                boxShadow: isOpen ? '0 0 16px rgba(31,111,235,0.06)' : 'none',
            }}
        >
            {/* Header */}
            <button
                suppressHydrationWarning
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left group"
                style={{ outline: 'none' }}
                onClick={() => onToggle(id)}
            >
                {/* Status dot */}
                {statusDot && (
                    <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                            background: dotColors[statusDot],
                            boxShadow: statusDot !== 'gray' ? `0 0 5px ${dotColors[statusDot]}80` : 'none',
                        }}
                    />
                )}

                <Icon
                    className="w-3 h-3 shrink-0"
                    style={{ color: overrideIconColor || (isOpen ? '#3A8DFF' : '#4B6A8A') }}
                />

                <span
                    className="flex-1 text-[12.5px] font-bold uppercase tracking-widest truncate"
                    style={{ color: isOpen ? '#E6EDF3' : '#8B9BAF' }}
                >
                    {title}
                </span>

                <ChevronDown
                    className="w-3 h-3 shrink-0 transition-transform duration-200"
                    style={{
                        color: isOpen ? '#3A8DFF' : '#4B6A8A',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                />
            </button>

            {/* Expandable content */}
            <div
                onTransitionEnd={handleTransitionEnd}
                style={{
                    height: isOpen ? (isTransitioned ? 'auto' : `${height}px`) : '0px',
                    overflow: isOpen && isTransitioned ? 'visible' : 'hidden',
                    transition: 'height 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <div
                    ref={contentRef}
                    className="px-3 pb-3"
                    style={{ 
                        borderTop: '1px solid rgba(31,111,235,0.12)'
                    }}
                >
                    <div className="pt-2.5">{children}</div>
                </div>
            </div>
        </div>
    );
}

// ─── Data Row ────────────────────────────────────────────────────────────────

function DataRow({
    icon: Icon,
    label,
    value,
    valueColor,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    valueColor?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-[#1F6FEB]/08 last:border-0">
            <div className="flex items-center gap-1.5">
                <Icon className="w-2.5 h-2.5 text-[#4B6A8A] shrink-0" />
                <span className="text-[11px] uppercase font-bold tracking-wider text-[#6B7280]">
                    {label}
                </span>
            </div>
            <span
                className="text-[12.5px] font-mono font-bold"
                style={{ color: valueColor ?? '#C9D3E0' }}
            >
                {value}
            </span>
        </div>
    );
}

// ─── Last Known Coords Panel ──────────────────────────────────────────────────

function LastKnownCoordsPanel({ activeScenario }: { activeScenario: ActiveScenario | null }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (isExpanded && contentRef.current) {
            setHeight(contentRef.current.scrollHeight);
        } else {
            setHeight(0);
        }
    }, [isExpanded]);

    // Derive coordinates from the first enemy unit on the grid
    const primaryEnemy = useMemo(
        () => activeScenario?.units.find(u => u.type === 'ENEMY') ?? null,
        [activeScenario]
    );

    // Build a simple timestamp anchored to the current scenario / turn
    const [timestamp, setTimestamp] = useState<string | null>(null);

    useEffect(() => {
        if (!activeScenario) {
            setTimestamp(null);
            return;
        }
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        setTimestamp(`${hh}:${mm}:${ss}Z`);
    }, [activeScenario]);

    const gridX = primaryEnemy?.x ?? null;
    const gridY = primaryEnemy?.y ?? null;
    const hasCoords = gridX !== null && gridY !== null;

    return (
        <div className="mt-1.5 rounded-sm overflow-hidden" style={{ border: '1px solid rgba(31,111,235,0.14)' }}>
            {/* Sub-header, clickable */}
            <button
                suppressHydrationWarning
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
                style={{
                    background: isExpanded ? 'rgba(31,111,235,0.10)' : 'rgba(10,14,28,0.60)',
                    outline: 'none',
                    transition: 'background 0.2s',
                }}
                onClick={() => setIsExpanded(p => !p)}
            >
                <MapPin className="w-2.5 h-2.5 shrink-0" style={{ color: isExpanded ? '#3A8DFF' : '#4B6A8A' }} />
                <span
                    className="flex-1 text-[11px] uppercase font-bold tracking-wider"
                    style={{ color: isExpanded ? '#9CA3AF' : '#6B7280' }}
                >
                    Last Known Coords
                </span>
                {activeScenario && hasCoords && !isExpanded && (
                    <span className="text-[11.5px] font-mono" style={{ color: '#C9D3E0' }}>
                        {gridX},{gridY}
                    </span>
                )}
                <ChevronRight
                    className="w-2.5 h-2.5 shrink-0 transition-transform duration-200"
                    style={{
                        color: isExpanded ? '#3A8DFF' : '#4B6A8A',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                />
            </button>

            {/* Expandable body */}
            <div style={{ height: `${height}px`, overflow: 'hidden', transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
                <div ref={contentRef} className="px-3 py-2.5" style={{ 
                    borderTop: '1px solid rgba(31,111,235,0.10)'
                }}>
                    {activeScenario && hasCoords ? (
                        <div className="flex flex-col gap-1.5">
                            {/* Title */}
                            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#4B6A8A] block">
                                Last Known Coordinates
                            </span>

                            {/* Coordinate grid */}
                            <div
                                className="rounded-sm p-2.5 flex flex-col gap-1.5"
                                style={{
                                    background: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.18)',
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[12.5px] font-bold uppercase tracking-wider text-[#6B7280]">X</span>
                                    <span className="text-[17px] font-headline font-bold text-[#EF4444]">{gridX}</span>
                                </div>
                                <div className="h-px" style={{ background: 'rgba(239,68,68,0.12)' }} />
                                <div className="flex items-center justify-between">
                                    <span className="text-[12.5px] font-bold uppercase tracking-wider text-[#6B7280]">Y</span>
                                    <span className="text-[17px] font-headline font-bold text-[#EF4444]">{gridY}</span>
                                </div>
                            </div>

                            {/* Timestamp */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Clock className="w-2 h-2 text-[#4B5563]" />
                                <span className="text-[10px] font-mono text-[#4B5563] uppercase tracking-wider">
                                    Last Update: {timestamp}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] font-mono text-[#374151] italic">
                            {activeScenario ? 'No enemy units detected.' : 'No scenario active.'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Sidebar Accordion Component ─────────────────────────────────────────────

export function SidebarAccordion({
    activeScenario,
    lastResult,
    loadingAnalysis,
    analysis,
    turn,
    onMaximizeHandbook,
}: SidebarAccordionProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const handleToggle = (id: string) => {
        setActiveId(prev => (prev === id ? null : id));
    };

    const friendly = activeScenario?.units.filter(u => u.type === 'FRIENDLY').length ?? 0;
    const enemy = activeScenario?.units.filter(u => u.type === 'ENEMY').length ?? 0;
    const objective = activeScenario?.units.filter(u => u.type === 'OBJECTIVE').length ?? 0;
    const total = activeScenario?.units.length ?? 0;

    return (
        <div className="flex flex-col gap-2">

            {/* ── 1. Weather Status ── */}
            <AccordionPanel
                id="weather"
                title="Weather Status"
                icon={CloudRain}
                activeId={activeId}
                onToggle={handleToggle}
                statusDot={activeScenario ? 'green' : 'gray'}
            >
                <div className="flex flex-col gap-1.5">
                    <DataRow
                        icon={Thermometer}
                        label="Temperature"
                        value={activeScenario ? '18°C / 64°F' : '— —'}
                        valueColor={activeScenario ? '#F59E0B' : '#4B5563'}
                    />
                    <DataRow
                        icon={Eye}
                        label="Visibility"
                        value={activeScenario ? '8.5 KM' : '— —'}
                        valueColor={activeScenario ? '#22C55E' : '#4B5563'}
                    />
                    <DataRow
                        icon={Wind}
                        label="Wind Speed"
                        value={activeScenario ? '14 KT NE' : '— —'}
                        valueColor={activeScenario ? '#38BDF8' : '#4B5563'}
                    />
                    <DataRow
                        icon={MapIcon}
                        label="Terrain Impact"
                        value={activeScenario ? 'MODERATE' : 'N/A'}
                        valueColor={activeScenario ? '#F59E0B' : '#4B5563'}
                    />
                    <DataRow
                        icon={CloudRain}
                        label="Condition"
                        value={activeScenario ? 'PARTLY CLOUDY' : 'STANDBY'}
                        valueColor={activeScenario ? '#C9D3E0' : '#4B5563'}
                    />
                </div>
            </AccordionPanel>

            {/* ── 2. Enemy Intelligence ── */}
            <AccordionPanel
                id="intel"
                title="Enemy Intelligence"
                icon={Crosshair}
                activeId={activeId}
                onToggle={handleToggle}
                statusDot={activeScenario ? 'red' : 'gray'}
                overrideIconColor={activeId === 'intel' ? '#EF4444' : '#4B6A8A'}
            >
                <div className="flex flex-col gap-1.5">
                    <DataRow
                        icon={Swords}
                        label="Detected Units"
                        value={activeScenario ? `${enemy} HOSTILES` : '—'}
                        valueColor={activeScenario && enemy > 0 ? '#EF4444' : '#4B5563'}
                    />
                    <DataRow
                        icon={AlertTriangle}
                        label="Threat Level"
                        value={activeScenario ? (enemy > 6 ? 'CRITICAL' : enemy > 3 ? 'HIGH' : 'MODERATE') : '—'}
                        valueColor={
                            activeScenario
                                ? enemy > 6 ? '#EF4444' : enemy > 3 ? '#F59E0B' : '#22C55E'
                                : '#4B5563'
                        }
                    />
                </div>

                {/* Last Known Coords — expandable coordinate block */}
                <LastKnownCoordsPanel activeScenario={activeScenario} />

                {activeScenario && (
                    <div
                        className="mt-2.5 p-2 rounded-sm"
                        style={{
                            background: 'rgba(239,68,68,0.07)',
                            border: '1px solid rgba(239,68,68,0.18)',
                        }}
                    >
                        <p className="text-[11.5px] font-mono text-[#9CA3AF] leading-relaxed">
                            INTEL DIVISION: {enemy} enemy unit{enemy !== 1 ? 's' : ''} identified on grid. Recommend immediate counter-response.
                        </p>
                    </div>
                )}
            </AccordionPanel>

            {/* ── 3. Force Deployment Status ── */}
            <AccordionPanel
                id="forces"
                title="Force Deployment Status"
                icon={Shield}
                activeId={activeId}
                onToggle={handleToggle}
                statusDot={activeScenario ? 'green' : 'gray'}
            >
                <div className="flex flex-col gap-1.5">
                    <DataRow
                        icon={Users}
                        label="Infantry Units"
                        value={activeScenario ? `${Math.max(1, Math.round(friendly * 0.45))} SQDS` : '—'}
                        valueColor={activeScenario ? '#3B82F6' : '#4B5563'}
                    />
                    <DataRow
                        icon={Truck}
                        label="Armored Units"
                        value={activeScenario ? `${Math.max(0, Math.round(friendly * 0.25))} VEH` : '—'}
                        valueColor={activeScenario ? '#3B82F6' : '#4B5563'}
                    />
                    <DataRow
                        icon={PlaneTakeoff}
                        label="Air Support"
                        value={activeScenario ? `${Math.max(0, Math.round(friendly * 0.15))} CRAFT` : '—'}
                        valueColor={activeScenario ? '#3B82F6' : '#4B5563'}
                    />
                    <DataRow
                        icon={BoxesIcon}
                        label="Reserve Forces"
                        value={activeScenario ? `${Math.max(1, Math.round(friendly * 0.15))} SQDS` : '—'}
                        valueColor={activeScenario ? '#9CA3AF' : '#4B5563'}
                    />
                </div>
                {activeScenario && (
                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#4B5563] uppercase tracking-wider">
                            Total Forces
                        </span>
                        <span className="text-[15px] font-bold font-mono text-[#3B82F6]">
                            {friendly} <span className="text-[#4B5563] text-[11.5px]">UNITS</span>
                        </span>
                    </div>
                )}
            </AccordionPanel>

            {/* ── 4. Objectives ── */}
            <AccordionPanel
                id="objectives"
                title="Objectives"
                icon={Crosshair}
                activeId={activeId}
                onToggle={handleToggle}
                statusDot={activeScenario ? (objective > 0 ? 'amber' : 'gray') : 'gray'}
            >
                <div className="flex flex-col gap-3">
                    {activeScenario && activeScenario.units.filter(u => u.type === 'OBJECTIVE').length > 0 ? (
                        activeScenario.units.filter(u => u.type === 'OBJECTIVE').map((obj, i) => (
                            <div
                                key={obj.id || i}
                                className="p-2.5 rounded-sm flex flex-col gap-2"
                                style={{
                                    background: 'rgba(31,111,235,0.04)',
                                    border: '1px solid rgba(31,111,235,0.12)',
                                }}
                            >
                                <div className="flex items-center justify-between border-b border-[#1F6FEB]/10 pb-1.5 mb-0.5">
                                    <span className="text-[14px] font-bold text-[#E6EDF3] uppercase tracking-wide">
                                        {obj.label}
                                    </span>
                                    <span className="text-[11.5px] font-mono text-[#F59E0B] uppercase font-bold">
                                        Active
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] uppercase font-bold text-[#4B6A8A]">Type</span>
                                        <span className="text-[12.5px] font-mono text-[#C9D3E0]">
                                            {obj.assetClass === 'Infrastructure' ? 'Strategic' : obj.assetClass === 'Objective' ? 'Tactical' : 'Recon'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] uppercase font-bold text-[#4B6A8A]">Location</span>
                                        <span className="text-[12.5px] font-mono text-[#C9D3E0]">
                                            X:{obj.x} Y:{obj.y}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] uppercase font-bold text-[#4B6A8A]">Assigned Units</span>
                                        <span className="text-[12.5px] font-mono text-[#3B82F6]">
                                            Infantry Squad B
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] uppercase font-bold text-[#4B6A8A]">Threat Level</span>
                                        <span className="text-[12.5px] font-mono text-[#EF4444]">
                                            Medium
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[11px] font-mono text-[#374151] italic text-center py-2">
                            No active objectives identified.
                        </p>
                    )}
                </div>
            </AccordionPanel>

            {/* ── 5. Threat Assessment Engine ── */}
            <AccordionPanel
                id="threat"
                title="Threat Assessment Engine"
                icon={BrainCircuit}
                activeId={activeId}
                onToggle={handleToggle}
                statusDot={activeScenario ? (loadingAnalysis ? 'amber' : 'green') : 'gray'}
            >
                <div className="flex flex-col gap-1.5">
                    <DataRow
                        icon={AlertTriangle}
                        label="Risk Level"
                        value={analysis ? 'LOW-MODERATE' : activeScenario ? 'CALCULATING…' : '—'}
                        valueColor={analysis ? '#F59E0B' : activeScenario ? '#A78BFA' : '#4B5563'}
                    />
                    <DataRow
                        icon={Crosshair}
                        label="Attack Probability"
                        value={activeScenario ? '62%' : '—'}
                        valueColor={activeScenario ? '#EF4444' : '#4B5563'}
                    />
                    <DataRow
                        icon={Shield}
                        label="Def. Vulnerabilities"
                        value={activeScenario ? '3 SECTORS' : '—'}
                        valueColor={activeScenario ? '#F59E0B' : '#4B5563'}
                    />
                    <DataRow
                        icon={BrainCircuit}
                        label="AI Prediction Score"
                        value={activeScenario ? (analysis ? '84.2%' : 'N/A') : '—'}
                        valueColor={activeScenario && analysis ? '#22C55E' : '#4B5563'}
                    />
                </div>
                {activeScenario && (
                    <div
                        className="mt-2.5 p-2 rounded-sm"
                        style={{
                            background: loadingAnalysis ? 'rgba(167,139,250,0.07)' : 'rgba(31,111,235,0.06)',
                            border: `1px solid ${loadingAnalysis ? 'rgba(167,139,250,0.20)' : 'rgba(31,111,235,0.15)'}`,
                        }}
                    >
                        {loadingAnalysis ? (
                            <p className="text-[11.5px] font-mono text-[#A78BFA] leading-relaxed">
                                AI ENGINE ANALYZING battlefield data — Turn {turn}…
                            </p>
                        ) : (
                            <p className="text-[11.5px] font-mono text-[#9CA3AF] leading-relaxed">
                                {analysis
                                    ? 'Operational environment assessed. Strategic recommendations cached.'
                                    : 'No active scenario. Deploy forces to activate threat analysis.'}
                            </p>
                        )}
                    </div>
                )}
            </AccordionPanel>

            {/* ── 6. SOP Tactical Handbook ── */}
            <AccordionPanel
                id="handbook"
                title="SOP Tactical Handbook"
                icon={BookOpen}
                activeId={activeId}
                onToggle={handleToggle}
                statusDot="gray"
            >
                <TacticalHandbook onMaximize={onMaximizeHandbook} />
            </AccordionPanel>

        </div>
    );
}
