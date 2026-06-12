'use client';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { RotateCcw, ZoomIn, ZoomOut, Square, Zap } from 'lucide-react';
import { TacticalTerrainMapData } from '@/lib/tacticalTerrain';
import { TerrainPeak, TACTICAL_CONTOUR_LEVELS, buildProceduralHeightmap } from '@/lib/proceduralTerrainHeightmap';
import type { TacticalMap3DControls } from '@/components/TacticalMap3D';

const TacticalMap3D = dynamic(
    () => import('@/components/TacticalMap3D').then((mod) => mod.TacticalMap3D),
    { ssr: false },
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioUnit {
    id: string;
    type: 'FRIENDLY' | 'ENEMY' | 'OBJECTIVE';
    x: number; // 1-11
    y: number; // 1-7
    label: string;
    assetClass?: string;
    allianceRole?: string;
    hp?: number;
    maxHp?: number;
}

interface UnitMovement {
    unit_id: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
}

interface CombatEvent {
    attacker_id: string;
    defender_id: string;
    outcome: string;
    damage: number;
}

type WeatherType = 'Clear' | 'Partly Cloudy' | 'Storm' | 'Fog' | 'Heavy Rain' | 'Sandstorm';

interface TacticalMapDisplayProps {
    units: ScenarioUnit[];
    terrainType?: 'Highland' | 'Forest' | 'Urban' | 'Plains' | 'Desert' | 'Mountain' | 'Coastal' | 'Arctic';
    weather?: WeatherType;
    scenarioTitle?: string;
    mapPeaks?: { cx: number; cy: number; h: number; r2: number }[];
    movements?: UnitMovement[];
    combatEvents?: CombatEvent[];
    unitHpById?: Record<string, { hp: number; maxHp: number }>;
    objectiveProgressById?: Record<string, { friendly: number; enemy: number; controller: 'FRIENDLY' | 'ENEMY' | 'NEUTRAL' }>;
    onEndSimulation?: () => void;
    onExecuteTurn?: () => void;
    terrainMapData?: TacticalTerrainMapData;
    terrainVersionKey?: string;
}

// ─── Terrain palettes ─────────────────────────────────────────────────────────

const neonBlueStyle = {
    bg: '#02060E',
    tint0: 'rgba(2, 6, 15, 1)',
    tint1: 'rgba(2, 8, 22, 1)',
    tint2: 'rgba(2, 12, 34, 1)',
    tint3: 'rgba(2, 18, 50, 1)',
    tint4: 'rgba(2, 28, 70, 1)',
    contour0: 'rgba(10, 45, 140, 0.45)',
    contour1: 'rgba(15, 75, 200, 0.65)',
    contour2: 'rgba(25, 120, 255, 0.85)',
    contourPeak: 'rgba(80, 200, 255, 0.98)',
    gridLine: 'rgba(31, 111, 235, 0.16)',
    axisText: 'rgba(31, 111, 235, 0.45)',
    infoColor: '#00C8FF',
};

const TERRAIN_CONFIG = {
    Highland: { ...neonBlueStyle, label: 'Highland / Rugged', elevTag: 'HIGH ALT' },
    Forest: { ...neonBlueStyle, label: 'Dense Forest', elevTag: 'CANOPY' },
    Urban: { ...neonBlueStyle, label: 'Urban Combat Zone', elevTag: 'STRUCTURE' },
    Plains: { ...neonBlueStyle, label: 'Open Plains', elevTag: 'LOW ALT' },
    Desert: { ...neonBlueStyle, label: 'Desert / Arid', elevTag: 'DUNE FIELD' },
} as const;

type TerrainKey = keyof typeof TERRAIN_CONFIG;
type TC = typeof TERRAIN_CONFIG[TerrainKey];

// ─── Marching-squares contour segments ────────────────────────────────────────

function buildContourPaths(
    map: Float32Array,
    cols: number,
    rows: number,
    levels: number[],
    cellW: number,
    cellH: number,
    padL: number,
    padT: number,
): string[] {
    const idx = (r: number, c: number) => r * (cols + 1) + c;

    return levels.map(level => {
        const segs: string[] = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tl = map[idx(r, c)];
                const tr = map[idx(r, c + 1)];
                const bl = map[idx(r + 1, c)];
                const br = map[idx(r + 1, c + 1)];

                // SVG pixel positions of the four corners
                const x0 = padL + c * cellW;
                const y0 = padT + r * cellH;
                const x1 = x0 + cellW;
                const y1 = y0 + cellH;

                // Edge crossing points (linear interpolation)
                const lerp = (a: number, b: number, t: number) => a + t * (b - a);
                const top = (tl < level) !== (tr < level) ? { x: lerp(x0, x1, (level - tl) / (tr - tl)), y: y0 } : null;
                const bot = (bl < level) !== (br < level) ? { x: lerp(x0, x1, (level - bl) / (br - bl)), y: y1 } : null;
                const lft = (tl < level) !== (bl < level) ? { x: x0, y: lerp(y0, y1, (level - tl) / (bl - tl)) } : null;
                const rgt = (tr < level) !== (br < level) ? { x: x1, y: lerp(y0, y1, (level - tr) / (br - tr)) } : null;

                const pts = [top, bot, lft, rgt].filter(Boolean) as { x: number; y: number }[];
                if (pts.length === 2) {
                    segs.push(
                        `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`
                    );
                }
            }
        }
        return segs.join(' ');
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TacticalMapDisplay({
    units,
    terrainType = 'Highland',
    weather,
    scenarioTitle,
    mapPeaks,
    movements = [],
    combatEvents = [],
    unitHpById,
    objectiveProgressById,
    onEndSimulation,
    onExecuteTurn,
    terrainMapData,
    terrainVersionKey,
}: TacticalMapDisplayProps) {
    const tc: TC = TERRAIN_CONFIG[terrainType as TerrainKey] ?? TERRAIN_CONFIG.Highland;
    const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
    const [view3DSessionKey, setView3DSessionKey] = useState(0);

    // Camera State Persistence
    const [savedCameraState, setSavedCameraState] = useState<{
        position: [number, number, number] | null;
        target: [number, number, number] | null;
    }>({ position: null, target: null });

    const toggle3DView = useCallback((nextView: '2D' | '3D') => {
        setViewMode(nextView);
    }, []);

    useEffect(() => {
        setViewMode('2D');
    }, [terrainVersionKey]);

    useEffect(() => {
        setSelectedUnitId(null);
    }, [terrainVersionKey]);

    // ── Stepped zoom levels: -300% to +300% ──────────────────────────────────
    // -300%, -200%, -100%, 0% (Default), +100%, +200%, +300%
    // Mapped to scale factors: 0.25, 0.33, 0.5, 1.0, 2.0, 3.0, 4.0
    const ZOOM_STAGES = [0.25, 0.33, 0.5, 1.0, 2.0, 3.0, 4.0] as const;
    const DEFAULT_ZOOM = 1.0;

    const snapToZoomLevel = (raw: number, direction: 'in' | 'out'): number => {
        const currentIndex = ZOOM_STAGES.indexOf(raw as any);
        if (currentIndex === -1) return DEFAULT_ZOOM;

        if (direction === 'in') {
            return ZOOM_STAGES[Math.min(ZOOM_STAGES.length - 1, currentIndex + 1)];
        } else {
            return ZOOM_STAGES[Math.max(0, currentIndex - 1)];
        }
    };

    const getZoomPercentageLabel = (z: number): string => {
        if (z === 1.0) return '0%';
        if (z > 1.0) return `+${Math.round((z - 1) * 100)}%`;
        // For values < 1, we use the inverse mapping for labels: 0.5 -> -100%, 0.33 -> -200%, 0.25 -> -300%
        if (z === 0.5) return '-100%';
        if (z === 0.33) return '-200%';
        if (z === 0.25) return '-300%';
        return `${Math.round((z - 1) * 100)}%`;
    };

    // Pan & Zoom State
    const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Hover & Tooltip State
    const [hoveredUnit, setHoveredUnit] = useState<ScenarioUnit | null>(null);
    const [mouseClient, setMouseClient] = useState({ x: 0, y: 0 });
    const tactical3DControlsRef = useRef<TacticalMap3DControls | null>(null);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const activePointerIdRef = useRef<number | null>(null);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const svgRef = useRef<SVGSVGElement>(null);

    // Zoom helpers
    const handleZoomIn = useCallback(() => {
        setZoom(prev => snapToZoomLevel(prev, 'in'));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => snapToZoomLevel(prev, 'out'));
    }, []);

    const handle3DZoomIn = useCallback(() => {
        tactical3DControlsRef.current?.zoomIn();
    }, []);

    const handle3DZoomOut = useCallback(() => {
        tactical3DControlsRef.current?.zoomOut();
    }, []);

    const handle3DRotateLeft = useCallback(() => {
        tactical3DControlsRef.current?.rotateLeft();
    }, []);

    const handle3DRotateRight = useCallback(() => {
        tactical3DControlsRef.current?.rotateRight();
    }, []);

    // Recenter Map: Smoothly moves the map back to the tactical grid center.
    // Preserves the current zoom level as per requirements.
    const handleRecenter = useCallback(() => {
        setIsTransitioning(true);
        setPanX(0);
        setPanY(0);
        // Reset transitioning state after the smooth motion completes (300ms)
        setTimeout(() => setIsTransitioning(false), 300);
    }, []);

    // Keep the wheel listener up-to-date with the SVG element to prevent zoom breaking across view mode changes
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const handleNativeWheel = (e: WheelEvent) => {
            e.preventDefault();
            setZoom(prev => snapToZoomLevel(prev, e.deltaY < 0 ? 'in' : 'out'));
        };

        svg.addEventListener('wheel', handleNativeWheel, { passive: false });

        return () => svg.removeEventListener('wheel', handleNativeWheel);
    }, [viewMode]);

    const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        activePointerIdRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        setMouseClient({ x: e.clientX, y: e.clientY });
    };

    const endDrag = useCallback((pointerId?: number) => {
        setIsDragging(false);
        isDraggingRef.current = false;

        const svg = svgRef.current;
        const idToRelease = typeof pointerId === 'number' ? pointerId : activePointerIdRef.current;
        if (svg && idToRelease !== null && svg.hasPointerCapture(idToRelease)) {
            svg.releasePointerCapture(idToRelease);
        }

        activePointerIdRef.current = null;
    }, []);

    const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
        endDrag(e.pointerId);
    };

    useEffect(() => {
        const onWindowPointerMove = (e: PointerEvent) => {
            const activePointerId = activePointerIdRef.current;
            if (activePointerId === null || e.pointerId !== activePointerId) return;

            setMouseClient({ x: e.clientX, y: e.clientY });
            if (!isDraggingRef.current) return;

            const prev = dragStartRef.current;
            const dx = e.clientX - prev.x;
            const dy = e.clientY - prev.y;
            if (dx !== 0 || dy !== 0) {
                setPanX((v) => v + dx);
                setPanY((v) => v + dy);
                setDragStart({ x: e.clientX, y: e.clientY });
                dragStartRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        const onWindowPointerUp = (e: PointerEvent) => {
            if (activePointerIdRef.current === null || e.pointerId !== activePointerIdRef.current) return;
            endDrag(e.pointerId);
        };

        window.addEventListener('pointermove', onWindowPointerMove, true);
        window.addEventListener('pointerup', onWindowPointerUp, true);
        window.addEventListener('pointercancel', onWindowPointerUp, true);

        return () => {
            window.removeEventListener('pointermove', onWindowPointerMove, true);
            window.removeEventListener('pointerup', onWindowPointerUp, true);
            window.removeEventListener('pointercancel', onWindowPointerUp, true);
        };
    }, [endDrag]);

    useEffect(() => {
        const releaseAndClear = () => {
            endDrag();
        };

        window.addEventListener('pointerup', releaseAndClear, true);
        window.addEventListener('pointercancel', releaseAndClear, true);
        window.addEventListener('blur', releaseAndClear);

        return () => {
            window.removeEventListener('pointerup', releaseAndClear, true);
            window.removeEventListener('pointercancel', releaseAndClear, true);
            window.removeEventListener('blur', releaseAndClear);
        };
    }, [endDrag]);

    // SVG canvas
    const VW = 920;
    const VH = 530;
    const PL = 38, PT = 28, PR = 18, PB = 28;
    const mapW = VW - PL - PR;
    const mapH = VH - PT - PB;
    const COLS = 44;
    const ROWS = 28;
    const cW = mapW / COLS;
    const cH = mapH / ROWS;

    // Tactical Grid Center
    const gridCenterX = PL + mapW / 2;
    const gridCenterY = PT + mapH / 2;

    // Heightmap — restore original 2D terrain synthesis behavior.
    const heightmap = useMemo(
        () => buildProceduralHeightmap(
            terrainType,
            COLS,
            ROWS,
            scenarioTitle ?? 'default_seed',
            mapPeaks as TerrainPeak[] | undefined,
        ),
        [terrainType, scenarioTitle, mapPeaks]
    );

    // Colour each cell by elevation band
    const cellFills = useMemo(() => {
        const fills: { x: number; y: number; fill: string }[] = [];
        const idx = (r: number, c: number) => r * (COLS + 1) + c;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const h = heightmap[idx(r, c)];
                let fill: string;
                if (h < 0.18) fill = tc.tint0;
                else if (h < 0.35) fill = tc.tint1;
                else if (h < 0.52) fill = tc.tint2;
                else if (h < 0.70) fill = tc.tint3;
                else fill = tc.tint4;

                fills.push({ x: PL + c * cW, y: PT + r * cH, fill });
            }
        }
        return fills;
    }, [heightmap, tc, cW, cH]);

    // Contour lines at 6 levels
    const contourLevels = [...TACTICAL_CONTOUR_LEVELS];
    const contourColors = [tc.contour0, tc.contour0, tc.contour1, tc.contour1, tc.contour2, tc.contourPeak];
    const contourWidths = [0.7, 0.9, 1.1, 1.3, 1.8, 2.4];
    const contourGlow = [false, false, false, true, true, true];

    const contourPaths = useMemo(
        () => buildContourPaths(heightmap, COLS, ROWS, contourLevels, cW, cH, PL, PT),
        [heightmap, cW, cH]
    );

    // Elevation spot labels
    const spotLabels = useMemo(() => {
        const spots = [
            [5, 2], [3, 4], [8, 3], [6, 5], [2, 2], [9, 5], [4, 1], [7, 4],
        ] as [number, number][];
        const idx = (r: number, c: number) => r * (COLS + 1) + c;
        return spots
            .map(([c, r]) => {
                const h = heightmap[idx(r, c)] ?? 0;
                if (h < 0.38) return null;
                return {
                    x: PL + c * cW,
                    y: PT + r * cH - 4,
                    m: Math.round(h * 3100 + 180),
                    bright: h > 0.72,
                };
            })
            .filter(Boolean) as { x: number; y: number; m: number; bright: boolean }[];
    }, [heightmap, cW, cH]);

    // Unit pixel coords
    const unitCoords = units.map(u => {
        const isF = u.type === 'FRIENDLY' || u.allianceRole === 'FRIENDLY';
        const isE = u.type === 'ENEMY' || u.allianceRole === 'ENEMY';
        const activeMove = ['Infantry', 'Mechanized', 'Armor', 'Recon'].includes((u as any).assetClass || '');

        let targetX = u.x;
        let targetY = u.y;

        if (activeMove) {
            let possibleTargets = units.filter(t => t.id !== u.id);
            if (isF) {
                possibleTargets = possibleTargets.filter(t => t.type === 'ENEMY' || t.allianceRole === 'ENEMY' || t.type === 'OBJECTIVE' || (t as any).assetClass === 'Objective');
            } else if (isE) {
                possibleTargets = possibleTargets.filter(t => t.type === 'FRIENDLY' || t.allianceRole === 'FRIENDLY' || t.type === 'OBJECTIVE' || (t as any).assetClass === 'Objective');
            }

            let bestDist = Infinity;
            let bestTarget: any = null;
            possibleTargets.forEach(t => {
                const distSq = (t.x - u.x) ** 2 + (t.y - u.y) ** 2;
                if (distSq < bestDist) {
                    bestDist = distSq;
                    bestTarget = t;
                }
            });

            if (bestTarget) {
                const dist = Math.sqrt(bestDist);
                if (dist > 0) {
                    // Route ~40% of the way or up to 7 grid cells to illustrate vector intention graphically
                    const travelDist = Math.max(1, Math.min(dist * 0.4, 7));
                    targetX = Math.round(u.x + ((bestTarget.x - u.x) / dist) * travelDist);
                    targetY = Math.round(u.y + ((bestTarget.y - u.y) / dist) * travelDist);
                }
            } else {
                // Fallback deterministic patrol
                const hash = u.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                targetX = Math.max(1, Math.min(COLS, u.x + (hash % 11) - 5));
                targetY = Math.max(1, Math.min(ROWS, u.y + ((hash >> 2) % 11) - 5));
            }
        }

        targetX = Math.max(1, Math.min(COLS, targetX));
        targetY = Math.max(1, Math.min(ROWS, targetY));

        return {
            ...u,
            px: PL + ((u.x - 0.5) / COLS) * mapW,
            py: PT + ((u.y - 0.5) / ROWS) * mapH,
            tpx: PL + ((targetX - 0.5) / COLS) * mapW,
            tpy: PT + ((targetY - 0.5) / ROWS) * mapH,
            hasTarget: activeMove && (targetX !== u.x || targetY !== u.y)
        };
    });

    const toDisplayX = (x: number) => {
        return Math.max(1, Math.min(COLS, Math.round(x)));
    };
    const toDisplayY = (y: number) => {
        return Math.max(1, Math.min(ROWS, Math.round(y)));
    };

    const movementVectors = useMemo(() => {
        return movements.map((mv) => {
            const fx = toDisplayX(mv.from.x);
            const fy = toDisplayY(mv.from.y);
            const tx = toDisplayX(mv.to.x);
            const ty = toDisplayY(mv.to.y);
            return {
                unit_id: mv.unit_id,
                x1: PL + ((fx - 0.5) / COLS) * mapW,
                y1: PT + ((fy - 0.5) / ROWS) * mapH,
                x2: PL + ((tx - 0.5) / COLS) * mapW,
                y2: PT + ((ty - 0.5) / ROWS) * mapH,
            };
        });
    }, [movements, PL, PT, COLS, ROWS, mapW, mapH]);

    const combatFlashPoints = useMemo(() => {
        return combatEvents
            .map((ev) => {
                const target = unitCoords.find((u) => u.id === ev.defender_id) || unitCoords.find((u) => u.id === ev.attacker_id);
                if (!target) return null;

                const targetIsFriendly = target.type === 'FRIENDLY' || target.allianceRole === 'FRIENDLY';
                const outerFill = targetIsFriendly ? 'rgba(59,130,246,0.28)' : 'rgba(239,68,68,0.26)';
                const innerFill = targetIsFriendly ? 'rgba(147,197,253,0.90)' : 'rgba(248,113,113,0.85)';
                const textFill = targetIsFriendly ? '#BFDBFE' : '#FCA5A5';

                return {
                    key: `${ev.attacker_id}-${ev.defender_id}-${ev.damage}-${ev.outcome}`,
                    x: target.px,
                    y: target.py,
                    damage: ev.damage,
                    outerFill,
                    innerFill,
                    textFill,
                };
            })
            .filter(Boolean) as Array<{
                key: string;
                x: number;
                y: number;
                damage: number;
                outerFill: string;
                innerFill: string;
                textFill: string;
            }>;
    }, [combatEvents, unitCoords]);

    const colAxis = Array.from({ length: COLS }, (_, i) => i + 1);
    const rowAxis = Array.from({ length: ROWS }, (_, i) => String(i + 1).padStart(2, '0'));

    // ── Weather helpers ─────────────────────────────────────────────────────────
    const getWeatherTemp = (w?: WeatherType) => {
        switch (w) {
            case 'Clear': return '24°C';
            case 'Partly Cloudy': return '18°C';
            case 'Storm': return '8°C';
            case 'Fog': return '15°C';
            case 'Heavy Rain': return '12°C';
            case 'Sandstorm': return '34°C';
            default: return '18°C';
        }
    };

    const getWeatherVisibility = (w?: WeatherType) => {
        switch (w) {
            case 'Storm': return '2.1 KM';
            case 'Fog': return '0.4 KM';
            case 'Heavy Rain': return '3.5 KM';
            case 'Sandstorm': return '1.2 KM';
            default: return '8.5 KM';
        }
    };

    const getUnitAffiliation = (unit: ScenarioUnit): 'Friendly' | 'Enemy' | 'Objective' => {
        if (unit.type === 'FRIENDLY' || unit.allianceRole === 'FRIENDLY') return 'Friendly';
        if (unit.type === 'ENEMY' || unit.allianceRole === 'ENEMY') return 'Enemy';
        return 'Objective';
    };

    const getUnitTypeLabel = (unit: ScenarioUnit): string => {
        if (unit.assetClass && unit.assetClass.trim().length > 0) return unit.assetClass;
        if (unit.type === 'OBJECTIVE' || unit.allianceRole === 'OBJECTIVE') return 'Objective';
        if (unit.type === 'FRIENDLY' || unit.allianceRole === 'FRIENDLY') return 'Infantry';
        if (unit.type === 'ENEMY' || unit.allianceRole === 'ENEMY') return 'Infantry';
        return 'Objective';
    };

    const cleanUnitLabel = (label: string): string => {
        // Remove legacy status markers like " [100]" from older mapping formats.
        return label.replace(/\s*\[\d+\]\s*$/, '').trim();
    };

    const getUnitDescriptor = (unit: ScenarioUnit): string => {
        const affiliation = getUnitAffiliation(unit);
        const unitType = getUnitTypeLabel(unit);
        if (affiliation.toLowerCase() === unitType.toLowerCase()) {
            return affiliation;
        }
        return `${affiliation} - ${unitType}`;
    };

    const getHpLabel = (unit: ScenarioUnit): string => {
        const hpFromState = unitHpById?.[unit.id];
        if (hpFromState && typeof hpFromState.hp === 'number') {
            const maxHp = typeof hpFromState.maxHp === 'number' ? hpFromState.maxHp : 100;
            return `HP: ${hpFromState.hp}/${maxHp}`;
        }

        if (typeof unit.hp === 'number') {
            const maxHp = typeof unit.maxHp === 'number' ? unit.maxHp : 100;
            return `HP: ${unit.hp}/${maxHp}`;
        }
        return 'HP: N/A';
    };

    const getObjectiveProgressLabel = (unit: ScenarioUnit): string => {
        const progress = objectiveProgressById?.[unit.id];
        if (!progress) return 'Capture: F 0 / E 0 (Neutral)';

        const controllerLabel =
            progress.controller === 'FRIENDLY'
                ? 'Friendly'
                : progress.controller === 'ENEMY'
                    ? 'Enemy'
                    : 'Neutral';

        return `Capture: F ${progress.friendly} / E ${progress.enemy} (${controllerLabel})`;
    };

    const getStatusLine = (unit: ScenarioUnit): string => {
        if (unit.type === 'OBJECTIVE' || unit.allianceRole === 'OBJECTIVE') {
            return getObjectiveProgressLabel(unit);
        }
        return getHpLabel(unit);
    };

    const selectedUnit = useMemo(() => {
        if (!selectedUnitId) return null;
        return units.find((unit) => unit.id === selectedUnitId) ?? null;
    }, [units, selectedUnitId]);

    return (
        <div
            className="relative z-[80] w-full h-full overflow-hidden pointer-events-auto"
            style={{
                background: tc.bg,
                overscrollBehavior: 'contain',
            }}
        >
            <style>{`
                @keyframes wmDashFlow {
                    to { stroke-dashoffset: -18; }
                }
                @keyframes wmCombatPulse {
                    0% { transform: scale(0.45); opacity: 0.95; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                @keyframes wmDamageFloat {
                    0% { transform: translate(-50%, 0); opacity: 1; }
                    100% { transform: translate(-50%, -14px); opacity: 0; }
                }
                @keyframes wmBlipSelectedPulse {
                    0% { transform: scale(0.75); opacity: 0.9; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
            `}</style>



            {/* ── Scenario title & End Simulation ── */}
            {scenarioTitle && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-row items-center gap-2 flex-nowrap whitespace-nowrap">
                    <div className="px-3 py-1 rounded-sm pointer-events-none whitespace-nowrap shrink-0" style={{
                        background: 'rgba(0,0,0,0.80)',
                        border: '1px solid rgba(31,111,235,0.25)',
                        backdropFilter: 'blur(4px)',
                    }}>
                        <span className="text-[14px] font-mono font-bold uppercase tracking-widest text-[#E6EDF3]">
                            {scenarioTitle}
                        </span>
                    </div>

                    {onExecuteTurn && (
                        <button
                            onClick={onExecuteTurn}
                            className="px-3 py-[5px] rounded-sm flex items-center gap-2 transition-all group animate-pulse whitespace-nowrap shrink-0"
                            style={{
                                background: 'rgba(58,141,255,0.15)',
                                border: '1px solid rgba(58,141,255,0.45)',
                                backdropFilter: 'blur(6px)',
                            }}
                        >
                            <Zap className="w-2.5 h-2.5 text-[#3A8DFF] fill-[#3A8DFF]/10 transition-all group-hover:scale-110 group-hover:fill-[#3A8DFF]/30" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[#3A8DFF] group-hover:text-[#5CABFF] group-hover:drop-shadow-[0_0_5px_rgba(58,141,255,0.45)]">
                                EXECUTE TURN
                            </span>
                        </button>
                    )}

                    {onEndSimulation && (
                        <button
                            onClick={onEndSimulation}
                            className="px-3 py-[5px] rounded-sm flex items-center gap-2 transition-all group whitespace-nowrap shrink-0"
                            style={{
                                background: 'rgba(4,10,22,0.80)',
                                border: '1px solid rgba(31,111,235,0.28)',
                                backdropFilter: 'blur(6px)',
                            }}
                        >
                            <Square className="w-2.5 h-2.5 text-[#3A8DFF] fill-[#3A8DFF]/10 transition-all group-hover:scale-110 group-hover:fill-[#3A8DFF]/30" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[#3A8DFF] group-hover:text-[#5CABFF] group-hover:drop-shadow-[0_0_5px_rgba(58,141,255,0.45)]">
                                END SIMULATION
                            </span>
                        </button>
                    )}
                </div>
            )}

            {/* ── Unit count badge ── */}
            <div className="absolute top-3 right-3 z-20 pointer-events-none">
                <div className="px-2 py-1 rounded-sm"
                    style={{ background: 'rgba(0,0,0,0.72)', border: `1px solid ${tc.gridLine}` }}>
                    <span className="text-[11.5px] font-mono" style={{ color: tc.infoColor }}>
                        {units.filter(u => u.type === 'FRIENDLY').length}F&nbsp;&nbsp;
                        {units.filter(u => u.type === 'ENEMY').length}H&nbsp;&nbsp;
                        {units.filter(u => u.type === 'OBJECTIVE').length}OBJ
                    </span>
                </div>
            </div>

            {/* ── Selected blip details (persistent while selected) ── */}
            {selectedUnit && (
                <div
                    className="absolute bottom-14 left-3 z-30 pointer-events-none px-3 py-2 rounded-sm shadow-xl"
                    style={{
                        background: 'rgba(2, 6, 15, 0.90)',
                        border: '1px solid rgba(31, 111, 235, 0.50)',
                        backdropFilter: 'blur(6px)',
                        minWidth: '220px',
                    }}
                >
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4B6A8A] mb-1">
                        Selected Blip
                    </div>
                    <div className="text-[11px] font-mono font-bold text-white mb-1.5 whitespace-nowrap">
                        {cleanUnitLabel(selectedUnit.label)} ({getUnitAffiliation(selectedUnit)})
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-mono text-[#E6EDF3]">
                            {getStatusLine(selectedUnit)}
                        </span>
                        <span
                            className="text-[9px] font-mono font-bold tracking-widest uppercase"
                            style={{
                                color:
                                    selectedUnit.type === 'FRIENDLY' || selectedUnit.allianceRole === 'FRIENDLY'
                                        ? '#3B82F6'
                                        : selectedUnit.type === 'ENEMY' || selectedUnit.allianceRole === 'ENEMY'
                                            ? '#EF4444'
                                            : '#F59E0B'
                            }}
                        >
                            {getUnitDescriptor(selectedUnit)}
                        </span>
                        <span className="text-[9px] font-mono text-gray-400">
                            Grid Reference: [{selectedUnit.x}, {selectedUnit.y}]
                        </span>
                    </div>
                </div>
            )}

            {/* ── 2D / 3D Toggle ── */}
            <div className="absolute bottom-14 right-3 z-30 flex items-center gap-1 rounded-sm p-1"
                style={{
                    background: 'rgba(4,10,22,0.85)',
                    border: '1px solid rgba(31,111,235,0.28)',
                    backdropFilter: 'blur(6px)',
                }}
            >
                <button
                    onClick={() => toggle3DView('2D')}
                    className="px-2.5 py-1 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
                    style={{
                        color: viewMode === '2D' ? '#E6EDF3' : '#7C8CA1',
                        background: viewMode === '2D' ? 'rgba(31,111,235,0.28)' : 'transparent',
                    }}
                >
                    2D View
                </button>
                <button
                    onClick={() => toggle3DView('3D')}
                    className="px-2.5 py-1 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
                    style={{
                        color: viewMode === '3D' ? '#E6EDF3' : '#7C8CA1',
                        background: viewMode === '3D' ? 'rgba(31,111,235,0.28)' : 'transparent',
                    }}
                >
                    3D View
                </button>
            </div>

            {/* ── Zoom Controls ── */}
            {viewMode === '2D' && (<div
                className="absolute top-14 right-3 z-30 flex flex-col items-center gap-0 rounded-sm overflow-hidden"
                style={{
                    background: 'rgba(4,10,22,0.85)',
                    border: '1px solid rgba(31,111,235,0.28)',
                    backdropFilter: 'blur(6px)',
                }}
            >
                {/* Zoom In */}
                <button
                    onClick={handleZoomIn}
                    disabled={zoom >= ZOOM_STAGES[ZOOM_STAGES.length - 1]}
                    title="Zoom In"
                    className="flex items-center justify-center w-7 h-7 transition-all"
                    style={{
                        color: zoom >= ZOOM_STAGES[ZOOM_STAGES.length - 1] ? 'rgba(31,111,235,0.25)' : '#3A8DFF',
                        borderBottom: '1px solid rgba(31,111,235,0.18)',
                        cursor: zoom >= ZOOM_STAGES[ZOOM_STAGES.length - 1] ? 'default' : 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        if (zoom < ZOOM_STAGES[ZOOM_STAGES.length - 1]) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.15)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                >
                    <ZoomIn className="w-3 h-3" />
                </button>

                {/* Zoom % Display */}
                <div
                    className="flex items-center justify-center w-7 h-6"
                    style={{ borderBottom: '1px solid rgba(31,111,235,0.18)' }}
                >
                    <span className="text-[10px] font-mono font-bold select-none" style={{ color: '#C9D3E0' }}>
                        {getZoomPercentageLabel(zoom)}
                    </span>
                </div>

                {/* Zoom Out */}
                <button
                    onClick={handleZoomOut}
                    disabled={zoom <= ZOOM_STAGES[0]}
                    title="Zoom Out"
                    className="flex items-center justify-center w-7 h-7 transition-all"
                    style={{
                        color: zoom <= ZOOM_STAGES[0] ? 'rgba(31,111,235,0.25)' : '#3A8DFF',
                        borderBottom: '1px solid rgba(31,111,235,0.18)',
                        cursor: zoom <= ZOOM_STAGES[0] ? 'default' : 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        if (zoom > ZOOM_STAGES[0]) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.15)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                >
                    <ZoomOut className="w-3 h-3" />
                </button>

                {/* Recenter Map — smoothly moves map to center, preserves zoom level */}
                <button
                    onClick={handleRecenter}
                    title="Recenter Map"
                    className="flex items-center justify-center w-7 h-7 transition-all"
                    style={{
                        color: '#3A8DFF',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.15)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                >
                    <RotateCcw className="w-3 h-3" />
                </button>
            </div>)}

            {/* ── 3D Backup Controls (physical buttons) ── */}
            {viewMode === '3D' && (<div
                className="absolute top-14 right-3 z-30 flex flex-col items-center gap-0 rounded-sm overflow-hidden"
                style={{
                    background: 'rgba(4,10,22,0.85)',
                    border: '1px solid rgba(31,111,235,0.28)',
                    backdropFilter: 'blur(6px)',
                }}
            >
                <button
                    onClick={handle3DZoomIn}
                    title="3D Zoom In"
                    className="flex items-center justify-center w-7 h-7 transition-all"
                    style={{
                        color: '#3A8DFF',
                        borderBottom: '1px solid rgba(31,111,235,0.18)',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.15)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                >
                    <ZoomIn className="w-3 h-3" />
                </button>

                <button
                    onClick={handle3DZoomOut}
                    title="3D Zoom Out"
                    className="flex items-center justify-center w-7 h-7 transition-all"
                    style={{
                        color: '#3A8DFF',
                        borderBottom: '1px solid rgba(31,111,235,0.18)',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.15)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                >
                    <ZoomOut className="w-3 h-3" />
                </button>

                <button
                    onClick={handle3DRotateLeft}
                    title="3D Rotate Left"
                    className="flex items-center justify-center w-7 h-7 transition-all text-[10px] font-mono font-bold"
                    style={{
                        color: '#3A8DFF',
                        borderBottom: '1px solid rgba(31,111,235,0.18)',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.15)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                >
                    L
                </button>

                <button
                    onClick={handle3DRotateRight}
                    title="3D Rotate Right"
                    className="flex items-center justify-center w-7 h-7 transition-all text-[10px] font-mono font-bold"
                    style={{
                        color: '#3A8DFF',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,111,235,0.15)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                >
                    R
                </button>
            </div>)}

            {viewMode === '3D' && (
                <div className="absolute inset-0 transition-opacity duration-200 pointer-events-auto opacity-100">
                    {terrainMapData ? (
                        <TacticalMap3D
                            key={`${terrainVersionKey ?? (scenarioTitle ?? 'default_terrain')}`}
                            mapData={terrainMapData}
                            terrainVersionKey={terrainVersionKey ?? (scenarioTitle ?? 'default_terrain')}
                            isActive={viewMode === '3D'}
                            terrainType={terrainType}
                            scenarioTitle={scenarioTitle}
                            mapPeaks={mapPeaks}
                            initialCameraPosition={savedCameraState.position}
                            initialCameraTarget={savedCameraState.target}
                            onCameraChange={(pos, target) => {
                                setSavedCameraState({ position: pos, target: target });
                            }}
                            onControlsReady={(controls) => {
                                tactical3DControlsRef.current = controls;
                            }}
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono uppercase tracking-wider text-[#7C8CA1]">
                            3D Terrain Unavailable
                        </div>
                    )}
                </div>
            )}

            {viewMode === '3D' && (
                <div className="absolute bottom-3 left-3 z-20 pointer-events-none px-3 py-2 rounded-sm"
                    style={{
                        background: 'rgba(4,10,22,0.74)',
                        border: '1px solid rgba(31,111,235,0.28)',
                    }}
                >
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#B8C2D6]">
                        Orbit: Rotate | Zoom | Pan
                    </span>
                </div>
            )}

            {viewMode === '2D' && (<>
                {/* ── SVG map ── */}
                <svg
                    ref={svgRef}
                    className={`absolute inset-0 w-full h-full outline-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
                    viewBox={`0 0 ${VW} ${VH}`}
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <defs>
                        <filter id="f-faint" x="-25%" y="-25%" width="150%" height="150%">
                            <feGaussianBlur stdDeviation="1.8" result="b" />
                            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                        <filter id="f-bright" x="-60%" y="-60%" width="220%" height="220%">
                            <feGaussianBlur stdDeviation="5" result="b" />
                            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                        <filter id="f-unit" x="-80%" y="-80%" width="260%" height="260%">
                            <feGaussianBlur stdDeviation="3" result="b" />
                            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                        <radialGradient id="cg" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor={tc.infoColor} stopOpacity="0.07" />
                            <stop offset="100%" stopColor={tc.infoColor} stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    <g
                        transform={`translate(${VW / 2 + panX}, ${VH / 2 + panY}) scale(${zoom}) translate(${-gridCenterX}, ${-gridCenterY})`}
                        style={{ transition: isTransitioning ? 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)' : 'none' }}
                    >

                        {/* Centre radial glow */}
                        <rect x={PL} y={PT} width={mapW} height={mapH} fill="url(#cg)" />

                        {/* ── Terrain cell fills ── */}
                        {cellFills.map((c, i) => (
                            <rect key={i} x={c.x} y={c.y} width={cW + 0.6} height={cH + 0.6} fill={c.fill} />
                        ))}

                        {/* ── Contour lines ── */}
                        {contourPaths.map((d, i) =>
                            d ? (
                                <path
                                    key={i}
                                    d={d}
                                    fill="none"
                                    stroke={contourColors[i]}
                                    strokeWidth={contourWidths[i]}
                                    strokeLinecap="round"
                                    filter={contourGlow[i] ? 'url(#f-bright)' : 'url(#f-faint)'}
                                />
                            ) : null
                        )}

                        {/* ── Elevation spot labels ── */}
                        {spotLabels.map((s, i) => (
                            <text
                                key={i} x={s.x} y={s.y}
                                fontSize="9.5" fontFamily="monospace" textAnchor="middle"
                                fill={s.bright ? tc.contourPeak : tc.contour1}
                                opacity="0.70"
                            >
                                {s.m}m
                            </text>
                        ))}

                        {/* ── Grid lines ── */}
                        {colAxis.map((_, i) => (
                            <line key={`v${i}`}
                                x1={PL + i * cW} y1={PT}
                                x2={PL + i * cW} y2={PT + mapH}
                                stroke={tc.gridLine} strokeWidth="0.4" />
                        ))}
                        {rowAxis.map((_, i) => (
                            <line key={`h${i}`}
                                x1={PL} y1={PT + i * cH}
                                x2={PL + mapW} y2={PT + i * cH}
                                stroke={tc.gridLine} strokeWidth="0.4" />
                        ))}

                        {/* Map border */}
                        <rect x={PL} y={PT} width={mapW} height={mapH}
                            fill="none" stroke={tc.gridLine} strokeWidth="1" />

                        {/* ── Axis labels ── */}
                        {colAxis.map((n, i) => (
                            i % 2 === 0 ? (
                                <text key={`cl${i}`}
                                    x={PL + (i + 0.5) * cW} y={PT - 9}
                                    fontSize="9.5" fontFamily="monospace" textAnchor="middle"
                                    fill={tc.axisText}>
                                    {n}
                                </text>
                            ) : null
                        ))}
                        {rowAxis.map((ch, i) => (
                            i % 2 === 0 ? (
                                <text key={`rl${i}`}
                                    x={PL - 12} y={PT + (i + 0.5) * cH + 2}
                                    fontSize="9.5" fontFamily="monospace" textAnchor="middle"
                                    fill={tc.axisText}>
                                    {ch}
                                </text>
                            ) : null
                        ))}

                        {/* ── Corner brackets ── */}
                        {[
                            [PL + 14, PT, PL, PT, PL, PT + 14],
                            [PL + mapW - 14, PT, PL + mapW, PT, PL + mapW, PT + 14],
                            [PL + 14, PT + mapH, PL, PT + mapH, PL, PT + mapH - 14],
                            [PL + mapW - 14, PT + mapH, PL + mapW, PT + mapH, PL + mapW, PT + mapH - 14],
                        ].map((pts, i) => (
                            <path key={`br${i}`}
                                d={`M${pts[0]},${pts[1]}L${pts[2]},${pts[3]}L${pts[4]},${pts[5]}`}
                                fill="none" stroke="rgba(31,111,235,0.65)" strokeWidth="1.5" />
                        ))}

                        {/* ── Units ── */}
                        {unitCoords.map(unit => {
                            const isF = unit.type === 'FRIENDLY' || unit.allianceRole === 'FRIENDLY';
                            const isE = unit.type === 'ENEMY' || unit.allianceRole === 'ENEMY';
                            const isSelected = selectedUnitId === unit.id;
                            const col = isF ? '#3B82F6' : isE ? '#EF4444' : '#F59E0B'; // Blue for friendly, Red for threat
                            const glowCol = isF
                                ? 'rgba(59,130,246,0.55)'
                                : isE ? 'rgba(239,68,68,0.55)' : 'rgba(245,158,11,0.55)';
                            const selectedGlowCol = isF
                                ? 'rgba(96,165,250,0.95)'
                                : isE ? 'rgba(252,165,165,0.95)' : 'rgba(252,211,77,0.95)';
                            const shortLabel = unit.label.length > 20
                                ? unit.label.slice(0, 18) + '…'
                                : unit.label;
                            const lblW = shortLabel.length * 4.4 + 8;

                            const isMoving = ['Infantry', 'Mechanized', 'Armor', 'Recon'].includes(unit.assetClass || '');
                            const isBase = ['Infrastructure', 'Command Unit', 'Logistics'].includes(unit.assetClass || '');
                            const isObj = unit.assetClass === 'Objective' || unit.type === 'OBJECTIVE';
                            const isUnknownCombat = !isObj && !isBase && !isMoving;

                            return (
                                <g
                                    key={unit.id}
                                    filter={isSelected ? 'url(#f-bright)' : 'url(#f-unit)'}
                                    onPointerEnter={() => setHoveredUnit(unit as any)}
                                    onPointerLeave={() => setHoveredUnit(null)}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => setSelectedUnitId((prev) => (prev === unit.id ? null : unit.id))}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* Invisible Hit-box (Larger Interaction Area) */}
                                    <circle cx={unit.px} cy={unit.py} r="16" fill="transparent" />

                                    {/* Movement Arrow */}
                                    {unit.hasTarget && (
                                        <g opacity="0.6">
                                            <line x1={unit.px} y1={unit.py} x2={unit.tpx} y2={unit.tpy}
                                                stroke={col} strokeWidth="1" strokeDasharray="2 3" />
                                            <circle cx={unit.tpx} cy={unit.tpy} r="1.2" fill={col} />
                                        </g>
                                    )}

                                    {/* Pulse ring */}
                                    <circle cx={unit.px} cy={unit.py} r="9"
                                        fill="none" stroke={glowCol} strokeWidth="0.5" opacity="0.6" />
                                    <circle cx={unit.px} cy={unit.py} r="4.5"
                                        fill="none" stroke={glowCol} strokeWidth="0.3" opacity="0.4" />

                                    {isSelected && (
                                        <>
                                            <circle
                                                cx={unit.px}
                                                cy={unit.py}
                                                r="11"
                                                fill="none"
                                                stroke={selectedGlowCol}
                                                strokeWidth="1.2"
                                                opacity="0.9"
                                            />
                                            <circle
                                                cx={unit.px}
                                                cy={unit.py}
                                                r="11"
                                                fill="none"
                                                stroke={selectedGlowCol}
                                                strokeWidth="1.1"
                                                style={{
                                                    animation: 'wmBlipSelectedPulse 1.15s ease-out infinite',
                                                    transformOrigin: 'center',
                                                    transformBox: 'fill-box',
                                                }}
                                            />
                                        </>
                                    )}

                                    {/* Marker Geometry */}
                                    {isMoving && (
                                        <polygon points={`${unit.px},${unit.py - 4.5} ${unit.px - 4.5},${unit.py + 3} ${unit.px + 4.5},${unit.py + 3}`}
                                            fill={col} opacity="0.95" />
                                    )}

                                    {isBase && (
                                        <polygon points={`${unit.px},${unit.py - 5} ${unit.px - 4},${unit.py - 1} ${unit.px - 4},${unit.py + 3.5} ${unit.px + 4},${unit.py + 3.5} ${unit.px + 4},${unit.py - 1}`}
                                            fill={col} opacity="0.95" />
                                    )}

                                    {isObj && (
                                        <>
                                            <circle cx={unit.px} cy={unit.py} r="4"
                                                fill="none" stroke={col} strokeWidth="1.2" opacity="0.95" />
                                            <circle cx={unit.px} cy={unit.py} r="1.5" fill={col} opacity="0.95" />
                                        </>
                                    )}

                                    {isUnknownCombat && (
                                        <rect
                                            x={unit.px - 3.5}
                                            y={unit.py - 3.5}
                                            width="7"
                                            height="7"
                                            fill={col}
                                            opacity="0.95"
                                            transform={`rotate(45 ${unit.px} ${unit.py})`}
                                        />
                                    )}

                                </g>
                            );
                        })}

                        {/* ── Movement vectors from latest simulation tick ── */}
                        {movementVectors.map((mv, i) => (
                            <g key={`${mv.unit_id}-${i}`} opacity="0.85" pointerEvents="none">
                                <line
                                    x1={mv.x1}
                                    y1={mv.y1}
                                    x2={mv.x2}
                                    y2={mv.y2}
                                    stroke={mv.unit_id.startsWith('e') ? '#EF4444' : '#3B82F6'}
                                    strokeWidth="1.3"
                                    strokeDasharray="5 4"
                                    style={{ animation: 'wmDashFlow 1.1s linear infinite' }}
                                />
                                <circle cx={mv.x2} cy={mv.y2} r="1.9" fill={mv.unit_id.startsWith('e') ? '#EF4444' : '#3B82F6'} />
                            </g>
                        ))}

                        {/* ── Combat flash overlays (map-space so pan/zoom stays synced) ── */}
                        {combatFlashPoints.map((pt, i) => (
                            <g key={`${pt.key}-${i}`} pointerEvents="none" transform={`translate(${pt.x} ${pt.y})`}>
                                <circle
                                    cx="0"
                                    cy="0"
                                    r="10"
                                    fill={pt.outerFill}
                                    style={{
                                        animation: 'wmCombatPulse 850ms ease-out forwards',
                                        transformOrigin: 'center',
                                        transformBox: 'fill-box',
                                    }}
                                />
                                <circle
                                    cx="0"
                                    cy="0"
                                    r="4.5"
                                    fill={pt.innerFill}
                                    style={{
                                        animation: 'wmCombatPulse 850ms ease-out forwards',
                                        transformOrigin: 'center',
                                        transformBox: 'fill-box',
                                    }}
                                />
                                <text
                                    x="0"
                                    y="-12"
                                    textAnchor="middle"
                                    className="font-mono"
                                    fontSize="9"
                                    fontWeight="700"
                                    fill={pt.textFill}
                                    style={{ animation: 'wmDamageFloat 900ms ease-out forwards' }}
                                >
                                    -{pt.damage}
                                </text>
                            </g>
                        ))}
                    </g>
                </svg>

                {/* ── Bottom bar ── */}
                <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-3">
                        <span className="text-[7px] font-mono uppercase tracking-wider opacity-60" style={{ color: tc.infoColor }}>
                            SCALE 1:50,000
                        </span>
                        <span className="text-[7px] font-mono uppercase opacity-50" style={{ color: tc.infoColor }}>
                            ELEV_MAP v3.2
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        {[
                            { col: '#3B82F6', shape: 'sq', label: 'Friendly' },
                            { col: '#EF4444', shape: 'sq', label: 'Threat' },
                            { col: '#F59E0B', shape: 'circ', label: 'Objective' },
                            { col: '#A1A1AA', shape: 'tri', label: 'Troops' },
                            { col: '#A1A1AA', shape: 'hut', label: 'Outpost' },
                            { col: tc.infoColor, shape: 'line', label: 'Contour' },
                        ].map((L, i) => (
                            <div key={i} className="flex items-center gap-1.5 opacity-80">
                                {L.shape === 'sq' && <div className="w-2 h-2 rounded-sm" style={{ background: L.col }} />}
                                {L.shape === 'tri' && <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px]" style={{ borderBottomColor: L.col }} />}
                                {L.shape === 'hut' && <svg width="8" height="8" viewBox="0 0 7 7"><polygon points="3.5,0.5 0.5,3.5 0.5,6.5 6.5,6.5 6.5,3.5" fill={L.col} /></svg>}
                                {L.shape === 'circ' && <div className="w-2 h-2 rounded-full border-2 border-current" style={{ color: L.col }} />}
                                {L.shape === 'line' && <div className="w-3 h-px" style={{ background: L.col }} />}
                                <span className="text-[6px] font-mono uppercase text-[#E6EDF3]">{L.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Hover Tooltip ── */}
                {hoveredUnit && (
                    <div
                        className="fixed z-50 pointer-events-none px-3 py-2 rounded-sm shadow-xl backdrop-blur-sm"
                        style={{
                            left: mouseClient.x + 15,
                            top: mouseClient.y + 15,
                            background: 'rgba(2, 6, 15, 0.90)',
                            border: '1px solid rgba(31, 111, 235, 0.5)'
                        }}
                    >
                        <div className="text-[11px] font-mono font-bold text-white mb-1.5 whitespace-nowrap">
                            {cleanUnitLabel(hoveredUnit.label)} ({getUnitAffiliation(hoveredUnit)})
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-mono text-[#E6EDF3]">
                                {getStatusLine(hoveredUnit)}
                            </span>
                            <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: hoveredUnit.type === 'FRIENDLY' || hoveredUnit.allianceRole === 'FRIENDLY' ? '#3B82F6' : hoveredUnit.type === 'ENEMY' || hoveredUnit.allianceRole === 'ENEMY' ? '#EF4444' : '#F59E0B' }}>
                                {getUnitDescriptor(hoveredUnit)}
                            </span>
                            <span className="text-[9px] font-mono text-gray-400">
                                Grid Reference: [{hoveredUnit.x}, {hoveredUnit.y}]
                            </span>
                        </div>
                    </div>
                )}
            </>)}
        </div>
    );
}
