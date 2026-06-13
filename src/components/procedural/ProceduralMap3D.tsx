'use client';

import React, { useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { UrbanMapResponse } from '@/lib/procedural/types';
import { DISTRICT_COLORS, ROAD_COLORS, getGLBPath, DEFAULT_ASSET_SCALES, getSubAssets } from '@/lib/procedural/assetRegistry';

interface ProceduralMap3DProps {
  mapData: UrbanMapResponse;
  activeLayers: {
    roads: boolean;
    districts: boolean;
    buildings: boolean;
    metadata: boolean;
  };
}

const WORLD_SCALE = 4;

function gridToWorld(x: number, y: number, cols: number, rows: number): [number, number] {
  const wx = (x - cols / 2 + 0.5) * WORLD_SCALE;
  const wy = (rows / 2 - y - 0.5) * WORLD_SCALE;
  return [wx, wy];
}

// Subcomponent to load and render GLB files with a Suspense fallback wireframe box
function GLBModel({ path, position, rotation, height, color }: { path: string; position: [number, number, number]; rotation: number; height: number; color: string }) {
  const { scene } = useGLTF(path);
  
  const scaleConf = DEFAULT_ASSET_SCALES[path] || { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.04 };
  const subIndex = scaleConf.subIndex;

  // Clone filled model with translucent material & emissive neon color matching district type
  const clonedFilled = useMemo(() => {
    const s = new THREE.Group();
    const subAssets = getSubAssets(scene);
    const childrenToCopy = (subIndex !== undefined && subIndex >= 0 && subIndex < subAssets.length)
      ? [subAssets[subIndex]]
      : subAssets;

    childrenToCopy.forEach((child) => {
      s.add(child.clone());
    });

    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#010a15'),
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.75,
          flatShading: true,
          metalness: 0.2,
          roughness: 0.8
        });
      }
    });
    return s;
  }, [scene, color, subIndex]);

  // Clone wireframe overlay mesh with additive blending
  const clonedWireframe = useMemo(() => {
    const s = new THREE.Group();
    const subAssets = getSubAssets(scene);
    const childrenToCopy = (subIndex !== undefined && subIndex >= 0 && subIndex < subAssets.length)
      ? [subAssets[subIndex]]
      : subAssets;

    childrenToCopy.forEach((child) => {
      s.add(child.clone());
    });

    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          wireframe: true,
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending
        });
      }
    });
    return s;
  }, [scene, color, subIndex]);

  const scale: [number, number, number] = [
    scaleConf.scaleX,
    scaleConf.scaleY,
    scaleConf.scaleZ * (height || 1)
  ];
  
  const positionOffset = scaleConf.positionOffset || [0, 0, 0];
  const finalPosition: [number, number, number] = [
    position[0] + positionOffset[0],
    position[1] + positionOffset[1],
    position[2] + positionOffset[2]
  ];
  
  const finalRotation: [number, number, number] = [
    0,
    0,
    ((rotation + (scaleConf.rotationOffset || 0)) * Math.PI) / 180
  ];

  return (
    <group position={finalPosition} rotation={finalRotation} scale={scale}>
      <primitive key={`${path}-${subIndex}`} object={clonedFilled} rotation={[Math.PI / 2, 0, 0]} />
      <primitive key={`${path}-${subIndex}-wire`} object={clonedWireframe} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}


