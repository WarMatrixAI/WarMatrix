import random
from typing import List, Dict, Tuple, Any
from ..models.urban import (
    RoadEdge,
    District,
    BuildingZone,
    StrategicInfrastructure,
    CellMetadata,
    UrbanMapResponse,
)

# ─── 3D Asset Registry Configurations ──────────────────────────────────────────

RESIDENTIAL_ASSETS = [
    "buildings/residential/asia_building.glb",
    "buildings/residential/brutalist_building.glb",
    "buildings/residential/futuristic_building.glb",
    "buildings/residential/building_1.glb",
    "buildings/residential/building_2.glb",
    "buildings/residential/building_3.glb",
    "buildings/residential/building_6.glb",
]

COMMERCIAL_ASSETS = [
    "buildings/commercial/building_-_new_york.glb",
    "buildings/commercial/city_building_2.glb",
    "buildings/commercial/game_ready_building_5.glb",
    "buildings/commercial/old_building_1.glb",
    "buildings/commercial/school_building.glb",
]

INDUSTRIAL_ASSETS = [
    "buildings/industrial/industrial_building.glb",
    "buildings/industrial/warehouse_building.glb",
    "buildings/industrial/warehouse_building_1.glb",
    "buildings/industrial/abandoned_building.glb",
]

OFFICE_ASSETS = [
    "buildings/office/office_building.glb",
    "buildings/office/building_05.glb",
    "buildings/office/whitehall_building.glb",
    "buildings/office/city_building.glb",
]

LANDMARK_ASSETS = [
    "buildings/landmark/tu_ducs_tomb_-_stele_building_cyark_dataset.glb",
    "buildings/landmark/sci-fi_building.glb",
    "buildings/landmark/sci-fi_building_2.glb",
    "buildings/landmark/the_view_building.glb",
]

COMM_TOWER_ASSETS = [
    "communication_tower/signal_tower.glb",
    "communication_tower/40_meter_radiotower.glb",
    "communication_tower/prefabbed_radio_tower_with_blankout_signs.glb",
]

RADAR_ASSETS = [
    "radar_station/aerial_scan_radar_station_camp_hero_montauk_ny.glb",
    "radar_station/devils_slide_bunker_-_pacifica_ca.glb",
]

DESTROYED_ASSETS = [
    "buildings/destroyed/ruin_building.glb",
    "buildings/destroyed/old_building.glb",
    "buildings/destroyed/old_building__lowpoly.glb",
    "buildings/destroyed/urban_building.glb",
]

