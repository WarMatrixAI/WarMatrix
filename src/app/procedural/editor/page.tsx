'use client';

import React, { useState, useMemo, Suspense, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import {
  ASSET_REGISTRY,
  DISTRICT_COLORS,
  DEFAULT_ASSET_SCALES,
  getGLBPath
} from '@/lib/procedural/assetRegistry';
import { Button } from '@/components/ui/button';
import {
  Sliders,
  Download,
  Upload,
  Plus,
  Trash2,
  Cpu,
  ArrowLeft,
  Copy,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Check,
  Hand
} from 'lucide-react';
import { Courier_Prime } from 'next/font/google';

const courierNew = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
});

const GRID_COLS = 80;
const GRID_ROWS = 80;
const WORLD_SCALE = 4;

// Convert cell grid to world position (X, Y)
function editorGridToWorld(x: number, y: number): [number, number] {
  const wx = (x - GRID_COLS / 2 + 0.5) * WORLD_SCALE;
  const wy = (GRID_ROWS / 2 - y - 0.5) * WORLD_SCALE;
  return [wx, wy];
}

// Convert grid cell to Lat/Long using simulation anchor
function cellToLatLong(x: number, y: number): string {
  const lat = 45.0230 + (GRID_ROWS / 2 - y - 0.5) * 0.0015;
  const lng = 122.4510 + (x - GRID_COLS / 2 + 0.5) * 0.0022;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

interface PlacedAsset {
  id: string;
  assetPath: string;
  name: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotation: number;
  posXOffset: number;
  posYOffset: number;
  posZOffset: number;
  category: string;
  subIndex: number; // child index to render, -1 means show all
  fpLeft: number;   // extend footprint left (negative = shrink)
  fpRight: number;  // extend footprint right
  fpTop: number;    // extend footprint up
  fpBottom: number; // extend footprint down
}

// ─── Holographic Editor GLB Component ────────────────────────────────────────

function EditorGLBModel({
  path,
  scaleX,
  scaleY,
  scaleZ,
  rotation,
  posXOffset,
  posYOffset,
  posZOffset,
  color,
  isSelected,
  subIndex
}: {
  path: string;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotation: number;
  posXOffset: number;
  posYOffset: number;
  posZOffset: number;
  color: string;
  isSelected: boolean;
  subIndex: number;
}) {
  const { scene } = useGLTF(path);

  // Clone filled model with translucent material & emissive neon color
  const clonedFilled = useMemo(() => {
    const s = new THREE.Group();
    const childrenToCopy = (subIndex !== undefined && subIndex >= 0 && subIndex < scene.children.length)
      ? [scene.children[subIndex]]
      : scene.children;

    childrenToCopy.forEach((child) => {
      s.add(child.clone());
    });

    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#010a15'),
          emissive: new THREE.Color(color),
          emissiveIntensity: isSelected ? 0.95 : 0.55,
          transparent: true,
          opacity: 0.75,
          flatShading: true,
          metalness: 0.2,
          roughness: 0.8
        });
      }
    });
    return s;
  }, [scene, color, isSelected, subIndex]);

  // Clone wireframe overlay mesh with additive blending
  const clonedWireframe = useMemo(() => {
    const s = new THREE.Group();
    const childrenToCopy = (subIndex !== undefined && subIndex >= 0 && subIndex < scene.children.length)
      ? [scene.children[subIndex]]
      : scene.children;

    childrenToCopy.forEach((child) => {
      s.add(child.clone());
    });

    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshBasicMaterial({
          color: new THREE.Color(isSelected ? '#00ffff' : color),
          wireframe: true,
          transparent: true,
          opacity: isSelected ? 0.65 : 0.25,
          blending: THREE.AdditiveBlending
        });
      }
    });
    return s;
  }, [scene, color, isSelected, subIndex]);

  const scale: [number, number, number] = [scaleX, scaleY, scaleZ];
  const finalPosition: [number, number, number] = [posXOffset, posYOffset, posZOffset];
  const finalRotation: [number, number, number] = [0, 0, (rotation * Math.PI) / 180];

  return (
    <group position={finalPosition} rotation={finalRotation} scale={scale}>
      <primitive object={clonedFilled} rotation={[Math.PI / 2, 0, 0]} />
      <primitive object={clonedWireframe} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

function EditorAssetOccupiedHighlight({
  asset,
  isSelected,
  wx,
  wy
}: {
  asset: PlacedAsset;
  isSelected: boolean;
  wx: number;
  wy: number;
}) {
  const { scene } = useGLTF(asset.assetPath);

  const occupiedCells = useMemo(() => {
    if (!scene) return [];
    const subIndex = asset.subIndex;
    const childrenToMeasure = (subIndex !== undefined && subIndex >= 0 && subIndex < scene.children.length)
      ? [scene.children[subIndex]]
      : scene.children;

    if (childrenToMeasure.length === 0) return [];

    const tempGroup = new THREE.Group();
    childrenToMeasure.forEach((child) => {
      tempGroup.add(child.clone());
    });

    const box = new THREE.Box3().setFromObject(tempGroup);
    const min = box.min;
    const max = box.max;
    const localCorners = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, max.z),
    ];

    const rad = (asset.rotation * Math.PI) / 180;
    const cos_yaw = Math.cos(rad);
    const sin_yaw = Math.sin(rad);

    const worldCorners = localCorners.map((corner) => {
      const x1 = corner.x;
      const y1 = -corner.z;
      const z1 = corner.y;
      const x2 = x1 * asset.scaleX;
      const y2 = y1 * asset.scaleY;
      const x3 = x2 * cos_yaw - y2 * sin_yaw;
      const y3 = x2 * sin_yaw + y2 * cos_yaw;
      return {
        x: x3 + asset.posXOffset + wx,
        y: y3 + asset.posYOffset + wy
      };
    });

    const xs = worldCorners.map(c => c.x);
    const ys = worldCorners.map(c => c.y);

    let minGCol = Math.floor(Math.min(...xs) / WORLD_SCALE + GRID_COLS / 2);
    let maxGCol = Math.floor(Math.max(...xs) / WORLD_SCALE + GRID_COLS / 2);
    let minGRow = Math.floor(GRID_ROWS / 2 - Math.max(...ys) / WORLD_SCALE);
    let maxGRow = Math.floor(GRID_ROWS / 2 - Math.min(...ys) / WORLD_SCALE);

    // Apply directional overrides
    minGCol -= (asset.fpLeft || 0);
    maxGCol += (asset.fpRight || 0);
    minGRow -= (asset.fpTop || 0);
    maxGRow += (asset.fpBottom || 0);

    const cells: { x: number; y: number }[] = [];
    for (let c = Math.max(0, minGCol); c <= Math.min(GRID_COLS - 1, maxGCol); c++) {
      for (let r = Math.max(0, minGRow); r <= Math.min(GRID_ROWS - 1, maxGRow); r++) {
        if (c === asset.x && r === asset.y) continue;
        cells.push({ x: c, y: r });
      }
    }
    return cells;
  }, [scene, asset.x, asset.y, asset.scaleX, asset.scaleY, asset.scaleZ, asset.rotation, asset.posXOffset, asset.posYOffset, asset.posZOffset, asset.subIndex, asset.fpLeft, asset.fpRight, asset.fpTop, asset.fpBottom, wx, wy]);

  return (
    <>
      {occupiedCells.map((cell, idx) => {
        const cell_wx = (cell.x - GRID_COLS / 2 + 0.5) * WORLD_SCALE;
        const cell_wy = (GRID_ROWS / 2 - cell.y - 0.5) * WORLD_SCALE;
        const rel_x = cell_wx - wx;
        const rel_y = cell_wy - wy;
        return (
          <mesh key={idx} position={[rel_x, rel_y, 0.015]}>
            <planeGeometry args={[3.85, 3.85]} />
            <meshBasicMaterial 
              color={isSelected ? "#EF4444" : "#F59E0B"} 
              transparent 
              opacity={isSelected ? 0.35 : 0.15} 
              side={THREE.DoubleSide} 
            />
          </mesh>
        );
      })}
    </>
  );
}

