export const DISTRICT_COLORS = {
  Commercial: '#EC4899',  // Magenta/Pink
  Residential: '#10B981', // Emerald Green
  Industrial: '#F59E0B',  // Amber
  Government: '#3B82F6',  // Strategic Blue
  Military: '#EF4444',    // Threat Red
  Outskirts: '#4B5563',   // Gray
};

export const ROAD_COLORS = {
  Primary: '#718096',   // Slate Gray
  Secondary: '#4A5568', // Dark Slate
  Local: '#2D3748',     // Deep Slate
};

export interface AssetInfo {
  path: string;
  name: string;
}

// Complete Inventory of public/3d_assets
export const ASSET_REGISTRY = {
  residential: [
    { path: '/3d_assets/buildings/residential/asia_building.glb', name: 'Asia Apartment Block' },
    { path: '/3d_assets/buildings/residential/brutalist_building.glb', name: 'Brutalist Block' },
    { path: '/3d_assets/buildings/residential/futuristic_building.glb', name: 'Futuristic Tower' },
    { path: '/3d_assets/buildings/residential/building_1.glb', name: 'Apartment Complex A' },
    { path: '/3d_assets/buildings/residential/building_2.glb', name: 'Apartment Complex B' },
    { path: '/3d_assets/buildings/residential/building_3.glb', name: 'Apartment Complex C' },
    { path: '/3d_assets/buildings/residential/building_6.glb', name: 'Apartment Complex D' },
  ],
  commercial: [
    { path: '/3d_assets/buildings/commercial/building_-_new_york.glb', name: 'NYC Retail Block' },
    { path: '/3d_assets/buildings/commercial/city_building_2.glb', name: 'Commercial Plaza' },
    { path: '/3d_assets/buildings/commercial/game_ready_building_5.glb', name: 'Modern Department Store' },
    { path: '/3d_assets/buildings/commercial/old_building_1.glb', name: 'Classic Brick Commercial' },
  ],
  industrial: [
    { path: '/3d_assets/buildings/industrial/industrial_building.glb', name: 'Manufacturing Plant' },
    { path: '/3d_assets/buildings/industrial/warehouse_building.glb', name: 'Logistics Warehouse' },
    { path: '/3d_assets/buildings/industrial/warehouse_building_1.glb', name: 'Distribution Center' },
    { path: '/3d_assets/buildings/industrial/abandoned_building.glb', name: 'Derelict Factory' },
  ],
  office: [
    { path: '/3d_assets/buildings/office/office_building.glb', name: 'Corporate Office' },
    { path: '/3d_assets/buildings/office/building_05.glb', name: 'Financial Center A' },
    { path: '/3d_assets/buildings/office/whitehall_building.glb', name: 'Whitehall Plaza' },
    { path: '/3d_assets/buildings/office/city_building.glb', name: 'Glass Tower' },
  ],
  landmark: [
    { path: '/3d_assets/buildings/landmark/tu_ducs_tomb_-_stele_building_cyark_dataset.glb', name: 'Tu Duc Tomb Complex' },
    { path: '/3d_assets/buildings/landmark/sci-fi_building.glb', name: 'Command & Control Spire' },
    { path: '/3d_assets/buildings/landmark/sci-fi_building_2.glb', name: 'Command Spire B' },
    { path: '/3d_assets/buildings/landmark/the_view_building.glb', name: 'Sky-deck Megastructure' },
  ],
  communication_tower: [
    { path: '/3d_assets/communication_tower/signal_tower.glb', name: 'Signal Antenna Tower' },
    { path: '/3d_assets/communication_tower/40_meter_radiotower.glb', name: '40m Communications Mast' },
    { path: '/3d_assets/communication_tower/prefabbed_radio_tower_with_blankout_signs.glb', name: 'Strategic Comms Array' },
  ],
  radar_station: [
    { path: '/3d_assets/radar_station/devils_slide_bunker_-_pacifica_ca.glb', name: 'Devils Slide Bunker' },
  ],
  bridge: [
    { path: '/3d_assets/bridge/stone_bridge.glb', name: 'Stone Arch Bridge' },
    { path: '/3d_assets/bridge/wooden_bridge.glb', name: 'Trestle Wooden Bridge' },
    { path: '/3d_assets/bridge/lowpoly_manhattan_bridge.glb', name: 'Manhattan Suspension Bridge' },
  ]
};

export interface AssetScaleConfig {
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationOffset?: number; // degrees
  positionOffset?: [number, number, number]; // [x, y, z]
  subIndex?: number; // child index to render for composite GLB files
}

export const DEFAULT_ASSET_SCALES: Record<string, AssetScaleConfig> = {
  // Residential
  '/3d_assets/buildings/residential/asia_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/brutalist_building.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/futuristic_building.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/building_1.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/building_2.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/building_3.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/building_6.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Commercial
  '/3d_assets/buildings/commercial/building_-_new_york.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/commercial/city_building_2.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/commercial/game_ready_building_5.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/commercial/old_building_1.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Industrial
  '/3d_assets/buildings/industrial/industrial_building.glb': { scaleX: 0.06, scaleY: 0.06, scaleZ: 0.06, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/warehouse_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/warehouse_building_1.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/abandoned_building.glb': { scaleX: 0.06, scaleY: 0.06, scaleZ: 0.06, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Office
  '/3d_assets/buildings/office/office_building.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/office/building_05.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/office/whitehall_building.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/office/city_building.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Landmark
  '/3d_assets/buildings/landmark/tu_ducs_tomb_-_stele_building_cyark_dataset.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/landmark/sci-fi_building.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/landmark/sci-fi_building_2.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/landmark/the_view_building.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Comms / Radar
  '/3d_assets/communication_tower/signal_tower.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/communication_tower/40_meter_radiotower.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/communication_tower/prefabbed_radio_tower_with_blankout_signs.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/radar_station/devils_slide_bunker_-_pacifica_ca.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Bridge
  '/3d_assets/bridge/stone_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/wooden_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/lowpoly_manhattan_bridge.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
};

export function getGLBPath(assetKey: string): string {
  if (!assetKey) return '';
  if (assetKey.startsWith('/3d_assets/')) return assetKey;
  if (assetKey.startsWith('3d_assets/')) return `/${assetKey}`;
  const cleanKey = assetKey.startsWith('/') ? assetKey.slice(1) : assetKey;
  return `/3d_assets/${cleanKey}`;
}