class UrbanEnvironmentGenerator:
    def __init__(self, seed: int, size: str = "Medium"):
        self.master_seed = seed
        self.size = size
        
        # Grid dimensions based on size (Scaled up as requested)
        if size == "Small":
            self.width, self.height = 32, 20
        elif size == "Large":
            self.width, self.height = 80, 50
        else:  # Medium / default
            self.width, self.height = 54, 36
        self.margin = 0

        # Derive isolated seeds for each layer
        self.boundary_rng = random.Random(self._derive_seed(1))
        self.road_rng = random.Random(self._derive_seed(2))
        self.district_rng = random.Random(self._derive_seed(3))
        self.building_rng = random.Random(self._derive_seed(4))
        self.infra_rng = random.Random(self._derive_seed(5))
        self.asset_rng = random.Random(self._derive_seed(6))

        # Setup city bounding box
        self.city_bounds = {
            "min_x": self.margin,
            "max_x": self.width - 1 - self.margin,
            "min_y": self.margin,
            "max_y": self.height - 1 - self.margin,
        }

    def _derive_seed(self, offset: int) -> int:
        # Stable deterministic seed derivation to bypass Python's non-deterministic hash() seed randomization
        import hashlib
        data = f"{self.master_seed}-{offset}".encode('utf-8')
        return int(hashlib.sha256(data).hexdigest(), 16) & 0xFFFFFFFF

    def generate(self) -> UrbanMapResponse:
        # 1. Generate primary main roads (randomized crossroads / T-junctions)
        primary_roads, cx, cy = self._generate_primary_roads()
        
        # 2. Generate districts by splitting quadrants dynamically and returning secondary roads along splits
        districts, secondary_roads = self._generate_bsp_districts(cx, cy, primary_roads)
        
        # 3. Generate local branch roads (cul-de-sacs) within the districts
        local_roads = self._generate_local_roads(districts)
        
        # 4. Combine all roads and compute intersections
        all_roads = primary_roads + secondary_roads + local_roads
        self._solve_road_connections(all_roads)
        
        # 5. Build road lookup for fast cell queries
        road_cells = self._build_road_cells_lookup(all_roads)

        # 6. Generate buildings (no infrastructure per requirements)
        buildings, infrastructure = self._generate_urban_features(road_cells, districts)

        # 7. Compile cell-by-cell metadata grid
        metadata = self._compile_metadata(road_cells, districts, buildings, infrastructure)

        return UrbanMapResponse(
            seed=self.master_seed,
            size=self.size,
            grid_size=(self.width, self.height),
            city_bounds=self.city_bounds,
            roads=all_roads,
            districts=districts,
            buildings=buildings,
            infrastructure=infrastructure,
            metadata=metadata,
        )

    def _generate_primary_roads(self) -> Tuple[List[RoadEdge], int, int]:
        roads: List[RoadEdge] = []
        min_x = self.city_bounds["min_x"]
        max_x = self.city_bounds["max_x"]
        min_y = self.city_bounds["min_y"]
        max_y = self.city_bounds["max_y"]

        # Center reference point for district sorting / commercial core
        cx = self.road_rng.randint(min_x + 4, max_x - 4)
        cy = self.road_rng.randint(min_y + 3, max_y - 3)

        # Ensure cx and cy are within valid ranges
        cx = max(min_x + 3, min(max_x - 3, cx))
        cy = max(min_y + 3, min(max_y - 3, cy))

        # Select topology randomly:
        # 0: Standard Cross
        # 1: Vertical T-Junction
        # 2: Horizontal T-Junction
        # 3: Single Highway (vertical or horizontal)
        # 4: L-Junction (90-degree bypass)
        # 5: Dual Parallel Highways
        # 6: Arterial Grid
        topology = self.road_rng.randint(0, 6)

        if topology == 0:
            roads.append(RoadEdge(
                id="road-primary-vert",
                type="Primary",
                start=(cx, 0),
                end=(cx, self.height - 1),
                connected_roads=[]
            ))
            roads.append(RoadEdge(
                id="road-primary-horiz",
                type="Primary",
                start=(0, cy),
                end=(self.width - 1, cy),
                connected_roads=[]
            ))
        elif topology == 1:
            roads.append(RoadEdge(
                id="road-primary-vert",
                type="Primary",
                start=(cx, 0),
                end=(cx, self.height - 1),
                connected_roads=[]
            ))
            from_left = self.road_rng.choice([True, False])
            start_x = 0 if from_left else cx
            end_x = cx if from_left else self.width - 1
            roads.append(RoadEdge(
                id="road-primary-horiz",
                type="Primary",
                start=(start_x, cy),
                end=(end_x, cy),
                connected_roads=[]
            ))
        elif topology == 2:
            roads.append(RoadEdge(
                id="road-primary-horiz",
                type="Primary",
                start=(0, cy),
                end=(self.width - 1, cy),
                connected_roads=[]
            ))
            from_top = self.road_rng.choice([True, False])
            start_y = 0 if from_top else cy
            end_y = cy if from_top else self.height - 1
            roads.append(RoadEdge(
                id="road-primary-vert",
                type="Primary",
                start=(cx, start_y),
                end=(cx, end_y),
                connected_roads=[]
            ))
        elif topology == 3:
            is_vert = self.road_rng.choice([True, False])
            if is_vert:
                roads.append(RoadEdge(
                    id="road-primary-vert",
                    type="Primary",
                    start=(cx, 0),
                    end=(cx, self.height - 1),
                    connected_roads=[]
                ))
            else:
                roads.append(RoadEdge(
                    id="road-primary-horiz",
                    type="Primary",
                    start=(0, cy),
                    end=(self.width - 1, cy),
                    connected_roads=[]
                ))
        elif topology == 4:
            from_top = self.road_rng.choice([True, False])
            from_left = self.road_rng.choice([True, False])
            start_y = 0 if from_top else self.height - 1
            start_x = 0 if from_left else self.width - 1
            roads.append(RoadEdge(
                id="road-primary-vert-seg",
                type="Primary",
                start=(cx, start_y),
                end=(cx, cy),
                connected_roads=[]
            ))
            roads.append(RoadEdge(
                id="road-primary-horiz-seg",
                type="Primary",
                start=(cx, cy),
                end=(start_x, cy),
                connected_roads=[]
            ))
        elif topology == 5:
            is_vert = self.road_rng.choice([True, False])
            if is_vert:
                spacing = self.road_rng.randint(8, 16)
                cx1 = max(min_x + 2, cx - spacing // 2)
                cx2 = min(max_x - 2, cx1 + spacing)
                roads.append(RoadEdge(
                    id="road-primary-vert-1",
                    type="Primary",
                    start=(cx1, 0),
                    end=(cx1, self.height - 1),
                    connected_roads=[]
                ))
                roads.append(RoadEdge(
                    id="road-primary-vert-2",
                    type="Primary",
                    start=(cx2, 0),
                    end=(cx2, self.height - 1),
                    connected_roads=[]
                ))
                cx = (cx1 + cx2) // 2
            else:
                spacing = self.road_rng.randint(6, 12)
                cy1 = max(min_y + 2, cy - spacing // 2)
                cy2 = min(max_y - 2, cy1 + spacing)
                roads.append(RoadEdge(
                    id="road-primary-horiz-1",
                    type="Primary",
                    start=(0, cy1),
                    end=(self.width - 1, cy1),
                    connected_roads=[]
                ))
                roads.append(RoadEdge(
                    id="road-primary-horiz-2",
                    type="Primary",
                    start=(0, cy2),
                    end=(self.width - 1, cy2),
                    connected_roads=[]
                ))
                cy = (cy1 + cy2) // 2
        else:
            spacing_x = self.road_rng.randint(10, 16)
            spacing_y = self.road_rng.randint(6, 12)
            cx1 = max(min_x + 2, cx - spacing_x // 2)
            cx2 = min(max_x - 2, cx1 + spacing_x)
            cy1 = max(min_y + 2, cy - spacing_y // 2)
            cy2 = min(max_y - 2, cy1 + spacing_y)
            
            roads.append(RoadEdge(
                id="road-primary-vert-1",
                type="Primary",
                start=(cx1, 0),
                end=(cx1, self.height - 1),
                connected_roads=[]
            ))
            roads.append(RoadEdge(
                id="road-primary-vert-2",
                type="Primary",
                start=(cx2, 0),
                end=(cx2, self.height - 1),
                connected_roads=[]
            ))
            roads.append(RoadEdge(
                id="road-primary-horiz-1",
                type="Primary",
                start=(0, cy1),
                end=(self.width - 1, cy1),
                connected_roads=[]
            ))
            roads.append(RoadEdge(
                id="road-primary-horiz-2",
                type="Primary",
                start=(0, cy2),
                end=(self.width - 1, cy2),
                connected_roads=[]
            ))
            cx = (cx1 + cx2) // 2
            cy = (cy1 + cy2) // 2

        return roads, cx, cy

    def _generate_bsp_districts(self, cx: int, cy: int, primary_roads: List[RoadEdge]) -> Tuple[List[District], List[RoadEdge]]:
        min_x = self.city_bounds["min_x"]
        max_x = self.city_bounds["max_x"]
        min_y = self.city_bounds["min_y"]
        max_y = self.city_bounds["max_y"]

        # Determine target regions dynamically based on size and seed
        if self.size == "Small":
            target_regions = self.district_rng.randint(5, 12)
        elif self.size == "Large":
            target_regions = self.district_rng.randint(12, 38)
        else:  # Medium
            target_regions = self.district_rng.randint(8, 22)

        # Collect occupied columns and rows from primary highways to avoid overlapping secondary roads
        primary_xs = set()
        primary_ys = set()
        for r in primary_roads:
            if r.start[0] == r.end[0]:
                primary_xs.add(r.start[0])
            if r.start[1] == r.end[1]:
                primary_ys.add(r.start[1])

        # Start with the entire map bounds to allow dynamic splitting without fixed quadrant gaps
        final_regions = [{"min_x": min_x, "max_x": max_x, "min_y": min_y, "max_y": max_y}]
        secondary_roads = []
        sec_road_counter = 1

        def get_area(q):
            w = q["max_x"] - q["min_x"] + 1
            h = q["max_y"] - q["min_y"] + 1
            return w * h

        # Perform BSP splitting until target region count is achieved
        while len(final_regions) < target_regions:
            final_regions.sort(key=get_area, reverse=True)
            target = final_regions[0]
            
            w = target["max_x"] - target["min_x"] + 1
            h = target["max_y"] - target["min_y"] + 1

            if w < 5 and h < 5:
                break

            final_regions.pop(0)

            # Choose split direction
            if w > h * 1.2:
                split_vertical = True
            elif h > w * 1.2:
                split_vertical = False
            else:
                split_vertical = self.district_rng.choice([True, False])

            # Try vertical split
            if split_vertical and w >= 5:
                possible_xs = [x for x in range(target["min_x"] + 2, target["max_x"] - 1) if x not in primary_xs]
                if possible_xs:
                    split_x = self.district_rng.choice(possible_xs)
                else:
                    split_x = self.district_rng.randint(target["min_x"] + 2, target["max_x"] - 2)
                secondary_roads.append(RoadEdge(
                    id=f"road-secondary-{sec_road_counter}",
                    type="Secondary",
                    start=(split_x, target["min_y"]),
                    end=(split_x, target["max_y"]),
                    connected_roads=[]
                ))
                sec_road_counter += 1
                final_regions.append({"min_x": target["min_x"], "max_x": split_x - 1, "min_y": target["min_y"], "max_y": target["max_y"]})
                final_regions.append({"min_x": split_x + 1, "max_x": target["max_x"], "min_y": target["min_y"], "max_y": target["max_y"]})
            # Try horizontal split
            elif not split_vertical and h >= 5:
                possible_ys = [y for y in range(target["min_y"] + 2, target["max_y"] - 1) if y not in primary_ys]
                if possible_ys:
                    split_y = self.district_rng.choice(possible_ys)
                else:
                    split_y = self.district_rng.randint(target["min_y"] + 2, target["max_y"] - 2)
                secondary_roads.append(RoadEdge(
                    id=f"road-secondary-{sec_road_counter}",
                    type="Secondary",
                    start=(target["min_x"], split_y),
                    end=(target["max_x"], split_y),
                    connected_roads=[]
                ))
                sec_road_counter += 1
                final_regions.append({"min_x": target["min_x"], "max_x": target["max_x"], "min_y": target["min_y"], "max_y": split_y - 1})
                final_regions.append({"min_x": target["min_x"], "max_x": target["max_x"], "min_y": split_y + 1, "max_y": target["max_y"]})
            else:
                final_regions.append(target)
                break

        # Distance to center crossroads helper
        def dist_to_center(reg):
            rcx = (reg["min_x"] + reg["max_x"]) / 2
            rcy = (reg["min_y"] + reg["max_y"]) / 2
            return ((rcx - cx) ** 2 + (rcy - cy) ** 2) ** 0.5

        # Sort all regions by center distance
        sorted_regions = sorted(final_regions, key=dist_to_center)

        # Adjacency check helper (accounts for 1-cell road gaps)
        def are_adjacent(r1, r2) -> bool:
            share_v = (abs(r1["max_x"] - r2["min_x"]) <= 2 or abs(r2["max_x"] - r1["min_x"]) <= 2)
            overlap_y = not (r1["max_y"] < r2["min_y"] or r2["max_y"] < r1["min_y"])
            if share_v and overlap_y:
                return True
            share_h = (abs(r1["max_y"] - r2["min_y"]) <= 2 or abs(r2["max_y"] - r1["min_y"]) <= 2)
            overlap_x = not (r1["max_x"] < r2["min_x"] or r2["max_x"] < r1["min_x"])
            if share_h and overlap_x:
                return True
            return False

        # District assignments: region_index -> (district_id_prefix, type)
        assignments = {}
        assigned_indices = set()

        categories = [
            ("commercial", "Commercial"),
            ("office", "Government"),
            ("landmark", "Government"),
            ("residential", "Residential"),
            ("industrial", "Industrial"),
            ("military", "Military")
        ]

        N = len(sorted_regions)
        
        # 1. Group adjacent blocks into small districts (size 1 to 3) to form irregular shapes
        groups = []
        assigned_blocks = set()
        
        # Process regions in a randomized order to create organic shapes
        block_order = list(range(N))
        self.district_rng.shuffle(block_order)
        
        for idx in block_order:
            if idx in assigned_blocks:
                continue
                
            current_group = [idx]
            assigned_blocks.add(idx)
            
            # 60% chance to grow the district to merge adjacent blocks
            if self.district_rng.random() < 0.6:
                unassigned_neighbors = []
                for member in current_group:
                    for other in range(N):
                        if other not in assigned_blocks:
                            if are_adjacent(sorted_regions[member], sorted_regions[other]):
                                unassigned_neighbors.append(other)
                
                if unassigned_neighbors:
                    n1 = self.district_rng.choice(unassigned_neighbors)
                    current_group.append(n1)
                    assigned_blocks.add(n1)
                    
                    # 50% chance to grow to size 3
                    if self.district_rng.random() < 0.5:
                        unassigned_neighbors2 = []
                        for member in current_group:
                            for other in range(N):
                                if other not in assigned_blocks:
                                    if are_adjacent(sorted_regions[member], sorted_regions[other]):
                                        unassigned_neighbors2.append(other)
                        if unassigned_neighbors2:
                            n2 = self.district_rng.choice(unassigned_neighbors2)
                            current_group.append(n2)
                            assigned_blocks.add(n2)
                            
            groups.append(current_group)
            
        # 2. Assign categories to groups, ensuring adjacent groups do NOT share the same district type
        assignments = {}
        for group in groups:
            adjacent_types = set()
            for other_group in groups:
                if other_group == group:
                    continue
                # If the other group has already been assigned
                if other_group[0] in assignments:
                    # Check if they are adjacent
                    adjacent = False
                    for b1 in group:
                        for b2 in other_group:
                            if are_adjacent(sorted_regions[b1], sorted_regions[b2]):
                                adjacent = True
                                break
                        if adjacent:
                            break
                    if adjacent:
                        adjacent_types.add(assignments[other_group[0]][1]) # dtype
                        
            # Filter categories to exclude any adjacent district types
            available_cats = [c for c in categories if c[1] not in adjacent_types]
            if not available_cats:
                available_cats = categories # Fallback if all are blocked (rare)
                
            chosen_cat = self.district_rng.choice(available_cats)
            for block_idx in group:
                assignments[block_idx] = chosen_cat

        # Compile final districts list
        districts = []
        counters = {}

        for idx, reg in enumerate(sorted_regions):
            prefix, dtype = assignments[idx]
            counters[prefix] = counters.get(prefix, 0) + 1
            dist_id = f"district-{prefix}-{counters[prefix]}"
            
            density = 0.60
            if dtype == "Commercial":
                density = 0.85
            elif dtype == "Industrial":
                density = 0.50
            elif dtype == "Military":
                density = 0.45
            elif prefix == "office":
                density = 0.75
            elif prefix == "landmark":
                density = 0.70
            elif dtype == "Outskirts":
                density = 0.0

            districts.append(District(
                id=dist_id,
                type=dtype,
                bounds=reg,
                density=density
            ))

        return districts, secondary_roads

    def _generate_local_roads(self, districts: List[District]) -> List[RoadEdge]:
        local_roads: List[RoadEdge] = []
        local_counter = 1

        for d in districts:
            w = d.bounds["max_x"] - d.bounds["min_x"] + 1
            h = d.bounds["max_y"] - d.bounds["min_y"] + 1
            if w < 4 or h < 4:
                continue

            num_local = self.road_rng.randint(1, 2)
            for _ in range(num_local):
                orientation = self.road_rng.choice(["vert", "horiz"])
                if orientation == "vert":
                    start_x = self.road_rng.randint(d.bounds["min_x"] + 1, d.bounds["max_x"] - 1)
                    from_top = self.road_rng.choice([True, False])
                    start_y = d.bounds["min_y"] - 1 if from_top else d.bounds["max_y"] + 1
                    
                    length = self.road_rng.randint(2, min(4, h - 2))
                    end_y = start_y + length if from_top else start_y - length
                    
                    start_x = max(0, min(self.width - 1, start_x))
                    start_y = max(0, min(self.height - 1, start_y))
                    end_y = max(0, min(self.height - 1, end_y))

                    local_roads.append(RoadEdge(
                        id=f"road-local-{local_counter}",
                        type="Local",
                        start=(start_x, start_y),
                        end=(start_x, end_y),
                        connected_roads=[]
                    ))
                    local_counter += 1
                else:
                    start_y = self.road_rng.randint(d.bounds["min_y"] + 1, d.bounds["max_y"] - 1)
                    from_left = self.road_rng.choice([True, False])
                    start_x = d.bounds["min_x"] - 1 if from_left else d.bounds["max_x"] + 1
                    
                    length = self.road_rng.randint(2, min(4, w - 2))
                    end_x = start_x + length if from_left else start_x - length
                    
                    start_x = max(0, min(self.width - 1, start_x))
                    start_y = max(0, min(self.height - 1, start_y))
                    end_x = max(0, min(self.width - 1, end_x))

                    local_roads.append(RoadEdge(
                        id=f"road-local-{local_counter}",
                        type="Local",
                        start=(start_x, start_y),
                        end=(end_x, start_y),
                        connected_roads=[]
                    ))
                    local_counter += 1

        return local_roads

    def _solve_road_connections(self, roads: List[RoadEdge]):
        for r in roads:
            r.connected_roads = []

        def intersects(r1: RoadEdge, r2: RoadEdge) -> bool:
            if r1.id == r2.id:
                return False
                
            x1_min, x1_max = min(r1.start[0], r1.end[0]), max(r1.start[0], r1.end[0])
            y1_min, y1_max = min(r1.start[1], r1.end[1]), max(r1.start[1], r1.end[1])
            
            x2_min, x2_max = min(r2.start[0], r2.end[0]), max(r2.start[0], r2.end[0])
            y2_min, y2_max = min(r2.start[1], r2.end[1]), max(r2.start[1], r2.end[1])

            if y1_min == y1_max and y2_min == y2_max:  # Both Horizontal
                if y1_min == y2_min:
                    return not (x1_max < x2_min or x2_max < x1_min)
                return False
            if x1_min == x1_max and x2_min == x2_max:  # Both Vertical
                if x1_min == x2_min:
                    return not (y1_max < y2_min or y2_max < y1_min)
                return False
            if y1_min == y1_max:  # r1 Horizontal, r2 Vertical
                return (x2_min >= x1_min and x2_min <= x1_max and
                        y1_min >= y2_min and y1_min <= y2_max)
            else:  # r1 Vertical, r2 Horizontal
                return (x1_min >= x2_min and x1_min <= x2_max and
                        y2_min >= y1_min and y2_min <= y1_max)

        for r1 in roads:
            for r2 in roads:
                if intersects(r1, r2):
                    r1.connected_roads.append(r2.id)

    def _build_road_cells_lookup(self, roads: List[RoadEdge]) -> Dict[Tuple[int, int], str]:
        road_cells: Dict[Tuple[int, int], str] = {}
        for r in roads:
            x0, y0 = r.start
            x1, y1 = r.end
            
            dx = 1 if x1 > x0 else (-1 if x1 < x0 else 0)
            dy = 1 if y1 > y0 else (-1 if y1 < y0 else 0)
            
            x, y = x0, y0
            road_cells[(x, y)] = r.type
            while x != x1 or y != y1:
                x += dx
                y += dy
                road_cells[(x, y)] = r.type
        return road_cells

    def _get_district_at_cell(self, x: int, y: int, districts: List[District]) -> District | None:
        priority_order = [
            "district-military",
            "district-industrial",
            "district-commercial",
            "district-office",
            "district-landmark",
            "district-residential"
        ]
        matched_districts = []
        for d in districts:
            if d.bounds["min_x"] <= x <= d.bounds["max_x"] and d.bounds["min_y"] <= y <= d.bounds["max_y"]:
                matched_districts.append(d)
        
        if not matched_districts:
            return None
            
        for d_id in priority_order:
            for md in matched_districts:
                if md.id.startswith(d_id):
                    return md
        return matched_districts[0]

    def _generate_urban_features(
        self,
        road_cells: Dict[Tuple[int, int], str],
        districts: List[District]
    ) -> Tuple[List[BuildingZone], List[StrategicInfrastructure]]:
        buildings: List[BuildingZone] = []
        infrastructure: List[StrategicInfrastructure] = []
        
        occupied_cells: Dict[Tuple[int, int], str] = {}
        for cell in road_cells:
            occupied_cells[cell] = "Road"

        bldg_index = 1
        for y in range(self.city_bounds["min_y"], self.city_bounds["max_y"] + 1):
            for x in range(self.city_bounds["min_x"], self.city_bounds["max_x"] + 1):
                if (x, y) in occupied_cells:
                    continue

                district = self._get_district_at_cell(x, y, districts)
                if not district:
                    continue

                if self.building_rng.random() < district.density:
                    rot = self.building_rng.choice([0.0, 90.0, 180.0, 270.0])
                    
                    if "residential" in district.id:
                        asset = self.building_rng.choice(RESIDENTIAL_ASSETS)
                        h = self.building_rng.randint(1, 3)
                        cov = 0.45
                        vis = 0.80
                        mov = 2
                    elif "commercial" in district.id:
                        asset = self.building_rng.choice(COMMERCIAL_ASSETS)
                        h = self.building_rng.randint(2, 4)
                        cov = 0.50
                        vis = 0.70
                        mov = 2
                    elif "office" in district.id:
                        asset = self.building_rng.choice(OFFICE_ASSETS)
                        h = self.building_rng.randint(4, 8)
                        cov = 0.55
                        vis = 0.60
                        mov = 3
                    elif "industrial" in district.id:
                        asset = self.building_rng.choice(INDUSTRIAL_ASSETS)
                        h = self.building_rng.randint(1, 2)
                        cov = 0.60
                        vis = 0.70
                        mov = 3
                    elif "landmark" in district.id:
                        asset = self.building_rng.choice(LANDMARK_ASSETS)
                        h = self.building_rng.randint(3, 5)
                        cov = 0.70
                        vis = 0.50
                        mov = 3
                    elif "military" in district.id:
                        asset = self.building_rng.choice(DESTROYED_ASSETS)
                        h = 1
                        cov = 0.70
                        vis = 0.65
                        mov = 4
                    else:
                        asset = self.building_rng.choice(RESIDENTIAL_ASSETS)
                        h = 1
                        cov = 0.40
                        vis = 0.85
                        mov = 2

                    buildings.append(BuildingZone(
                        id=f"bldg-{bldg_index}",
                        district_id=district.id,
                        type=district.type,
                        x=x,
                        y=y,
                        height=h,
                        cover_value=cov,
                        visibility_modifier=vis,
                        movement_penalty=mov,
                        asset_key=asset,
                        rotation=rot
                    ))
                    occupied_cells[(x, y)] = "Building"
                    bldg_index += 1

        return buildings, infrastructure

    def _compile_metadata(
        self,
        road_cells: Dict[Tuple[int, int], str],
        districts: List[District],
        buildings: List[BuildingZone],
        infrastructure: List[StrategicInfrastructure]
    ) -> List[CellMetadata]:
        metadata: List[CellMetadata] = []
        bldg_lookup = {(b.x, b.y): b for b in buildings}

        for y in range(self.height):
            for x in range(self.width):
                is_road = (x, y) in road_cells
                road_type = road_cells.get((x, y))

                district = self._get_district_at_cell(x, y, districts)
                district_type = district.type if district else "Outskirts"

                bldg = bldg_lookup.get((x, y))

                cover = 0.0
                mov_cost = 1
                vis_mod = 1.0
                comm_mod = 1.0

                if is_road:
                    cover = 0.0
                    mov_cost = 1
                    vis_mod = 1.0
                elif bldg:
                    cover = bldg.cover_value
                    mov_cost = 1 + bldg.movement_penalty
                    vis_mod = bldg.visibility_modifier
                elif district_type != "Outskirts":
                    cover = 0.10
                    mov_cost = 1
                    vis_mod = 0.95

                metadata.append(CellMetadata(
                    x=x,
                    y=y,
                    district_type=district_type,
                    is_road=is_road,
                    road_type=road_type,
                    cover_value=cover,
                    movement_cost=mov_cost,
                    visibility_modifier=vis_mod,
                    communication_modifier=comm_mod
                ))

        return metadata