function EditorAssetInstance({
  asset,
  isSelected,
  onClick
}: {
  asset: PlacedAsset;
  isSelected: boolean;
  onClick: (e: any) => void;
}) {
  const STRUCTURE_COLORS: Record<string, string> = {
    residential:  '#10B981',  // Emerald green
    commercial:   '#EC4899',  // Magenta pink
    industrial:   '#EF4444',  // Red
    office:       '#8B5CF6',  // Violet purple
    landmark:     '#FACC15',  // Golden yellow
    comms_radar:  '#3B82F6',  // Strategic blue
    bridge:       '#14B8A6',  // Teal
  };
  const color = STRUCTURE_COLORS[asset.category.toLowerCase()] || '#00e5ff';
  const [wx, wy] = editorGridToWorld(asset.x, asset.y);

  return (
    <group
      position={[wx, wy, 0]}
      onClick={onClick}
    >
      {/* Visual glowing ring around selected asset */}
      {isSelected && (
        <mesh position={[0, 0, 0.05]}>
          <ringGeometry args={[1.6, 1.8, 32]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* District base visual indicator */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[3.2, 3.2]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.4 : 0.18} />
      </mesh>

      <Suspense fallback={null}>
        <EditorAssetOccupiedHighlight
          asset={asset}
          isSelected={isSelected}
          wx={wx}
          wy={wy}
        />
      </Suspense>

      <Suspense
        fallback={
          <mesh position={[0, 0, 0.5]}>
            <boxGeometry args={[1.5, 1.5, 1.0]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
          </mesh>
        }
      >
        <EditorGLBModel
          path={asset.assetPath}
          scaleX={asset.scaleX}
          scaleY={asset.scaleY}
          scaleZ={asset.scaleZ}
          rotation={asset.rotation}
          posXOffset={asset.posXOffset}
          posYOffset={asset.posYOffset}
          posZOffset={asset.posZOffset}
          color={color}
          isSelected={isSelected}
          subIndex={asset.subIndex}
        />
      </Suspense>
    </group>
  );
}

function SubAssetSelector({
  path,
  subIndex,
  onChange
}: {
  path: string;
  subIndex: number;
  onChange: (index: number) => void;
}) {
  const { scene } = useGLTF(path);
  const children = scene.children;

  if (children.length <= 1) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t border-[#1F6FEB]/10 pt-3">
      <label className="text-[10px] text-[#9CA3AF] uppercase font-bold block">
        Sub-Asset Focus ({children.length} meshes found)
      </label>
      <select
        value={subIndex}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full bg-[#02050A] border border-[#1F6FEB]/30 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00e5ff] font-mono cursor-pointer"
      >
        <option value="-1">Show Entire Scene (All)</option>
        {children.map((child, idx) => (
          <option key={idx} value={idx}>
            Mesh {idx + 1}: {child.name || `Unnamed`}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── MAIN EDITOR CONTAINER ───────────────────────────────────────────────────

export default function AssetScaleEditorPage() {
  const router = useRouter();
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Mode: place (brush placement) vs select (select & tweak sliders) vs pan (camera drag pan)
  const [editorMode, setEditorMode] = useState<'place' | 'select' | 'pan'>('place');

  // Placed Assets State
  const [placedAssets, setPlacedAssets] = useState<PlacedAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Active Brush selection state
  const [activeBrush, setActiveBrush] = useState<{ path: string; name: string; category: string } | null>(null);

  // Accordion categories toggle state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    residential: true,
    commercial: false,
    industrial: false,
    office: false,
    landmark: false,
    comms_radar: false,
    bridge: false
  });

  // Slider Uniform Scaling Lock
  const [uniformScale, setUniformScale] = useState(true);

  // Hovered Cell State
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // Track if right mouse button is held down
  const [rightClickActive, setRightClickActive] = useState(false);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  // Default Asset Selection on Mount
  useEffect(() => {
    // Select first asset in residential by default
    const firstRes = ASSET_REGISTRY.residential[0];
    if (firstRes) {
      setActiveBrush({
        path: firstRes.path,
        name: firstRes.name,
        category: 'residential'
      });
    }
  }, []);

  // Monitor pointerdown to avoid clicking when dragging/panning
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  // Handle keyboard Arrow keys to adjust selected asset scale with high precision
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedAssetId) return;
      
      // Ignore keydowns if user is typing in inputs or textareas
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return;
      }
      
      const step = e.shiftKey ? 0.0002 : 0.001;
      
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        setPlacedAssets((prev) =>
          prev.map((asset) => {
            if (asset.id !== selectedAssetId) return asset;
            const newScale = Math.min(10.0, asset.scaleX + step);
            const updated = { ...asset, scaleX: newScale };
            if (uniformScale) {
              updated.scaleY = newScale;
              updated.scaleZ = newScale;
            }
            return updated;
          })
        );
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setPlacedAssets((prev) =>
          prev.map((asset) => {
            if (asset.id !== selectedAssetId) return asset;
            const newScale = Math.max(0.001, asset.scaleX - step);
            const updated = { ...asset, scaleX: newScale };
            if (uniformScale) {
              updated.scaleY = newScale;
              updated.scaleZ = newScale;
            }
            return updated;
          })
        );
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAssetId, uniformScale]);

  // Right-click wheel target: adjust scale or one of the offsets
  const [rightClickTarget, setRightClickTarget] = useState<'scale' | 'offsetX' | 'offsetY' | 'offsetZ'>('scale');

  // Mouse wheel scroll handler on scale inputs for fine-tuning
  const handleScaleWheel = (e: React.WheelEvent, field: 'scaleX' | 'scaleY' | 'scaleZ') => {
    const currentVal = selectedAsset ? selectedAsset[field] : null;
    if (currentVal === null) return;
    const step = e.shiftKey ? 0.0002 : 0.001;
    const direction = e.deltaY < 0 ? 1 : -1;
    const nextVal = Math.max(0.001, Math.min(10.0, currentVal + direction * step));
    updateSelectedAsset({ [field]: parseFloat(nextVal.toFixed(4)) });
  };

  // Mouse wheel scroll handler on offset inputs for fine-tuning
  const handleOffsetWheel = (e: React.WheelEvent, field: 'posXOffset' | 'posYOffset' | 'posZOffset') => {
    const currentVal = selectedAsset ? selectedAsset[field] : null;
    if (currentVal === null) return;
    const step = e.shiftKey ? 0.02 : 0.25;
    const direction = e.deltaY < 0 ? 1 : -1;
    const nextVal = Math.max(-100.0, Math.min(100.0, currentVal + direction * step));
    updateSelectedAsset({ [field]: parseFloat(nextVal.toFixed(3)) });
  };

  // Category mapping helper
  const getAssetCategoryKey = (cat: string): string => {
    if (cat === 'communication_tower' || cat === 'radar_station' || cat === 'comms_radar') {
      return 'comms_radar';
    }
    return cat;
  };

  // Get active selected placed asset
  const selectedAsset = useMemo(() => {
    return placedAssets.find((a) => a.id === selectedAssetId) || null;
  }, [placedAssets, selectedAssetId]);

  // Handle grid cell clicking (placing or selecting)
  const handleCellClick = (cx: number, cy: number) => {
    const existing = placedAssets.find((a) => a.x === cx && a.y === cy);

    if (existing) {
      // Cell already occupied: select it instead of placing another building!
      setSelectedAssetId(existing.id);
      setEditorMode('select');
      return;
    }

    if (editorMode === 'select') {
      setSelectedAssetId(null);
    } else {
      // Place Mode
      if (!activeBrush) return;

      const path = activeBrush.path;
      // Initialize with default scale from registry if available, else 0.05
      const defaultScale = DEFAULT_ASSET_SCALES[path] || { scaleX: 0.06, scaleY: 0.06, scaleZ: 0.06 };

      const newPlaced: PlacedAsset = {
        id: `placed_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        assetPath: path,
        name: activeBrush.name,
        x: cx,
        y: cy,
        scaleX: defaultScale.scaleX,
        scaleY: defaultScale.scaleY,
        scaleZ: defaultScale.scaleZ,
        rotation: defaultScale.rotationOffset || 0,
        posXOffset: defaultScale.positionOffset?.[0] || 0,
        posYOffset: defaultScale.positionOffset?.[1] || 0,
        posZOffset: defaultScale.positionOffset?.[2] || 0,
        category: activeBrush.category,
        subIndex: defaultScale.subIndex !== undefined ? defaultScale.subIndex : -1,
        fpLeft: 0,
        fpRight: 0,
        fpTop: 0,
        fpBottom: 0
      };

      setPlacedAssets((prev) => {
        // Double check inside state updater to prevent race conditions from rapid clicking!
        const isOccupied = prev.some((a) => a.x === cx && a.y === cy);
        if (isOccupied) return prev;
        
        // Use timeout to update selectedAssetId after rendering to ensure consistency
        setTimeout(() => setSelectedAssetId(newPlaced.id), 0);
        return [...prev, newPlaced];
      });
    }
  };

  // Update selected asset properties
  const updateSelectedAsset = (fields: Partial<PlacedAsset>) => {
    if (!selectedAssetId) return;
    setPlacedAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedAssetId) return asset;

        const updated = { ...asset, ...fields };

        // Handle Uniform Scaling
        if (uniformScale) {
          if ('scaleX' in fields) {
            updated.scaleY = fields.scaleX!;
            updated.scaleZ = fields.scaleX!;
          } else if ('scaleY' in fields) {
            updated.scaleX = fields.scaleY!;
            updated.scaleZ = fields.scaleY!;
          } else if ('scaleZ' in fields) {
            updated.scaleX = fields.scaleZ!;
            updated.scaleY = fields.scaleZ!;
          }
        }

        return updated;
      })
    );
  };

  // Toggle categories expansion
  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Delete placed asset
  const deleteAsset = (id: string) => {
    setPlacedAssets((prev) => prev.filter((a) => a.id !== id));
    if (selectedAssetId === id) {
      setSelectedAssetId(null);
    }
  };

  // Duplicate selected asset
  const duplicateSelectedAsset = () => {
    if (!selectedAsset) return;

    // Find next free cell
    let foundCell: [number, number] | null = null;
    for (let dy = 0; dy < GRID_ROWS; dy++) {
      for (let dx = 0; dx < GRID_COLS; dx++) {
        const isOccupied = placedAssets.some((a) => a.x === dx && a.y === dy);
        if (!isOccupied) {
          foundCell = [dx, dy];
          break;
        }
      }
      if (foundCell) break;
    }

    if (!foundCell) {
      alert("Grid is full! Cannot duplicate.");
      return;
    }

    const [nx, ny] = foundCell;
    const duplicated: PlacedAsset = {
      ...selectedAsset,
      id: `placed_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x: nx,
      y: ny
    };

    setPlacedAssets((prev) => [...prev, duplicated]);
    setSelectedAssetId(duplicated.id);
  };

  // Download Config file
  const downloadConfig = () => {
    const scalesDict: Record<string, any> = {};

    placedAssets.forEach((asset) => {
      scalesDict[asset.assetPath] = {
        scaleX: parseFloat(asset.scaleX.toFixed(4)),
        scaleY: parseFloat(asset.scaleY.toFixed(4)),
        scaleZ: parseFloat(asset.scaleZ.toFixed(4)),
        rotationOffset: Math.round(asset.rotation),
        positionOffset: [
          parseFloat(asset.posXOffset.toFixed(3)),
          parseFloat(asset.posYOffset.toFixed(3)),
          parseFloat(asset.posZOffset.toFixed(3))
        ],
        subIndex: asset.subIndex,
        fpLeft: asset.fpLeft,
        fpRight: asset.fpRight,
        fpTop: asset.fpTop,
        fpBottom: asset.fpBottom
      };
    });

    const fullData = {
      DEFAULT_ASSET_SCALES: scalesDict,
      placed_assets: placedAssets.map((a) => ({
        assetPath: a.assetPath,
        name: a.name,
        x: a.x,
        y: a.y,
        scaleX: a.scaleX,
        scaleY: a.scaleY,
        scaleZ: a.scaleZ,
        rotation: a.rotation,
        posXOffset: a.posXOffset,
        posYOffset: a.posYOffset,
        posZOffset: a.posZOffset,
        category: a.category,
        subIndex: a.subIndex,
        fpLeft: a.fpLeft,
        fpRight: a.fpRight,
        fpTop: a.fpTop,
        fpBottom: a.fpBottom
      }))
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(fullData, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `warmatrix_calibrated_scales_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON Config
  const importConfig = () => {
    try {
      const parsed = JSON.parse(importText);
      if (parsed.placed_assets && Array.isArray(parsed.placed_assets)) {
        const restored = parsed.placed_assets.map((a: any, index: number) => ({
          id: `placed_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
          assetPath: a.assetPath,
          name: a.name || 'Imported Asset',
          x: a.x,
          y: a.y,
          scaleX: a.scaleX ?? 0.05,
          scaleY: a.scaleY ?? 0.05,
          scaleZ: a.scaleZ ?? 0.05,
          rotation: a.rotation ?? 0,
          posXOffset: a.posXOffset ?? 0,
          posYOffset: a.posYOffset ?? 0,
          posZOffset: a.posZOffset ?? 0,
          category: a.category || 'residential',
          subIndex: a.subIndex !== undefined ? a.subIndex : -1,
          fpLeft: a.fpLeft ?? 0,
          fpRight: a.fpRight ?? 0,
          fpTop: a.fpTop ?? 0,
          fpBottom: a.fpBottom ?? 0
        }));
        setPlacedAssets(restored);
        if (restored.length > 0) {
          setSelectedAssetId(restored[0].id);
          setEditorMode('select');
        }
        setShowImportModal(false);
        setImportText('');
      } else {
        alert("Invalid format! JSON must contain a 'placed_assets' array.");
      }
    } catch (e: any) {
      alert(`Parsing Error: ${e.message}`);
    }
  };

  // Reset Grid
  const resetGrid = () => {
    if (confirm("Clear all placements on the grid?")) {
      setPlacedAssets([]);
      setSelectedAssetId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#02060E] text-[#E6EDF3] overflow-hidden select-none font-mono">
      {/* ── HEADER ── */}
      <header className="h-14 border-b border-[#1F6FEB]/20 bg-[#0F1115] flex items-center justify-between px-6 shrink-0 z-50 shadow-2xl">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/procedural')}
            className="text-[#9CA3AF] hover:text-white px-2.5 h-9"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="h-4 w-[1px] bg-[#1F6FEB]/20" />
          <h1 className={`${courierNew.className} font-bold text-lg tracking-tight text-[#1F6FEB] uppercase`}>
            WAR<span className="text-[#E6EDF3]">MATRIX</span>
          </h1>
          <div className="px-2 py-0.5 rounded-sm border text-[9px] font-bold uppercase tracking-wider bg-[#00e5ff]/10 border-[#00e5ff]/30 text-[#00e5ff]">
            Asset Calibrator Sandbox
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="bg-[#0D223A] border-[#1F6FEB]/30 text-[#00e5ff] hover:bg-[#1A3B5D] hover:text-white h-9 px-4 gap-2 text-[10px] uppercase font-bold tracking-widest"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Config
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={downloadConfig}
            className="bg-[#10B981]/15 border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/25 hover:text-white h-9 px-4 gap-2 text-[10px] uppercase font-bold tracking-widest shadow-[0_0_8px_rgba(16,185,129,0.15)]"
          >
            <Download className="w-3.5 h-3.5" /> Download Config
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetGrid}
            className="text-red-400 hover:text-red-300 hover:bg-red-950/20 h-9 px-3 gap-1 text-[10px] uppercase font-bold"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All
          </Button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: ASSET LIBRARY & PLACEMENTS */}
        <aside className="w-80 bg-[#0A0E17]/95 border-r border-[#1F6FEB]/20 flex flex-col overflow-hidden h-full">
          
          {/* Mode Selector */}
          <div className="p-4 border-b border-[#1F6FEB]/10">
            <label className="text-[10px] text-[#9CA3AF] uppercase font-bold block mb-2">
              Operation Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => {
                  setEditorMode('place');
                  setSelectedAssetId(null);
                }}
                className={`text-[10px] py-2.5 rounded border font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${
                  editorMode === 'place'
                    ? 'bg-[#00e5ff]/10 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.15)]'
                    : 'bg-[#02050A] border-[#1F6FEB]/20 text-[#9CA3AF] hover:border-[#1F6FEB]/40'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-center" /> Place
              </button>
              <button
                onClick={() => setEditorMode('select')}
                className={`text-[10px] py-2.5 rounded border font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${
                  editorMode === 'select'
                    ? 'bg-[#1F6FEB]/20 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_8px_rgba(31,111,235,0.15)]'
                    : 'bg-[#02050A] border-[#1F6FEB]/20 text-[#9CA3AF] hover:border-[#1F6FEB]/40'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-center" /> Tweak
              </button>
              <button
                onClick={() => {
                  setEditorMode('pan');
                  setSelectedAssetId(null);
                }}
                className={`text-[10px] py-2.5 rounded border font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${
                  editorMode === 'pan'
                    ? 'bg-[#00e5ff]/10 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.15)]'
                    : 'bg-[#02050A] border-[#1F6FEB]/20 text-[#9CA3AF] hover:border-[#1F6FEB]/40'
                }`}
              >
                <Hand className="w-3.5 h-3.5 text-center" /> Pan
              </button>
            </div>
          </div>

          {/* Catalog / Library Accordions */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 border-b border-[#1F6FEB]/10">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                Asset Library
              </span>
            </div>

            {/* Render Category Accordions */}
            {Object.entries({
              residential: 'Residential Buildings',
              commercial: 'Commercial Buildings',
              industrial: 'Industrial Buildings',
              office: 'Office Buildings',
              landmark: 'Landmark Spire Complex',
              comms_radar: 'Comms Array / Radar Stations',
              bridge: 'Bridges & Crossing Structures'
            }).map(([catKey, catLabel]) => {
              const isExpanded = expandedCategories[catKey];
              
              // Filter registry assets corresponding to this category
              let assetsList: any[] = [];
              if (catKey === 'comms_radar') {
                assetsList = [...ASSET_REGISTRY.communication_tower, ...ASSET_REGISTRY.radar_station];
              } else {
                assetsList = ASSET_REGISTRY[catKey as keyof typeof ASSET_REGISTRY] || [];
              }

              return (
                <div key={catKey} className="border border-[#1F6FEB]/10 rounded bg-[#070b12]">
                  <button
                    onClick={() => toggleCategory(catKey)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left text-xs font-bold text-[#9CA3AF] hover:text-white transition-colors"
                  >
                    <span className="truncate">{catLabel}</span>
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="p-2 border-t border-[#1F6FEB]/10 flex flex-col gap-1 bg-[#02050A]">
                      {assetsList.map((asset) => {
                        const isBrushActive = activeBrush?.path === asset.path;
                        return (
                          <button
                            key={asset.path}
                            onClick={() => {
                              setActiveBrush({
                                path: asset.path,
                                name: asset.name,
                                category: catKey
                              });
                              setEditorMode('place');
                            }}
                            className={`w-full text-left text-[11px] p-2 rounded transition-colors text-ellipsis overflow-hidden whitespace-nowrap flex items-center justify-between ${
                              isBrushActive
                                ? 'bg-[#1F6FEB]/15 border border-[#00e5ff] text-[#00e5ff]'
                                : 'hover:bg-[#111827] text-gray-400 hover:text-white'
                            }`}
                          >
                            <span>{asset.name}</span>
                            {isBrushActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Placed Assets list summary */}
          <div className="h-48 flex flex-col p-4 bg-[#080d15]/60 overflow-hidden shrink-0">
            <span className="text-[10px] text-[#9CA3AF] uppercase font-bold block mb-2">
              Placements list ({placedAssets.length})
            </span>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 font-mono text-[10px]">
              {placedAssets.length === 0 ? (
                <span className="text-gray-600 italic">No assets placed yet.</span>
              ) : (
                placedAssets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  return (
                    <div
                      key={asset.id}
                      onClick={() => {
                        setSelectedAssetId(asset.id);
                        setEditorMode('select');
                      }}
                      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-[#1F6FEB]/15 border-[#00e5ff] text-[#00e5ff]'
                          : 'bg-[#02050A]/40 border-transparent hover:bg-[#111827] text-gray-400'
                      }`}
                    >
                      <span className="truncate max-w-[150px]">{asset.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-[#8c9bab]">
                          [{asset.x},{asset.y}]
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAsset(asset.id);
                          }}
                          className="hover:text-red-400 text-gray-600 transition-colors p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* CENTER AREA: 3D VIEWPORT */}
        <main className="flex-1 relative bg-[#02060E] overflow-hidden flex flex-col">
          
          {/* Active Tool HUD Indicator */}
          <div className="absolute top-4 left-4 z-20 bg-[#0F1115]/85 border border-[#1F6FEB]/20 px-3 py-2 flex items-center gap-3.5 rounded-sm shadow-xl pointer-events-none">
            <Cpu className="w-4 h-4 text-[#00e5ff]" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">
                Active Tool / Brush
              </span>
              <span className="text-xs text-[#E6EDF3] truncate max-w-[200px]">
                {editorMode === 'place'
                  ? `Placement: ${activeBrush?.name || 'None'}`
                  : editorMode === 'pan'
                  ? 'Navigation: Drag Map to Pan'
                  : 'Select & Calibrate Mode'}
              </span>
            </div>
          </div>

          {/* Selected coordinates details */}
          {hoveredCell && (
            <div className="absolute bottom-4 left-4 z-20 bg-[#0F1115]/85 border border-[#1F6FEB]/20 px-3 py-2 flex items-center gap-2 rounded-sm shadow-xl pointer-events-none">
              <span className="text-[9px] font-bold text-[#00e5ff] uppercase">
                Cursor: [{hoveredCell.x}, {hoveredCell.y}]
              </span>
              <span className="text-[9px] text-gray-500">|</span>
              <span className="text-[9px] text-[#9CA3AF]">
                {cellToLatLong(hoveredCell.x, hoveredCell.y)}
              </span>
            </div>
          )}

          {/* R3F 3D Viewport */}
          <div 
            className="flex-1 w-full h-full relative z-10"
            style={{ cursor: editorMode === 'pan' ? 'grab' : 'default' }}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (e.button === 2) {
                setRightClickActive(true);
              }
            }}
            onPointerUp={(e) => {
              if (e.button === 2) {
                setRightClickActive(false);
              }
            }}
            onWheel={(e) => {
              if (selectedAssetId && e.buttons === 2) {
                e.preventDefault();
                const direction = e.deltaY < 0 ? 1 : -1;
                if (rightClickTarget === 'scale') {
                  const step = e.shiftKey ? 0.0002 : 0.001;
                  setPlacedAssets((prev) =>
                    prev.map((asset) => {
                      if (asset.id !== selectedAssetId) return asset;
                      const newScale = Math.max(0.001, Math.min(10.0, asset.scaleX + direction * step));
                      const updated = { ...asset, scaleX: newScale };
                      if (uniformScale) {
                        updated.scaleY = newScale;
                        updated.scaleZ = newScale;
                      }
                      return updated;
                    })
                  );
                } else {
                  const step = e.shiftKey ? 0.02 : 0.25;
                  const offsetField = rightClickTarget === 'offsetX' ? 'posXOffset' : rightClickTarget === 'offsetY' ? 'posYOffset' : 'posZOffset';
                  setPlacedAssets((prev) =>
                    prev.map((asset) => {
                      if (asset.id !== selectedAssetId) return asset;
                      const newVal = Math.max(-100.0, Math.min(100.0, asset[offsetField] + direction * step));
                      return { ...asset, [offsetField]: parseFloat(newVal.toFixed(3)) };
                    })
                  );
                }
              }
            }}
          >
            <Canvas
              camera={{ position: [0, -GRID_COLS * 3.5, GRID_COLS * 3.2], up: [0, 0, 1], fov: 45 }}
              gl={{ preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
              onCreated={({ gl }) => {
                gl.setClearColor(0x02060e);
              }}
            >
              {/* Atmosphere Fog */}
              <fog attach="fog" args={['#02060e', GRID_COLS * 2.5, GRID_COLS * 6.5]} />

              {/* Lights setup */}
              <ambientLight intensity={0.4} color={0x1e3a8a} />
              <directionalLight intensity={0.6} color={0x00c8ff} position={[GRID_COLS * 1.5, -GRID_COLS * 1.5, GRID_COLS * 1.5]} />
              <directionalLight intensity={0.2} color={0xffffff} position={[-GRID_COLS * 1.5, GRID_COLS * 1.5, GRID_COLS]} />

              {/* base grid */}
              <gridHelper
                args={[GRID_COLS * WORLD_SCALE, GRID_COLS, 0x0066aa, 0x002244]}
                position={[0, 0, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              />

              {/* Interactive single ground plane click catcher */}
              <mesh
                position={[0, 0, 0.005]}
                onClick={(e) => {
                  e.stopPropagation();
                  if (editorMode === 'pan') return;

                  // Prevent placement trigger if user dragged
                  const down = pointerDownPos.current;
                  if (down) {
                    const clientX = e.clientX ?? e.nativeEvent?.clientX;
                    const clientY = e.clientY ?? e.nativeEvent?.clientY;
                    if (clientX !== undefined && clientY !== undefined) {
                      const dist = Math.hypot(clientX - down.x, clientY - down.y);
                      if (dist > 5) return;
                    }
                  }

                  // Raycast intersection point to grid calculation
                  const cx = Math.floor(e.point.x / WORLD_SCALE + GRID_COLS / 2);
                  const cy = Math.floor(GRID_ROWS / 2 - e.point.y / WORLD_SCALE);
                  if (cx >= 0 && cx < GRID_COLS && cy >= 0 && cy < GRID_ROWS) {
                    handleCellClick(cx, cy);
                  }
                }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  if (editorMode === 'pan') {
                    setHoveredCell(null);
                    return;
                  }
                  const cx = Math.floor(e.point.x / WORLD_SCALE + GRID_COLS / 2);
                  const cy = Math.floor(GRID_ROWS / 2 - e.point.y / WORLD_SCALE);
                  if (cx >= 0 && cx < GRID_COLS && cy >= 0 && cy < GRID_ROWS) {
                    setHoveredCell({ x: cx, y: cy });
                  } else {
                    setHoveredCell(null);
                  }
                }}
                onPointerOut={() => {
                  setHoveredCell(null);
                }}
              >
                <planeGeometry args={[GRID_COLS * WORLD_SCALE, GRID_ROWS * WORLD_SCALE]} />
                <meshBasicMaterial transparent opacity={0.015} color="#1f6feb" side={THREE.DoubleSide} />
              </mesh>

              {/* Single Hovered Cell Neon Glow */}
              {hoveredCell && (
                <mesh
                  position={[
                    (hoveredCell.x - GRID_COLS / 2 + 0.5) * WORLD_SCALE,
                    (GRID_ROWS / 2 - hoveredCell.y - 0.5) * WORLD_SCALE,
                    0.015
                  ]}
                >
                  <planeGeometry args={[3.85, 3.85]} />
                  <meshBasicMaterial color="#00ffff" transparent opacity={0.3} side={THREE.DoubleSide} />
                </mesh>
              )}

              {/* Glowing active boundary border */}
              {(() => {
                const halfW = (GRID_COLS * WORLD_SCALE) / 2;
                const halfH = (GRID_ROWS * WORLD_SCALE) / 2;
                const points = [
                  new THREE.Vector3(-halfW, -halfH, 0.05),
                  new THREE.Vector3(halfW, -halfH, 0.05),
                  new THREE.Vector3(halfW, halfH, 0.05),
                  new THREE.Vector3(-halfW, halfH, 0.05),
                  new THREE.Vector3(-halfW, -halfH, 0.05)
                ];
                return (
                  <line>
                    <bufferGeometry attach="geometry" setFromPoints={points} />
                    <lineBasicMaterial attach="material" color="#00e5ff" linewidth={2} />
                  </line>
                );
              })()}

              {/* Placed model instances */}
              {placedAssets.map((asset) => (
                <EditorAssetInstance
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAssetId === asset.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editorMode === 'pan') return;

                    // Prevent selection trigger if user dragged
                    const down = pointerDownPos.current;
                    if (down) {
                      const clientX = e.clientX ?? e.nativeEvent?.clientX;
                      const clientY = e.clientY ?? e.nativeEvent?.clientY;
                      if (clientX !== undefined && clientY !== undefined) {
                        const dist = Math.hypot(clientX - down.x, clientY - down.y);
                        if (dist > 5) return;
                      }
                    }

                    setSelectedAssetId(asset.id);
                    setEditorMode('select');
                  }}
                />
              ))}

              {/* Orbit Controls */}
              <OrbitControls
                enableDamping
                dampingFactor={0.08}
                enablePan
                enableZoom={!rightClickActive}
                enableRotate
                mouseButtons={{
                  LEFT: editorMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
                  MIDDLE: THREE.MOUSE.DOLLY,
                  RIGHT: editorMode === 'pan' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN
                }}
                minDistance={10}
                maxDistance={GRID_COLS * 6.0}
                maxPolarAngle={Math.PI / 2 - 0.05}
              />
            </Canvas>
          </div>
        </main>

        {/* RIGHT PANEL: CALIBRATOR SLIDERS */}
        <aside className="w-80 bg-[#0A0E17]/95 border-l border-[#1F6FEB]/20 p-5 flex flex-col overflow-y-auto h-full shrink-0">
          
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-4 h-4 text-[#00e5ff]" />
            <h2 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
              Tuning Calibrator
            </h2>
          </div>

          {/* Scale Info Card */}
          <div className="bg-[#1F6FEB]/5 border border-[#1F6FEB]/15 p-3 rounded text-[10px] text-[#9CA3AF] leading-normal flex flex-col gap-1.5 mb-4 shrink-0">
            <span className="font-bold text-[#00e5ff] uppercase tracking-wider block">Grid Scale Translation</span>
            <p>
              1 grid cell in this sandbox is exactly 4x4 units, matching the wargame city map. Any asset calibrated to fit a cell here will translate 1-to-1 in width and depth to the generated map.
            </p>
          </div>

          {selectedAsset ? (
            <div className="flex flex-col gap-5">
              
              {/* Selected info header */}
              <div className="bg-[#02050A] border border-[#1F6FEB]/20 p-3 rounded">
                <span className="text-[9px] uppercase font-bold text-gray-500 block mb-0.5">
                  Selected Object
                </span>
                <span className="text-[12px] font-bold text-[#00e5ff] block truncate">
                  {selectedAsset.name}
                </span>
                <span className="text-[9px] text-[#9CA3AF] block font-mono truncate mt-1">
                  {selectedAsset.assetPath}
                </span>
                <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-[#1F6FEB]/10 text-[10px]">
                  <span className="text-gray-400">Position:</span>
                  <span className="text-white font-bold bg-[#111827] px-1.5 py-0.5 rounded">
                    [{selectedAsset.x}, {selectedAsset.y}]
                  </span>
                </div>
              </div>

              {/* Sub-Asset Selection Dropdown for Composite GLB Models */}
              <Suspense fallback={<div className="text-[10px] text-gray-500 py-1 font-mono">Loading sub-assets...</div>}>
                <SubAssetSelector
                  path={selectedAsset.assetPath}
                  subIndex={selectedAsset.subIndex}
                  onChange={(idx) => updateSelectedAsset({ subIndex: idx })}
                />
              </Suspense>

              {/* Uniform Scale lock check */}
              <label className="flex items-center justify-between text-xs cursor-pointer py-1 px-2 hover:bg-[#111827] rounded transition-colors border border-[#1F6FEB]/10">
                <span className="text-[10px] uppercase font-bold text-[#9CA3AF]">
                  Lock Uniform Scale
                </span>
                <input
                  type="checkbox"
                  checked={uniformScale}
                  onChange={(e) => setUniformScale(e.target.checked)}
                  className="accent-[#00e5ff] w-3.5 h-3.5"
                />
              </label>

              {/* Scales sliders */}
              <div className="flex flex-col gap-3.5">
                <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">
                  Dimensions Scaling
                </span>

                {/* Scale X */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-gray-400">Scale X (Width)</span>
                    <span className="text-[#00e5ff] font-bold">{selectedAsset.scaleX.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.scaleX;
                        updateSelectedAsset({ scaleX: Math.max(0.001, parseFloat((currentVal - 0.001).toFixed(4))) });
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      title="Decrease (0.001)"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="0.001"
                      max="10.0"
                      step="0.001"
                      value={selectedAsset.scaleX}
                      onChange={(e) => updateSelectedAsset({ scaleX: parseFloat(e.target.value) })}
                      onWheel={(e) => handleScaleWheel(e, 'scaleX')}
                      className="flex-1 accent-[#00e5ff] bg-gray-800 h-1.5 cursor-pointer"
                    />
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.scaleX;
                        updateSelectedAsset({ scaleX: Math.min(10.0, parseFloat((currentVal + 0.001).toFixed(4))) });
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      title="Increase (0.001)"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Scale Y */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-gray-400">Scale Y (Depth)</span>
                    <span className="text-[#00e5ff] font-bold">{selectedAsset.scaleY.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.scaleY;
                        updateSelectedAsset({ scaleY: Math.max(0.001, parseFloat((currentVal - 0.001).toFixed(4))) });
                      }}
                      disabled={uniformScale}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                      title="Decrease (0.001)"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="0.001"
                      max="10.0"
                      step="0.001"
                      value={selectedAsset.scaleY}
                      disabled={uniformScale}
                      onChange={(e) => updateSelectedAsset({ scaleY: parseFloat(e.target.value) })}
                      onWheel={(e) => handleScaleWheel(e, 'scaleY')}
                      className="flex-1 accent-[#00e5ff] bg-gray-800 h-1.5 cursor-pointer disabled:opacity-30"
                    />
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.scaleY;
                        updateSelectedAsset({ scaleY: Math.min(10.0, parseFloat((currentVal + 0.001).toFixed(4))) });
                      }}
                      disabled={uniformScale}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                      title="Increase (0.001)"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Scale Z */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-gray-400">Scale Z (Base Storey Height)</span>
                    <span className="text-[#00e5ff] font-bold">{selectedAsset.scaleZ.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.scaleZ;
                        updateSelectedAsset({ scaleZ: Math.max(0.001, parseFloat((currentVal - 0.001).toFixed(4))) });
                      }}
                      disabled={uniformScale}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                      title="Decrease (0.001)"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="0.001"
                      max="10.0"
                      step="0.001"
                      value={selectedAsset.scaleZ}
                      disabled={uniformScale}
                      onChange={(e) => updateSelectedAsset({ scaleZ: parseFloat(e.target.value) })}
                      onWheel={(e) => handleScaleWheel(e, 'scaleZ')}
                      className="flex-1 accent-[#00e5ff] bg-gray-800 h-1.5 cursor-pointer disabled:opacity-30"
                    />
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.scaleZ;
                        updateSelectedAsset({ scaleZ: Math.min(10.0, parseFloat((currentVal + 0.001).toFixed(4))) });
                      }}
                      disabled={uniformScale}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                      title="Increase (0.001)"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[9px] text-[#8c9bab]/70 italic mt-0.5 leading-normal">
                    * Z-Scale represents base storeys. In the procedural map, this is multiplied by building storeys (1-8).
                  </p>
                </div>
              </div>

              {/* Rotation Slider */}
              <div className="flex flex-col gap-1 border-t border-[#1F6FEB]/10 pt-3">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-400">Rotation (Z-Axis)</span>
                  <span className="text-[#00e5ff] font-bold">{Math.round(selectedAsset.rotation)}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={selectedAsset.rotation}
                  onChange={(e) => updateSelectedAsset({ rotation: parseInt(e.target.value) })}
                  className="w-full accent-[#00e5ff] bg-gray-800"
                />
              </div>

              {/* Position Offsets sliders */}
              <div className="flex flex-col gap-3.5 border-t border-[#1F6FEB]/10 pt-3">
                <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">
                  Micro Position Offsets
                </span>

                {/* Right-click wheel target selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-[#8c9bab] uppercase font-bold">Right-Click + Scroll Adjusts</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { value: 'scale' as const, label: 'Scale' },
                      { value: 'offsetX' as const, label: 'Off X' },
                      { value: 'offsetY' as const, label: 'Off Y' },
                      { value: 'offsetZ' as const, label: 'Off Z' }
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setRightClickTarget(value)}
                        className={`text-[8px] py-1.5 rounded border font-bold uppercase tracking-wider transition-all ${
                          rightClickTarget === value
                            ? 'bg-[#00e5ff]/15 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_6px_rgba(0,229,255,0.15)]'
                            : 'bg-[#02050A] border-[#1F6FEB]/20 text-[#9CA3AF] hover:border-[#1F6FEB]/40'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Offset X */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-gray-400">Offset X</span>
                    <span className="text-[#00e5ff] font-bold">{selectedAsset.posXOffset.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.posXOffset;
                        updateSelectedAsset({ posXOffset: Math.max(-100.0, parseFloat((currentVal - 0.25).toFixed(3))) });
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      title="Decrease (0.25)"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="-100.0"
                      max="100.0"
                      step="0.05"
                      value={selectedAsset.posXOffset}
                      onChange={(e) => updateSelectedAsset({ posXOffset: parseFloat(e.target.value) })}
                      onWheel={(e) => handleOffsetWheel(e, 'posXOffset')}
                      className="flex-1 accent-[#00e5ff] bg-gray-800 h-1.5 cursor-pointer"
                    />
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.posXOffset;
                        updateSelectedAsset({ posXOffset: Math.min(100.0, parseFloat((currentVal + 0.25).toFixed(3))) });
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      title="Increase (0.25)"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Offset Y */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-gray-400">Offset Y</span>
                    <span className="text-[#00e5ff] font-bold">{selectedAsset.posYOffset.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.posYOffset;
                        updateSelectedAsset({ posYOffset: Math.max(-100.0, parseFloat((currentVal - 0.25).toFixed(3))) });
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      title="Decrease (0.25)"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="-100.0"
                      max="100.0"
                      step="0.05"
                      value={selectedAsset.posYOffset}
                      onChange={(e) => updateSelectedAsset({ posYOffset: parseFloat(e.target.value) })}
                      onWheel={(e) => handleOffsetWheel(e, 'posYOffset')}
                      className="flex-1 accent-[#00e5ff] bg-gray-800 h-1.5 cursor-pointer"
                    />
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.posYOffset;
                        updateSelectedAsset({ posYOffset: Math.min(100.0, parseFloat((currentVal + 0.25).toFixed(3))) });
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      title="Increase (0.25)"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Offset Z */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-gray-400">Offset Z (Height)</span>
                    <span className="text-[#00e5ff] font-bold">{selectedAsset.posZOffset.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.posZOffset;
                        updateSelectedAsset({ posZOffset: Math.max(-100.0, parseFloat((currentVal - 0.25).toFixed(3))) });
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      title="Decrease (0.25)"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="-100.0"
                      max="100.0"
                      step="0.05"
                      value={selectedAsset.posZOffset}
                      onChange={(e) => updateSelectedAsset({ posZOffset: parseFloat(e.target.value) })}
                      onWheel={(e) => handleOffsetWheel(e, 'posZOffset')}
                      className="flex-1 accent-[#00e5ff] bg-gray-800 h-1.5 cursor-pointer"
                    />
                    <button
                      onClick={() => {
                        const currentVal = selectedAsset.posZOffset;
                        updateSelectedAsset({ posZOffset: Math.min(20.0, parseFloat((currentVal + 0.05).toFixed(3))) });
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      title="Increase (0.05)"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[9px] text-[#8c9bab]/70 italic mt-0.5 leading-normal">
                    * Z-Offset shifts the asset up or down from its grid anchor.
                  </p>
                </div>
              </div>
              {/* Grid Footprint Override */}
              <div className="flex flex-col gap-3.5 border-t border-[#1F6FEB]/10 pt-3">
                <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">
                  Footprint Adjust (Extend / Shrink)
                </span>
                <p className="text-[9px] text-[#8c9bab]/70 italic leading-normal -mt-1">
                  * Auto-calculated from bounding box. Use these to extend (+) or shrink (-) each edge.
                </p>

                {([
                  { key: 'fpLeft' as const, label: '← Left' },
                  { key: 'fpRight' as const, label: '→ Right' },
                  { key: 'fpTop' as const, label: '↑ Up' },
                  { key: 'fpBottom' as const, label: '↓ Down' },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-gray-400">{label}</span>
                      <span className={`font-bold ${selectedAsset[key] > 0 ? 'text-[#10B981]' : selectedAsset[key] < 0 ? 'text-[#EF4444]' : 'text-[#00e5ff]'}`}>
                        {selectedAsset[key] > 0 ? '+' : ''}{selectedAsset[key]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateSelectedAsset({ [key]: Math.max(-10, selectedAsset[key] - 1) })}
                        className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="-10"
                        max="30"
                        step="1"
                        value={selectedAsset[key]}
                        onChange={(e) => updateSelectedAsset({ [key]: parseInt(e.target.value) })}
                        className="flex-1 accent-[#00e5ff] bg-gray-800 h-1.5 cursor-pointer"
                      />
                      <button
                        onClick={() => updateSelectedAsset({ [key]: Math.min(30, selectedAsset[key] + 1) })}
                        className="w-6 h-6 flex items-center justify-center bg-[#02050A] border border-[#1F6FEB]/30 hover:border-[#00e5ff] rounded text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer font-bold select-none shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="flex flex-col gap-2 border-t border-[#1F6FEB]/10 pt-4">
                <Button
                  onClick={duplicateSelectedAsset}
                  variant="outline"
                  size="sm"
                  className="w-full bg-[#111827] border-[#1F6FEB]/30 text-white hover:bg-[#1f2937] text-xs font-bold gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicate Instance
                </Button>
                
                <Button
                  onClick={() => deleteAsset(selectedAsset.id)}
                  variant="destructive"
                  size="sm"
                  className="w-full bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/40 text-xs font-bold gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Placed Asset
                </Button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-4 border border-[#1F6FEB]/10 bg-[#02050A]/50 rounded">
              <span className="text-xs text-gray-500 leading-relaxed uppercase tracking-wider">
                Select a placed asset from the grid to adjust its scale, rotation, and micro-position parameters.
              </span>
            </div>
          )}

        </aside>

      </div>

      {/* ── IMPORT MODAL ── */}
      {showImportModal && (
        <div className="absolute inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#0F1115] border border-[#1F6FEB]/30 rounded-md w-full max-w-lg p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1F6FEB]/10 pb-2">
              <span className="font-bold text-[#00e5ff] text-sm uppercase tracking-widest">
                Upload Scale Config
              </span>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <p className="text-[10px] text-[#9CA3AF] leading-relaxed">
              Paste the contents of your downloaded `.json` config file below to restore placements and scale adjustments.
            </p>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{ "placed_assets": [ ... ] }'
              className="h-60 bg-[#02050A] border border-[#1F6FEB]/30 rounded p-3 font-mono text-xs text-[#E6EDF3] focus:outline-none focus:border-[#00e5ff] resize-none"
            />

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setShowImportModal(false)}
                variant="ghost"
                className="text-[#9CA3AF] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={importConfig}
                className="bg-[#00e5ff] hover:bg-[#33ebff] text-black font-bold uppercase text-xs px-4"
              >
                Upload Config
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