function AssetInstance({ path, position, rotation, height, color }: { path: string; position: [number, number, number]; rotation: number; height: number; color: string }) {
  return (
    <Suspense
      fallback={
        <mesh position={[position[0], position[1], position[2] + (height * 0.1) / 2]}>
          <boxGeometry args={[0.3, 0.3, height * 0.1]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
        </mesh>
      }
    >
      <GLBModel path={path} position={position} rotation={rotation} height={height} color={color} />
    </Suspense>
  );
}

// ─── Main 3D Component ──────────────────────────────────────────────────────────

export function ProceduralMap3D({ mapData, activeLayers }: ProceduralMap3DProps) {
  const [cols, rows] = mapData.grid_size;
  const maxAxis = Math.max(cols, rows);

  // Compute road segments for rendering
  const roadSegments = useMemo(() => {
    return mapData.roads.map((r) => {
      const [sx, sy] = gridToWorld(r.start[0], r.start[1], cols, rows);
      const [ex, ey] = gridToWorld(r.end[0], r.end[1], cols, rows);
      
      const isVertical = r.start[0] === r.end[0];
      const thickness = r.type === 'Primary' ? 2.4 : (r.type === 'Secondary' ? 1.6 : 1.0);
      const halfThick = thickness / 2;
      
      const len = isVertical ? Math.abs(sy - ey) + WORLD_SCALE : Math.abs(sx - ex) + WORLD_SCALE;
      const cx = isVertical ? sx : (sx + ex) / 2;
      const cy = isVertical ? (sy + ey) / 2 : sy;

      return {
        id: r.id,
        type: r.type,
        isVertical,
        thickness,
        halfThick,
        len,
        cx,
        cy
      };
    });
  }, [mapData.roads, cols, rows]);

  return (
    <div className="flex-1 relative bg-[#02060E]" style={{ touchAction: 'none' }}>
      <Canvas
        camera={{ position: [0, -maxAxis * 3.5, maxAxis * 3.2], up: [0, 0, 1], fov: 45 }}
        gl={{ preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x02060e);
        }}
      >
        {/* Holographic Atmos Fog */}
        <fog attach="fog" args={['#02060e', maxAxis * 2.5, maxAxis * 6.5]} />

        {/* Dynamic Light Setup */}
        <ambientLight intensity={0.4} color={0x1e3a8a} />
        <directionalLight intensity={0.6} color={0x00c8ff} position={[maxAxis * 1.5, -maxAxis * 1.5, maxAxis * 1.5]} />
        <directionalLight intensity={0.2} color={0xffffff} position={[-maxAxis * 1.5, maxAxis * 1.5, maxAxis]} />


        {/* 2D Tactical base grid representing map cells */}
        <gridHelper
          args={[maxAxis * WORLD_SCALE, maxAxis, 0x0066aa, 0x002244]}
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />

        {/* City Boundary projection */}
        {activeLayers.districts && (
          <group>
            {/* Draw border lines around the city boundaries */}
            {(() => {
              const bounds = mapData.city_bounds;
              const [minX, minY] = gridToWorld(bounds.min_x, bounds.min_y, cols, rows);
              const [maxX, maxY] = gridToWorld(bounds.max_x, bounds.max_y, cols, rows);
              
              // Draw border points
              const points = [
                new THREE.Vector3(minX - 2, minY + 2, 0.05),
                new THREE.Vector3(maxX + 2, minY + 2, 0.05),
                new THREE.Vector3(maxX + 2, maxY - 2, 0.05),
                new THREE.Vector3(minX - 2, maxY - 2, 0.05),
                new THREE.Vector3(minX - 2, minY + 2, 0.05),
              ];
              
              return (
                <line>
                  <bufferGeometry attach="geometry" setFromPoints={points} />
                  <lineBasicMaterial attach="material" color="#00e5ff" linewidth={2} />
                </line>
              );
            })()}
          </group>
        )}

        {/* District projection overlays */}
        {activeLayers.districts &&
          mapData.districts.map((d) => {
            const [minX, minY] = gridToWorld(d.bounds.min_x, d.bounds.min_y, cols, rows);
            const [maxX, maxY] = gridToWorld(d.bounds.max_x, d.bounds.max_y, cols, rows);
            const w = Math.abs(maxX - minX) + WORLD_SCALE;
            const h = Math.abs(maxY - minY) + WORLD_SCALE;
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const color = DISTRICT_COLORS[d.type] || '#888';

            return (
              <mesh key={d.id} position={[cx, cy, 0.01]}>
                <planeGeometry args={[w, h]} />
                <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.DoubleSide} />
              </mesh>
            );
          })}

        {/* Road network 3D representation */}
        {activeLayers.roads &&
          roadSegments.map((seg) => {
            const { id, type, isVertical, thickness, halfThick, len, cx, cy } = seg;
            
            // Define structural dimensions based on road type (scaled up for blocky, premium look)
            let deckHeight = 0.04;
            let deckThickness = 0.03;
            let guardrailHeight = 0.05;
            let guardrailWidth = 0.06;
            let showPillars = false;

            if (type === 'Primary') {
              deckHeight = 0.40;      // Major elevated highway
              deckThickness = 0.08;
              guardrailHeight = 0.12;
              guardrailWidth = 0.10;
              showPillars = true;
            } else if (type === 'Secondary') {
              deckHeight = 0.15;      // Raised arterial road
              deckThickness = 0.05;
              guardrailHeight = 0.08;
              guardrailWidth = 0.08;
            }

            // Calculate support pillars for elevated highways
            const pillars = [];
            if (showPillars) {
              const numColumns = Math.max(2, Math.floor(len / 8.0));
              for (let k = 0; k < numColumns; k++) {
                const ratio = numColumns > 1 ? k / (numColumns - 1) : 0.5;
                const offset = len * 0.1; // 10% indent from ends
                const pos = (len * 0.8) * ratio + offset - len / 2;
                
                const colX = isVertical ? cx : cx + pos;
                const colY = isVertical ? cy + pos : cy;
                pillars.push([colX, colY, deckHeight / 2] as [number, number, number]);
              }
            }

            return (
              <group key={id}>
                {/* 1. Support Pillars (Elevated Expressways) */}
                {pillars.map((pos, pIdx) => (
                  <mesh key={`${id}-pillar-${pIdx}`} position={pos}>
                    <boxGeometry args={[0.5, 0.5, deckHeight]} />
                    <meshStandardMaterial color="#0B132B" roughness={0.7} metalness={0.2} />
                  </mesh>
                ))}

                {/* 2. Asphalt Deck Bed */}
                <mesh position={[cx, cy, deckHeight - deckThickness / 2]}>
                  <boxGeometry args={[isVertical ? thickness : len, isVertical ? len : thickness, deckThickness]} />
                  <meshStandardMaterial color="#081121" roughness={0.9} metalness={0.2} emissive="#020E22" emissiveIntensity={0.6} />
                </mesh>
                
                {/* 3. Left/Top Guardrail (Concrete barrier) */}
                <mesh position={isVertical ? [cx - halfThick + guardrailWidth / 2, cy, deckHeight + guardrailHeight / 2] : [cx, cy + halfThick - guardrailWidth / 2, deckHeight + guardrailHeight / 2]}>
                  <boxGeometry args={isVertical ? [guardrailWidth, len, guardrailHeight] : [len, guardrailWidth, guardrailHeight]} />
                  <meshStandardMaterial color="#1F6FEB" roughness={0.8} emissive="#1F6FEB" emissiveIntensity={0.4} />
                </mesh>

                {/* 4. Right/Bottom Guardrail (Concrete barrier) */}
                <mesh position={isVertical ? [cx + halfThick - guardrailWidth / 2, cy, deckHeight + guardrailHeight / 2] : [cx, cy - halfThick + guardrailWidth / 2, deckHeight + guardrailHeight / 2]}>
                  <boxGeometry args={isVertical ? [guardrailWidth, len, guardrailHeight] : [len, guardrailWidth, guardrailHeight]} />
                  <meshStandardMaterial color="#1F6FEB" roughness={0.8} emissive="#1F6FEB" emissiveIntensity={0.4} />
                </mesh>

                {/* 5. Glowing Center Markings */}
                {type === 'Primary' && (
                  <mesh position={[cx, cy, deckHeight + 0.001]}>
                    <boxGeometry args={isVertical ? [0.08, len, 0.003] : [len, 0.08, 0.003]} />
                    <meshStandardMaterial color="#FF9E0B" emissive="#FF9E0B" emissiveIntensity={1.5} />
                  </mesh>
                )}
                {type === 'Secondary' && (
                  <mesh position={[cx, cy, deckHeight + 0.001]}>
                    <boxGeometry args={isVertical ? [0.06, len, 0.003] : [len, 0.06, 0.003]} />
                    <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={1.0} />
                  </mesh>
                )}
                {type === 'Local' && (
                  <mesh position={[cx, cy, deckHeight + 0.001]}>
                    <boxGeometry args={isVertical ? [0.04, len, 0.003] : [len, 0.04, 0.003]} />
                    <meshStandardMaterial color="#8B5CF6" emissive="#8B5CF6" emissiveIntensity={0.6} />
                  </mesh>
                )}
              </group>
            );
          })}

        {/* 3D Buildings layers */}
        {activeLayers.buildings &&
          mapData.buildings.map((b) => {
            const [wx, wy] = gridToWorld(b.x, b.y, cols, rows);
            const color = DISTRICT_COLORS[b.type as keyof typeof DISTRICT_COLORS] || '#888';
            const assetPath = getGLBPath(b.asset_key);

            return (
              <group key={b.id} position={[wx, wy, 0]}>
                {/* Visual anchor glow under model */}
                <mesh position={[0, 0, 0.02]}>
                  <planeGeometry args={[3.2, 3.2]} />
                  <meshBasicMaterial color={color} transparent opacity={0.25} />
                </mesh>
                
                {/* Deterministic asset instance model */}
                <AssetInstance
                  path={assetPath}
                  position={[0, 0, 0]}
                  rotation={b.rotation}
                  height={b.height}
                  color={color}
                />
              </group>
            );
          })}



        {/* Orbit Controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          enablePan
          enableZoom
          enableRotate
          minDistance={10}
          maxDistance={maxAxis * 6}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>
    </div>
  );
}
