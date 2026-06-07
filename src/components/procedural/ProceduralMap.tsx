'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UrbanMapResponse, CellMetadata } from '@/lib/procedural/types';
import { DISTRICT_COLORS, ROAD_COLORS } from '@/lib/procedural/assetRegistry';
import { ProceduralMap3D } from './ProceduralMap3D';
import { Layers, Compass, Crosshair, Eye, EyeOff } from 'lucide-react';

interface ProceduralMapProps {
  mapData: UrbanMapResponse | null;
  activeLayers: {
    roads: boolean;
    districts: boolean;
    buildings: boolean;
    metadata: boolean;
  };
  viewMode: '2d' | '3d';
  metadataField: 'cover' | 'movement' | 'visibility' | 'comms';
}

function cellToLatLong(x: number, y: number, cols: number, rows: number): string {
  const lat = 45.0230 + (rows / 2 - y - 0.5) * 0.0015;
  const lng = 122.4510 + (x - cols / 2 + 0.5) * 0.0022;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

export function ProceduralMap({
  mapData,
  activeLayers,
  viewMode,
  metadataField,
}: ProceduralMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellMetadata | null>(null);
  const [dimensions, setDimensions] = useState({ width: 720, height: 480 });
  const [hideStructures, setHideStructures] = useState(false);

  useEffect(() => {
    if (viewMode === '2d') {
      setHideStructures(false);
    }
  }, [viewMode]);

  const [cols, rows] = mapData ? mapData.grid_size : [12, 8];

  useEffect(() => {
    if (viewMode !== '2d' || !containerRef.current) return;
    const container = containerRef.current;
    const updateSize = () => {
      setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewMode]);

  // ─── 2D Canvas Renderer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== '2d' || !mapData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;

    // Reset shadow properties to prevent bleeding/glow leaks
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Holographic background
    ctx.fillStyle = '#02060E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Centre radial glow
    const radialGrad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 50,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.5
    );
    radialGrad.addColorStop(0, 'rgba(0, 200, 255, 0.08)');
    radialGrad.addColorStop(1, 'rgba(0, 200, 255, 0)');
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Districts
    if (activeLayers.districts) {
      mapData.districts.forEach((d) => {
        ctx.fillStyle = (DISTRICT_COLORS[d.type] || '#FFF') + '12'; // 7% opacity
        const x = d.bounds.min_x * cellWidth;
        const y = d.bounds.min_y * cellHeight;
        const w = (d.bounds.max_x - d.bounds.min_x + 1) * cellWidth;
        const h = (d.bounds.max_y - d.bounds.min_y + 1) * cellHeight;
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = DISTRICT_COLORS[d.type] || '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
      });
    }

    // Draw Metadata layer
    if (activeLayers.metadata) {
      mapData.metadata.forEach((m) => {
        let val = 0;
        let color = 'rgba(0, 229, 255, ';
        if (metadataField === 'cover') {
          val = m.cover_value; // range [0, 1]
          color = 'rgba(0, 229, 255, ' + val * 0.45 + ')';
        } else if (metadataField === 'movement') {
          val = (m.movement_cost - 1) / 4; // normalized range [0, 1]
          color = 'rgba(245, 158, 11, ' + val * 0.45 + ')';
        } else if (metadataField === 'visibility') {
          val = 1.0 - m.visibility_modifier; // lower is better cover
          color = 'rgba(239, 68, 68, ' + val * 0.45 + ')';
        } else if (metadataField === 'comms') {
          val = (m.communication_modifier - 1.0) * 5; // offset range
          color = 'rgba(59, 130, 246, ' + val * 0.45 + ')';
        }

        ctx.fillStyle = color;
        ctx.fillRect(m.x * cellWidth, m.y * cellHeight, cellWidth, cellHeight);
      });
    }

    // Draw Cell grid
    ctx.strokeStyle = 'rgba(31, 111, 235, 0.14)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellWidth, 0);
      ctx.lineTo(i * cellWidth, canvas.height);
      ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * cellHeight);
      ctx.lineTo(canvas.width, j * cellHeight);
      ctx.stroke();
    }

    // Draw City Boundary Box
    if (activeLayers.districts) {
      const bounds = mapData.city_bounds;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 4;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        bounds.min_x * cellWidth,
        bounds.min_y * cellHeight,
        (bounds.max_x - bounds.min_x + 1) * cellWidth,
        (bounds.max_y - bounds.min_y + 1) * cellHeight
      );
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    // Draw Roads
    if (activeLayers.roads) {
      mapData.roads.forEach((r) => {
        // Glowing tactical holographic road colors
        const borderColor = '#1F6FEB'; // Electric blue curb border
        const fillColor = '#0A1424';   // Cyber midnight blue asphalt fill
        
        // Define width of road corridors on canvas
        const thickness = r.type === 'Primary' ? 9 : (r.type === 'Secondary' ? 6 : 4);
        const radius = thickness / 2;

        const x0 = (r.start[0] + 0.5) * cellWidth;
        const y0 = (r.start[1] + 0.5) * cellHeight;
        const x1 = (r.end[0] + 0.5) * cellWidth;
        const y1 = (r.end[1] + 0.5) * cellHeight;

        const isVertical = r.start[0] === r.end[0];

        // 1. Draw Road Corridor Fill
        ctx.fillStyle = fillColor;
        if (isVertical) {
          ctx.fillRect(x0 - radius, Math.min(y0, y1), thickness, Math.abs(y1 - y0));
        } else {
          ctx.fillRect(Math.min(x0, x1), y0 - radius, Math.abs(x1 - x0), thickness);
        }

        // 2. Draw Parallel Curb Borders
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (isVertical) {
          // Left border
          ctx.moveTo(x0 - radius, y0);
          ctx.lineTo(x0 - radius, y1);
          // Right border
          ctx.moveTo(x0 + radius, y0);
          ctx.lineTo(x0 + radius, y1);
        } else {
          // Top border
          ctx.moveTo(x0, y0 - radius);
          ctx.lineTo(x1, y1 - radius);
          // Bottom border
          ctx.moveTo(x0, y0 + radius);
          ctx.lineTo(x1, y1 + radius);
        }
        ctx.stroke();

        // 3. Draw Center Lane Divider for Primary / Local roads
        if (r.type === 'Primary') {
          ctx.strokeStyle = '#F59E0B'; // Glowing yellow/orange center line
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
        } else if (r.type === 'Local') {
          ctx.strokeStyle = '#00e5ff'; // Glowing cyan center line
          ctx.lineWidth = 1;
          ctx.setLineDash([1, 4]);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
        }
      });
    }

    // Draw Buildings
    if (activeLayers.buildings) {
      mapData.buildings.forEach((b) => {
        const color = DISTRICT_COLORS[b.type as keyof typeof DISTRICT_COLORS] || '#888';
        // Transparent fill
        ctx.fillStyle = color + '1A';
        const padding = 2.5;
        const bx = b.x * cellWidth + padding;
        const by = b.y * cellHeight + padding;
        const bw = cellWidth - padding * 2;
        const bh = cellHeight - padding * 2;
        ctx.fillRect(bx, by, bw, bh);

        // Holographic neon outline
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(bx, by, bw, bh);

        // Display height value inside building representation
        ctx.fillStyle = color;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.height.toString(), bx + bw / 2, by + bh / 2);
      });
    }



    // Corner brackets
    const bracketSize = 15;
    ctx.strokeStyle = 'rgba(31, 111, 235, 0.45)';
    ctx.lineWidth = 1.5;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(bracketSize, 5); ctx.lineTo(5, 5); ctx.lineTo(5, bracketSize);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(canvas.width - bracketSize, 5); ctx.lineTo(canvas.width - 5, 5); ctx.lineTo(canvas.width - 5, bracketSize);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(bracketSize, canvas.height - 5); ctx.lineTo(5, canvas.height - 5); ctx.lineTo(5, canvas.height - bracketSize);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(canvas.width - bracketSize, canvas.height - 5); ctx.lineTo(canvas.width - 5, canvas.height - 5); ctx.lineTo(canvas.width - 5, canvas.height - bracketSize);
    ctx.stroke();


  }, [viewMode, mapData, activeLayers, metadataField]);

  // Handle cell hovering tooltip detection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mapData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const [cols, rows] = mapData.grid_size;
    const cellX = Math.floor((clientX / rect.width) * cols);
    const cellY = Math.floor((clientY / rect.height) * rows);

    const match = mapData.metadata.find((m) => m.x === cellX && m.y === cellY);
    setHoveredCell(match || null);
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  if (!mapData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#02050A] border border-[#1F6FEB]/20 font-mono text-[#9CA3AF]">
        <Layers className="w-10 h-10 text-[#1F6FEB]/40 mb-3 animate-pulse" />
        <span className="text-xs uppercase tracking-widest text-[#1F6FEB]/80">
          Awaiting Simulation Target seed...
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-[#02050A] border border-[#1F6FEB]/20 flex flex-col overflow-hidden h-full">
      {/* 2D Mode */}
      {viewMode === '2d' && (
        <div ref={containerRef} className="flex-1 w-full h-full relative p-0 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-full h-full block"
          />

          {/* Mouse Hover Cell Tooltip */}
          {hoveredCell && (
            <div className="absolute top-4 right-4 bg-[#0F1115]/95 border border-[#1F6FEB]/30 p-4 rounded shadow-2xl font-mono text-xs flex flex-col gap-2 min-w-[200px] z-20">
              <div className="flex items-center justify-between border-b border-[#1F6FEB]/20 pb-1.5 mb-1">
                <span className="font-bold text-[#00e5ff] uppercase tracking-wider">
                  Coordinate
                </span>
                <span className="text-gray-400 font-bold">
                  [{hoveredCell.x}, {hoveredCell.y}]
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Lat / Long:</span>
                <span className="text-[#00e5ff] font-bold">
                  {cellToLatLong(hoveredCell.x, hoveredCell.y, cols, rows)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sector:</span>
                <span className="text-[#E6EDF3] capitalize">{hoveredCell.district_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Is Road:</span>
                <span className="text-[#E6EDF3]">{hoveredCell.is_road ? `Yes (${hoveredCell.road_type})` : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cover Value:</span>
                <span className="text-[#10B981]">{hoveredCell.cover_value.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Movement Cost:</span>
                <span className="text-[#F59E0B]">{hoveredCell.movement_cost} AP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Visibility Mod:</span>
                <span className="text-[#EF4444]">{hoveredCell.visibility_modifier.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Comms Mod:</span>
                <span className="text-[#3B82F6]">{hoveredCell.communication_modifier.toFixed(2)}x</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3D Mode */}
      {viewMode === '3d' && mapData && (
        <>
          <ProceduralMap3D
            mapData={mapData}
            activeLayers={
              hideStructures
                ? { roads: true, districts: false, buildings: false, metadata: false }
                : activeLayers
            }
          />
          <button
            onClick={() => setHideStructures(!hideStructures)}
            className={`absolute top-4 right-4 z-10 px-3.5 py-2 font-mono text-xs font-bold border rounded flex items-center gap-1.5 transition-all duration-200 shadow-xl ${
              hideStructures
                ? 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40 hover:bg-[#EF4444]/30'
                : 'bg-[#0F1115]/80 text-[#00e5ff] border-[#1F6FEB]/30 hover:bg-[#1F6FEB]/20 hover:border-[#00e5ff]/50'
            }`}
          >
            {hideStructures ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>SHOW STRUCTURES</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>HIDE STRUCTURES</span>
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
