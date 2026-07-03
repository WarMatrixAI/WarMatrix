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
    { path: '/3d_assets/buildings/residential/100_lowpoly_buildings__buildings_pack.glb', name: 'Low-Poly Building Pack' },
    { path: '/3d_assets/buildings/residential/bayard_building.glb', name: 'Bayard Apartment Block' },
    { path: '/3d_assets/buildings/residential/buildings.glb', name: 'Standard Residential Blocks' },
    { path: '/3d_assets/buildings/residential/buildings_1.glb', name: 'Residential Cluster A' },
    { path: '/3d_assets/buildings/residential/buildings_2.glb', name: 'Residential Cluster B' },
    { path: '/3d_assets/buildings/residential/building_01.glb', name: 'Condominium Block A' },
    { path: '/3d_assets/buildings/residential/building_02.glb', name: 'Condominium Block B' },
    { path: '/3d_assets/buildings/residential/building_06.glb', name: 'Townhouses Set' },
    { path: '/3d_assets/buildings/residential/building_07.glb', name: 'Modern Apartments C' },
    { path: '/3d_assets/buildings/residential/building_brutalist_tricorner.glb', name: 'Brutalist Tri-Corner' },
    { path: '/3d_assets/buildings/residential/chicago_buildings.glb', name: 'Chicago Style Block' },
    { path: '/3d_assets/buildings/residential/city_apartment_building.glb', name: 'City Apartment Building' },
    { path: '/3d_assets/buildings/residential/game_ready_city_building.glb', name: 'Urban Apartment Spire' },
    { path: '/3d_assets/buildings/residential/game_ready_city_buildings.glb', name: 'Urban Apartments Cluster' },
    { path: '/3d_assets/buildings/residential/lowpoly_buildings.glb', name: 'Low-Poly Housing Block' },
    { path: '/3d_assets/buildings/residential/low_poly_residential_buildings.glb', name: 'Low-Poly Residential Set' },
    { path: '/3d_assets/buildings/residential/nyc_bronx_buildings.glb', name: 'Bronx Style Walkups' },
    { path: '/3d_assets/buildings/residential/realistic_chicago_buildings.glb', name: 'Chicago Brick Apartments' },
    { path: '/3d_assets/buildings/residential/star_wars_inspired_low_poly_buildings.glb', name: 'Sci-Fi Residential Blocks' }
  ],
  commercial: [
    { path: '/3d_assets/buildings/commercial/building_-_new_york.glb', name: 'NYC Retail Block' },
    { path: '/3d_assets/buildings/commercial/city_building_2.glb', name: 'Commercial Plaza' },
    { path: '/3d_assets/buildings/commercial/game_ready_building_5.glb', name: 'Modern Department Store' },
    { path: '/3d_assets/buildings/commercial/old_building_1.glb', name: 'Classic Brick Commercial' },
    { path: '/3d_assets/buildings/commercial/downtown_buildings_set_-_low_poly_model.glb', name: 'Downtown Block (Low Poly)' },
    { path: '/3d_assets/buildings/commercial/ghetto_hood_graffiti_detroit_building_1.glb', name: 'Detroit Brick Building' },
    { path: '/3d_assets/buildings/commercial/school_building.glb', name: 'District School Building' }
  ],
  destroyed: [
    { path: '/3d_assets/buildings/destroyed/building_construction.glb', name: 'Under Construction Building' },
    { path: '/3d_assets/buildings/destroyed/destroyed_buildings.glb', name: 'Destroyed Block' },
    { path: '/3d_assets/buildings/destroyed/old_building.glb', name: 'Damaged Old Building' },
    { path: '/3d_assets/buildings/destroyed/old_building__lowpoly.glb', name: 'Damaged Building (Low Poly)' },
    { path: '/3d_assets/buildings/destroyed/post-apocalyptic_buildings.glb', name: 'Post-Apocalyptic Ruins' },
    { path: '/3d_assets/buildings/destroyed/ruin_building.glb', name: 'Ruin Structure' },
    { path: '/3d_assets/buildings/destroyed/textured_building_with_interior.glb', name: 'Damaged Interior Building' },
    { path: '/3d_assets/buildings/destroyed/urban_building.glb', name: 'Urban Ruin' }
  ],
  industrial: [
    { path: '/3d_assets/buildings/industrial/industrial_building.glb', name: 'Manufacturing Plant' },
    { path: '/3d_assets/buildings/industrial/warehouse_building.glb', name: 'Logistics Warehouse' },
    { path: '/3d_assets/buildings/industrial/warehouse_building_1.glb', name: 'Distribution Center' },
    { path: '/3d_assets/buildings/industrial/abandoned_building.glb', name: 'Derelict Factory' },
    { path: '/3d_assets/buildings/industrial/building_4.glb', name: 'Industrial Facility B' },
    { path: '/3d_assets/buildings/industrial/checkpoint_building.glb', name: 'Security Checkpoint' },
    { path: '/3d_assets/buildings/industrial/daotown_building_kit.glb', name: 'Industrial Complex Kit' },
    { path: '/3d_assets/buildings/industrial/derelict_building.glb', name: 'Derelict Warehouse' },
    { path: '/3d_assets/buildings/industrial/urban_building_1.glb', name: 'Industrial Substation' }
  ],
  office: [
    { path: '/3d_assets/buildings/office/office_building.glb', name: 'Corporate Office' },
    { path: '/3d_assets/buildings/office/building_05.glb', name: 'Financial Center A' },
    { path: '/3d_assets/buildings/office/whitehall_building.glb', name: 'Whitehall Plaza' },
    { path: '/3d_assets/buildings/office/city_building.glb', name: 'Glass Tower' },
    { path: '/3d_assets/buildings/office/building_test.glb', name: 'Prototype Office Tower' },
    { path: '/3d_assets/buildings/office/new_york_buildings.glb', name: 'Manhattan Block Set' },
    { path: '/3d_assets/buildings/office/new_york_buildings_backup.glb', name: 'Manhattan Block Set (Alt)' }
  ],
  landmark: [
    { path: '/3d_assets/buildings/landmark/tu_ducs_tomb_-_stele_building_cyark_dataset.glb', name: 'Tu Duc Tomb Complex' },
    { path: '/3d_assets/buildings/landmark/sci-fi_building.glb', name: 'Command & Control Spire' },
    { path: '/3d_assets/buildings/landmark/sci-fi_building_2.glb', name: 'Command Spire B' },
    { path: '/3d_assets/buildings/landmark/the_view_building.glb', name: 'Sky-deck Megastructure' },
    { path: '/3d_assets/buildings/landmark/buildings_for_3d_printing.glb', name: 'Custom Landmark Spire' },
    { path: '/3d_assets/buildings/landmark/building_5.glb', name: 'Modern Landmark Tower' },
    { path: '/3d_assets/buildings/landmark/old_building_2.glb', name: 'Historic Town Hall' }
  ],
  communication_tower: [
    { path: '/3d_assets/communication_tower/signal_tower.glb', name: 'Signal Antenna Tower' },
    { path: '/3d_assets/communication_tower/40_meter_radiotower.glb', name: '40m Communications Mast' },
    { path: '/3d_assets/communication_tower/prefabbed_radio_tower_with_blankout_signs.glb', name: 'Strategic Comms Array' },
    { path: '/3d_assets/communication_tower/communication_tower.glb', name: 'Standard Communication Tower' },
    { path: '/3d_assets/communication_tower/communication_tower_5ft.glb', name: 'Tactical Comms Mast' }
  ],
  radar_station: [
    { path: '/3d_assets/radar_station/devils_slide_bunker_-_pacifica_ca.glb', name: 'Devils Slide Bunker' },
    { path: '/3d_assets/radar_station/aerial_scan_radar_station_camp_hero_montauk_ny.glb', name: 'Camp Hero Radar Station' }
  ],
  bridge: [
    { path: '/3d_assets/bridge/stone_bridge.glb', name: 'Stone Arch Bridge' },
    { path: '/3d_assets/bridge/wooden_bridge.glb', name: 'Trestle Wooden Bridge' },
    { path: '/3d_assets/bridge/lowpoly_manhattan_bridge.glb', name: 'Manhattan Suspension Bridge' },
    { path: '/3d_assets/bridge/be33d9644e104769b5508ef14093c168.glb', name: 'Modern Highway Bridge' },
    { path: '/3d_assets/bridge/bridge.glb', name: 'Basic Bridge' },
    { path: '/3d_assets/bridge/bridge_1.glb', name: 'Steel Truss Bridge' },
    { path: '/3d_assets/bridge/bridge_2.glb', name: 'Arch Bridge A' },
    { path: '/3d_assets/bridge/bridge_3.glb', name: 'Concrete Highway Bridge' },
    { path: '/3d_assets/bridge/bridge_4.glb', name: 'Suspension Span' },
    { path: '/3d_assets/bridge/bridge_5.glb', name: 'Overpass Segment' },
    { path: '/3d_assets/bridge/bridge_winter.glb', name: 'Winter Bridge' },
    { path: '/3d_assets/bridge/broken_bridge.glb', name: 'Broken Bridge' },
    { path: '/3d_assets/bridge/dreamy_bridge.glb', name: 'Dreamy Pedestrian Bridge' },
    { path: '/3d_assets/bridge/helix_bridge.glb', name: 'Helix Pedestrian Bridge' },
    { path: '/3d_assets/bridge/martha_mcclean_bridge.glb', name: 'Martha McClean Bridge' },
    { path: '/3d_assets/bridge/nyc_the_high_bridge.glb', name: 'NYC High Bridge' },
    { path: '/3d_assets/bridge/old_bridge.glb', name: 'Rustic Old Bridge' },
    { path: '/3d_assets/bridge/scandinavian_bridge.glb', name: 'Scandinavian Design Bridge' },
    { path: '/3d_assets/bridge/science_fiction_tramtrain_bridge..glb', name: 'Sci-Fi Tram Bridge' },
    { path: '/3d_assets/bridge/yberpunk_bridge.glb', name: 'Cyberpunk Bridge' }
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
  '/3d_assets/buildings/residential/100_lowpoly_buildings__buildings_pack.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/bayard_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/buildings_1.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/buildings_2.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/building_01.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/building_02.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/building_06.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/building_07.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/building_brutalist_tricorner.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/chicago_buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/city_apartment_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/game_ready_city_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/game_ready_city_buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/lowpoly_buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/low_poly_residential_buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/nyc_bronx_buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/realistic_chicago_buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/residential/star_wars_inspired_low_poly_buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Commercial
  '/3d_assets/buildings/commercial/building_-_new_york.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/commercial/city_building_2.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/commercial/game_ready_building_5.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/commercial/old_building_1.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/commercial/downtown_buildings_set_-_low_poly_model.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/commercial/ghetto_hood_graffiti_detroit_building_1.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/commercial/school_building.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Destroyed
  '/3d_assets/buildings/destroyed/building_construction.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/destroyed/destroyed_buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/destroyed/old_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/destroyed/old_building__lowpoly.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/destroyed/post-apocalyptic_buildings.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/destroyed/ruin_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/destroyed/textured_building_with_interior.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/destroyed/urban_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Industrial
  '/3d_assets/buildings/industrial/industrial_building.glb': { scaleX: 0.06, scaleY: 0.06, scaleZ: 0.06, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/warehouse_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/warehouse_building_1.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/abandoned_building.glb': { scaleX: 0.06, scaleY: 0.06, scaleZ: 0.06, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/building_4.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/checkpoint_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/daotown_building_kit.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/derelict_building.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/industrial/urban_building_1.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Office
  '/3d_assets/buildings/office/office_building.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/office/building_05.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/office/whitehall_building.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/office/city_building.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/office/building_test.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/office/new_york_buildings.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/office/new_york_buildings_backup.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Landmark
  '/3d_assets/buildings/landmark/tu_ducs_tomb_-_stele_building_cyark_dataset.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/landmark/sci-fi_building.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/landmark/sci-fi_building_2.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/landmark/the_view_building.glb': { scaleX: 0.03, scaleY: 0.03, scaleZ: 0.03, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/landmark/buildings_for_3d_printing.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/landmark/building_5.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/buildings/landmark/old_building_2.glb': { scaleX: 0.04, scaleY: 0.04, scaleZ: 0.04, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Comms / Radar
  '/3d_assets/communication_tower/signal_tower.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/communication_tower/40_meter_radiotower.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/communication_tower/prefabbed_radio_tower_with_blankout_signs.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/communication_tower/communication_tower.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/communication_tower/communication_tower_5ft.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/radar_station/devils_slide_bunker_-_pacifica_ca.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/radar_station/aerial_scan_radar_station_camp_hero_montauk_ny.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },

  // Bridge
  '/3d_assets/bridge/stone_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/wooden_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/lowpoly_manhattan_bridge.glb': { scaleX: 0.05, scaleY: 0.05, scaleZ: 0.05, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/be33d9644e104769b5508ef14093c168.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/bridge_1.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/bridge_2.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/bridge_3.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/bridge_4.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/bridge_5.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/bridge_winter.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/broken_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/dreamy_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/helix_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/martha_mcclean_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/nyc_the_high_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/old_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/scandinavian_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/science_fiction_tramtrain_bridge..glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
  '/3d_assets/bridge/yberpunk_bridge.glb': { scaleX: 0.08, scaleY: 0.08, scaleZ: 0.08, rotationOffset: 0, positionOffset: [0, 0, 0] },
};

export function getGLBPath(assetKey: string): string {
  if (!assetKey) return '';
  if (assetKey.startsWith('/3d_assets/')) return assetKey;
  if (assetKey.startsWith('3d_assets/')) return `/${assetKey}`;
  const cleanKey = assetKey.startsWith('/') ? assetKey.slice(1) : assetKey;
  return `/3d_assets/${cleanKey}`;
}

export function getSubAssets(scene: any): any[] {
  if (!scene || !scene.children) return [];
  let current = scene;
  
  const getStructuralChildren = (node: any) => {
    if (!node || !node.children) return [];
    return node.children.filter((c: any) => {
      const type = c.type || '';
      return !type.includes('Light') && !type.includes('Camera') && !type.includes('Helper');
    });
  };

  let structural = getStructuralChildren(current);
  while (structural.length === 1 && structural[0].type !== 'Mesh') {
    current = structural[0];
    structural = getStructuralChildren(current);
  }
  
  return structural;
}

