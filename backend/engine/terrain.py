import math
from typing import List, Dict, Any, Optional

class TerrainCell:
    def __init__(
        self,
        terrain_type: str,
        elevation: float,
        movement_cost: float,
        cover_value: float,
        visibility_modifier: float
    ):
        self.terrain_type = terrain_type
        self.elevation = elevation
        self.movement_cost = movement_cost
        self.cover_value = cover_value
        self.visibility_modifier = visibility_modifier

    def as_dict(self) -> Dict[str, Any]:
        return {
            "terrain_type": self.terrain_type,
            "elevation": self.elevation,
            "movement_cost": self.movement_cost,
            "cover_value": self.cover_value,
            "visibility_modifier": self.visibility_modifier
        }


def get_terrain_properties(
    x: float,
    y: float,
    global_terrain: str = "Plains",
    map_peaks: Optional[List[Dict[str, Any]]] = None
) -> TerrainCell:
    """
    Procedurally determine the terrain characteristics at a continuous coordinate (x, y)
    within the 12x8 tactical map space.
    """
    # 1. Road Overlay: Check if coordinate lies on the rapid transit supply corridor (y is near 4.0)
    # Allows rapid movement, offers zero cover.
    if 3.5 <= y <= 4.5:
        return TerrainCell(
            terrain_type="road",
            elevation=0.0,
            movement_cost=0.5,       # Fast traversal (0.5x base mobility cost)
            cover_value=0.0,         # Exposed
            visibility_modifier=1.0  # Perfectly visible
        )

    # 2. Derive Base Elevation using procedural map peaks if provided
    # Standard formula: sum(h * exp(-d^2 / (2 * r^2)))
    elevation = 0.0
    if map_peaks:
        for peak in map_peaks:
            cx = float(peak.get("cx", 0))
            cy = float(peak.get("cy", 0))
            h = float(peak.get("h", 0))
            r2 = float(peak.get("r2", 4.0))
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            # map peaks CX/CY may be on the 44x28 scaled coordinates; map back if needed
            # but usually scenario builders output them scaled or unscaled. Let's make it robust:
            # if cx > 12: cx = (cx / 44.0) * 12.0
            # if cy > 8: cy = (cy / 28.0) * 8.0
            if cx > 12.0:
                cx = (cx / 44.0) * 12.0
            if cy > 8.0:
                cy = (cy / 28.0) * 8.0

            elevation += h * math.exp(-d2 / (2.0 * max(0.1, r2)))

    # Clamp coordinates to integer cells for procedural category checks
    cx = int(max(0, min(11, math.floor(x))))
    cy = int(max(0, min(7, math.floor(y))))

    t_upper = global_terrain.upper()

    # 3. Terrain Semantics by Environment Type
    if "URBAN" in t_upper:
        # Alternating dense urban blocks and open spaces
        if (cx + cy) % 2 == 0:
            return TerrainCell(
                terrain_type="urban",
                elevation=elevation + 5.0,  # building structures elevation
                movement_cost=1.5,
                cover_value=0.6,             # High cover
                visibility_modifier=0.5      # Severely limited line of sight
            )
        else:
            return TerrainCell(
                terrain_type="plains",
                elevation=elevation,
                movement_cost=1.0,
                cover_value=0.1,
                visibility_modifier=1.0
            )

    elif "MOUNTAIN" in t_upper or "HIGHLAND" in t_upper:
        # High elevation mountainous areas
        if elevation > 30.0 or (cx + cy * 3) % 4 == 0:
            return TerrainCell(
                terrain_type="mountain",
                elevation=max(elevation, 50.0),
                movement_cost=2.0,           # Traversal penalty
                cover_value=0.4,
                visibility_modifier=0.7
            )
        else:
            return TerrainCell(
                terrain_type="plains",
                elevation=elevation,
                movement_cost=1.0,
                cover_value=0.1,
                visibility_modifier=1.0
            )

    elif "FOREST" in t_upper:
        # Dense forest cover
        if (cx * 3 + cy * 7) % 5 < 3:
            return TerrainCell(
                terrain_type="forest",
                elevation=elevation + 2.0,
                movement_cost=1.3,
                cover_value=0.5,
                visibility_modifier=0.6
            )
        else:
            return TerrainCell(
                terrain_type="plains",
                elevation=elevation,
                movement_cost=1.0,
                cover_value=0.1,
                visibility_modifier=1.0
            )

    elif "DESERT" in t_upper:
        # Sand dunes traversal cost
        return TerrainCell(
            terrain_type="desert",
            elevation=elevation + (math.sin(x) * 2.0), # dunes wave
            movement_cost=1.2,
            cover_value=0.1,
            visibility_modifier=0.9
        )

    elif "COASTAL" in t_upper:
        # Coastal water boundaries
        if cx >= 9:
            return TerrainCell(
                terrain_type="water",
                elevation=-10.0,
                movement_cost=999.0,         # Impassable for land units
                cover_value=0.0,
                visibility_modifier=1.0
            )
        else:
            return TerrainCell(
                terrain_type="plains",
                elevation=elevation,
                movement_cost=1.0,
                cover_value=0.1,
                visibility_modifier=1.0
            )

    # Standard Plains / default
    return TerrainCell(
        terrain_type="plains",
        elevation=elevation,
        movement_cost=1.0,
        cover_value=0.1,
        visibility_modifier=1.0
    )
