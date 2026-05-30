from copy import deepcopy
import math
import random
from typing import Union, List, Dict, Any, Tuple, Optional
import numpy as np

from .game_state import GameState, BattlefieldState, BattlefieldUnit, BattlefieldObjective
from .probability import compute_success_probability
from .terrain import get_terrain_properties, TerrainCell


def _clamp_value(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def apply_action(state: GameState, action: str) -> GameState:
    """
    Apply a player action and return updated GameState (backwards compatibility).
    """

    s = deepcopy(state)

    if action == "RECON":
        s.communications = _clamp_value(s.communications + 0.06)
        s.operational_risk = _clamp_value(s.operational_risk - 0.04)

    elif action == "ARTILLERY_STRIKE":
        s.fires = _clamp_value(s.fires + 0.12)
        s.supply = _clamp_value(s.supply - 0.05)
        s.operational_risk = _clamp_value(s.operational_risk + 0.04)

    elif action == "ADVANCE":
        s.force_ratio = _clamp_value(s.force_ratio + 0.06)
        s.morale = _clamp_value(s.morale + 0.04)
        s.operational_risk = _clamp_value(s.operational_risk + 0.03)

    elif action == "DEFEND":
        s.operational_risk = _clamp_value(s.operational_risk - 0.10)
        s.morale = _clamp_value(s.morale + 0.02)
        s.mobility = _clamp_value(s.mobility - 0.02)

    s.success_probability = compute_success_probability(s)

    return s.clamp()


def apply_enemy_action(state: Union[GameState, dict], enemy_action: str) -> GameState:
    """
    Apply enemy action and return updated GameState (backwards compatibility).
    """

    if not isinstance(state, GameState):
        state = GameState(**state)

    s = deepcopy(state)

    if enemy_action == "hold":
        s.supply = _clamp_value(s.supply - 0.01)

    elif enemy_action == "counterattack":
        s.operational_risk = _clamp_value(s.operational_risk + 0.06)
        s.morale = _clamp_value(s.morale - 0.05)
        s.supply = _clamp_value(s.supply - 0.04)

    elif enemy_action == "artillery":
        s.supply = _clamp_value(s.supply - 0.06)
        s.morale = _clamp_value(s.morale - 0.04)
        s.operational_risk = _clamp_value(s.operational_risk + 0.04)

    elif enemy_action == "retreat":
        s.force_ratio = _clamp_value(s.force_ratio + 0.05)
        s.morale = _clamp_value(s.morale + 0.03)

    s.success_probability = compute_success_probability(s)

    return s.clamp()


def state_to_array(state: GameState) -> np.ndarray:
    return np.array(
        [
            state.morale,
            state.supply,
            state.operational_risk,
            state.success_probability,
            state.mobility,
            state.communications,
            state.fires,
            state.force_ratio,
        ],
        dtype=float,
    )


def array_to_state(arr: np.ndarray) -> GameState:
    return GameState(
        morale=float(arr[0]),
        supply=float(arr[1]),
        operational_risk=float(arr[2]),
        success_probability=float(arr[3]),
        mobility=float(arr[4]),
        communications=float(arr[5]),
        fires=float(arr[6]),
        force_ratio=float(arr[7]),
    )


# ─── Authoritative Spatial Simulation Tick Pipeline ──────────────────────────

# Template specs for stateful units
UNIT_TEMPLATES = {
    "Infantry": {
        "max_hp": 100.0,
        "attack": 25.0,
        "defense": 15.0,
        "range": 2.0,
        "mobility": 2.0,
        "detection_range": 3.0,
    },
    "Armor": {
        "max_hp": 150.0,
        "attack": 45.0,
        "defense": 30.0,
        "range": 3.0,
        "mobility": 4.0,
        "detection_range": 4.0,
    },
    "Recon": {
        "max_hp": 80.0,
        "attack": 15.0,
        "defense": 10.0,
        "range": 2.5,
        "mobility": 5.0,
        "detection_range": 6.0,
    },
    "Artillery": {
        "max_hp": 70.0,
        "attack": 50.0,
        "defense": 5.0,
        "range": 7.0,
        "mobility": 1.5,
        "detection_range": 3.0,
    },
    "Logistics": {
        "max_hp": 90.0,
        "attack": 10.0,
        "defense": 10.0,
        "range": 1.5,
        "mobility": 3.0,
        "detection_range": 3.0,
    },
    "Command Unit": {
        "max_hp": 120.0,
        "attack": 20.0,
        "defense": 20.0,
        "range": 2.0,
        "mobility": 3.5,
        "detection_range": 5.0,
    }
}


def get_unit_template(asset_class: str) -> dict:
    for key, val in UNIT_TEMPLATES.items():
        if key.lower() == str(asset_class).lower():
            return val
    return UNIT_TEMPLATES["Infantry"]


def simulate_spatial_tick(
    state: BattlefieldState,
    command: Dict[str, Any],
    map_peaks: Optional[List[Dict[str, Any]]] = None
) -> Tuple[BattlefieldState, List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Evaluates one authoritative wargaming tick (turn progression) on a continuous space.
    Resolves: Movement -> Detection (Line of sight) -> Probabilistic Engagement -> Objective Captures.
    """
    s = deepcopy(state)
    s.turn += 1

    unit_movements = []
    combat_results = []
    casualties = []

    # Map of coordinates target for each unit ID: {unit_id: (tx, ty, action_type, target_entity_id)}
    directives: Dict[str, Tuple[float, float, str, Optional[str]]] = {}

    # 1. Parse Commander Manual Directive
    action_type = command.get("action_type", "HOLD")
    cmd_unit_id = command.get("unit_id")
    target_data = command.get("target", {})
    tx = target_data.get("x")
    ty = target_data.get("y")

    # Find the specific unit and set its instructions
    cmd_unit = next((u for u in s.units if u.id == cmd_unit_id and u.alive), None)
    if cmd_unit:
        # Default destination is current position if not supplied
        dest_x = float(tx) if tx is not None else cmd_unit.x
        dest_y = float(ty) if ty is not None else cmd_unit.y
        tgt_id = target_data.get("unit_id") or target_data.get("objective_id")
        directives[cmd_unit.id] = (dest_x, dest_y, action_type, tgt_id)

    # 2. Automated AI Directives for other units
    for u in s.units:
        if not u.alive or u.id in directives:
            continue

        # Find nearest enemy
        enemies = [e for e in s.units if e.faction != u.faction and e.alive]
        nearest_enemy = None
        min_enemy_dist = float("inf")
        for e in enemies:
            d = math.hypot(e.x - u.x, e.y - u.y)
            if d < min_enemy_dist:
                min_enemy_dist = d
                nearest_enemy = e

        # Find nearest objective
        nearest_objective = None
        min_obj_dist = float("inf")
        for obj in s.objectives:
            d = math.hypot(obj.x - u.x, obj.y - u.y)
            if d < min_obj_dist:
                min_obj_dist = d
                nearest_objective = obj

        if u.faction == "ENEMY":
            # Hostiles try to secure objectives or engage nearby friendlies
            if nearest_enemy and min_enemy_dist <= u.detection_range:
                directives[u.id] = (nearest_enemy.x, nearest_enemy.y, "ATTACK", nearest_enemy.id)
            elif nearest_objective:
                directives[u.id] = (nearest_objective.x, nearest_objective.y, "CAPTURE", nearest_objective.id)
            else:
                directives[u.id] = (u.x, u.y, "HOLD", None)
        else:
            # Automated friendly forces maneuver
            if nearest_enemy and min_enemy_dist <= u.detection_range:
                directives[u.id] = (nearest_enemy.x, nearest_enemy.y, "ATTACK", nearest_enemy.id)
            elif nearest_objective and nearest_objective.controller != "FRIENDLY":
                directives[u.id] = (nearest_objective.x, nearest_objective.y, "CAPTURE", nearest_objective.id)
            else:
                directives[u.id] = (u.x, u.y, "HOLD", None)

    # 3. Resolve Movement Progression
    # Units traverse continuous space according to their velocity, terrain cost, and weather
    for u in s.units:
        if not u.alive or u.id not in directives:
            continue

        dest_x, dest_y, act, _ = directives[u.id]
        if act not in ("MOVE", "ATTACK", "CAPTURE", "RECON"):
            continue

        d = math.hypot(dest_x - u.x, dest_y - u.y)
        if d <= 0.08:
            continue  # Already arrived

        # Retrieve unit mobility specs
        specs = get_unit_template(u.assetClass)
        base_mob = float(specs["mobility"])

        # Fetch terrain modifiers at current location
        t_cell = get_terrain_properties(u.x, u.y, s.weather, map_peaks)
        terrain_cost = float(t_cell.movement_cost)

        # Compute continuous speed
        speed = base_mob / max(0.1, terrain_cost)

        # Apply weather reductions
        w_upper = s.weather.upper()
        if "STORM" in w_upper or "RAIN" in w_upper:
            speed *= 0.7
        elif "SANDSTORM" in w_upper:
            speed *= 0.8

        # Apply Damaged health state penalty (reduction by 30%)
        if u.hp < 50.0:
            speed *= 0.7

        # Continuous tick step size
        step = min(d, speed * 1.0)  # tick duration = 1.0

        old_x, old_y = u.x, u.y
        u.x = max(0.0, min(float(s.width), u.x + (dest_x - u.x) / d * step))
        u.y = max(0.0, min(float(s.height), u.y + (dest_y - u.y) / d * step))

        # Log movement path
        unit_movements.append({
            "unit_id": u.id,
            "from": {"x": round(old_x, 2), "y": round(old_y, 2)},
            "to": {"x": round(u.x, 2), "y": round(u.y, 2)}
        })

    # 4. Resolve Pairwise Line-of-Sight and Combat Engagement
    # Track which targets have been fired upon to avoid multiple engagements in one tick
    engaged_targets = set()

    for u in s.units:
        if not u.alive or u.id not in directives:
            continue

        _, _, act, target_id = directives[u.id]
        if act != "ATTACK":
            continue

        # Find target entity
        target_unit = next((e for e in s.units if e.id == target_id and e.alive), None)
        if not target_unit:
            # Fall back to nearest alive enemy within vision
            enemies = [e for e in s.units if e.faction != u.faction and e.alive]
            nearest_enemy = None
            min_d = float("inf")
            for e in enemies:
                d = math.hypot(e.x - u.x, e.y - u.y)
                if d < min_d:
                    min_d = d
                    nearest_enemy = e
            target_unit = nearest_enemy

        if not target_unit or target_unit.id in engaged_targets:
            continue

        # Determine effective range and detection thresholds
        dist = math.hypot(target_unit.x - u.x, target_unit.y - u.y)

        specs = get_unit_template(u.assetClass)
        base_det = float(specs["detection_range"])
        base_rng = float(specs["range"])

        # Weather visibility degradation
        w_upper = s.weather.upper()
        weather_vis_mod = 1.0
        if "FOG" in w_upper:
            weather_vis_mod = 0.5
        elif "SANDSTORM" in w_upper:
            weather_vis_mod = 0.6
        elif "STORM" in w_upper:
            weather_vis_mod = 0.7

        # Target cover modifier
        t_cell_target = get_terrain_properties(target_unit.x, target_unit.y, s.weather, map_peaks)
        target_cover = float(t_cell_target.cover_value)
        target_vis_mod = float(t_cell_target.visibility_modifier)

        eff_det = base_det * weather_vis_mod * target_vis_mod
        if u.hp < 50.0:
            eff_det *= 0.8

        # 1. Line-of-sight check
        if dist > eff_det:
            continue  # Target not detected in fog of war

        # Get elevation heights for elevation combat bonus
        t_cell_self = get_terrain_properties(u.x, u.y, s.weather, map_peaks)
        elev_self = float(t_cell_self.elevation)
        elev_target = float(t_cell_target.elevation)

        elev_diff = max(0.0, elev_self - elev_target)
        range_bonus = elev_diff / 100.0  # +10% range per 10m height diff

        eff_range = base_rng * (1.0 + range_bonus)

        # 2. Engagement range check
        if dist <= eff_range:
            engaged_targets.add(target_unit.id)

            # Probabilistic combat resolution
            base_acc = 0.75
            accuracy = base_acc * (1.0 - target_cover)

            # Weather accuracy penalties
            if "STORM" in w_upper or "SANDSTORM" in w_upper:
                accuracy *= 0.75
            elif "RAIN" in w_upper or "FOG" in w_upper:
                accuracy *= 0.85

            # Elevation attack bonus
            if elev_diff > 10.0:
                accuracy *= 1.15

            # HP reduction penalty
            if u.hp < 50.0:
                accuracy *= 0.7

            # Defending target gets defensive stance bonus
            target_directive = directives.get(target_unit.id, (0,0,"HOLD",None))
            if target_directive[2] == "DEFEND":
                accuracy *= 0.8

            hit = random.random() < accuracy
            if hit:
                # Calculate damage with standard defense reduction
                base_atk = float(specs["attack"])
                target_specs = get_unit_template(target_unit.assetClass)
                tgt_def = float(target_specs["defense"])

                defense_reduction = min(0.6, tgt_def / 100.0)
                variance = random.uniform(0.85, 1.15)
                damage = base_atk * variance * (1.0 - defense_reduction)
                damage = round(damage, 1)

                target_unit.hp = max(0.0, round(target_unit.hp - damage, 1))

                combat_results.append({
                    "attacker_id": u.id,
                    "defender_id": target_unit.id,
                    "outcome": "HIT",
                    "damage": damage
                })

                if target_unit.hp <= 0.0:
                    target_unit.alive = False
                    target_unit.hp = 0.0
                    casualties.append({
                        "unit_id": target_unit.id,
                        "faction": target_unit.faction
                    })
            else:
                combat_results.append({
                    "attacker_id": u.id,
                    "defender_id": target_unit.id,
                    "outcome": "MISS",
                    "damage": 0.0
                })

    # 5. Resolve Objective Progress Captures
    for obj in s.objectives:
        # Get units within capture range (distance <= 1.0)
        near_units = [u for u in s.units if u.alive and math.hypot(u.x - obj.x, u.y - obj.y) <= 1.2]
        friendly_near = [u for u in near_units if u.faction == "FRIENDLY"]
        enemy_near = [u for u in near_units if u.faction == "ENEMY"]

        friendly_count = len(friendly_near)
        enemy_count = len(enemy_near)

        if friendly_count > 0 and enemy_count == 0:
            obj.progress_friendly = min(100.0, obj.progress_friendly + 15.0 * friendly_count)
            obj.progress_enemy = max(0.0, obj.progress_enemy - 15.0 * friendly_count)
            if obj.progress_friendly >= 100.0:
                obj.controller = "FRIENDLY"

        elif enemy_count > 0 and friendly_count == 0:
            obj.progress_enemy = min(100.0, obj.progress_enemy + 15.0 * enemy_count)
            obj.progress_friendly = max(0.0, obj.progress_friendly - 15.0 * enemy_count)
            if obj.progress_enemy >= 100.0:
                obj.controller = "ENEMY"

    # 6. Evaluate Lifecycle and Outcome Metrics
    alive_friendly = [u for u in s.units if u.faction == "FRIENDLY" and u.alive]
    alive_enemy = [u for u in s.units if u.faction == "ENEMY" and u.alive]

    friendly_count = len(alive_friendly)
    enemy_count = len(alive_enemy)

    friendly_obj = len([o for o in s.objectives if o.controller == "FRIENDLY"])
    enemy_obj = len([o for o in s.objectives if o.controller == "ENEMY"])
    total_obj = len(s.objectives)

    if friendly_count == 0:
        s.ended = True
        s.winner = "ENEMY"
        s.end_reason = "All friendly forces eliminated in action."
    elif enemy_count == 0:
        s.ended = True
        s.winner = "FRIENDLY"
        s.end_reason = "All hostile threat forces successfully neutralized."
    elif total_obj > 0 and friendly_obj == total_obj:
        s.ended = True
        s.winner = "FRIENDLY"
        s.end_reason = "Tactical command has secured all strategic objectives."
    elif total_obj > 0 and enemy_obj == total_obj:
        s.ended = True
        s.winner = "ENEMY"
        s.end_reason = "Enemy force has seized all strategic sectors."
    elif s.turn >= 15:
        s.ended = True
        s.winner = "NEUTRAL"
        s.end_reason = "Operational timeline exceeded. Simulation complete."

    return s, unit_movements, combat_results, casualties