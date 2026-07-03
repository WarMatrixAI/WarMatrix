import sys
import os
import math
import random

# Add root folder to python path so we can import engine modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engine.terrain import get_terrain_properties, TerrainCell
from engine.game_state import BattlefieldState, BattlefieldUnit, BattlefieldObjective
from engine.transition import simulate_spatial_tick, get_unit_template

def test_procedural_terrain():
    print("Running test_procedural_terrain...")
    
    # Test Road Overlay at y = 14.0
    cell_road = get_terrain_properties(5.0, 14.0, "Plains")
    assert cell_road.terrain_type == "road", f"Expected road, got {cell_road.terrain_type}"
    assert cell_road.movement_cost == 0.5, "Expected road movement cost of 0.5"
    assert cell_road.cover_value == 0.0, "Expected road cover value of 0.0"
    
    # Test Plains
    cell_plains = get_terrain_properties(2.0, 2.0, "Plains")
    assert cell_plains.terrain_type == "plains", f"Expected plains, got {cell_plains.terrain_type}"
    assert cell_plains.movement_cost == 1.0
    
    # Test Mountain environment with elevation peaks
    peaks = [{"cx": 20.0, "cy": 10.0, "h": 200.0, "r2": 100.0}]
    cell_mountain = get_terrain_properties(20.0, 10.0, "Mountain", map_peaks=peaks)
    assert cell_mountain.terrain_type == "mountain"
    assert cell_mountain.elevation >= 200.0
    assert cell_mountain.movement_cost == 2.0
    assert cell_mountain.cover_value == 0.4
    
    # Test Forest environment
    cell_forest = get_terrain_properties(1.0, 1.0, "Forest")
    assert cell_forest.terrain_type in ("forest", "plains")
    
    # Test Coastal water boundaries
    cell_coastal_land = get_terrain_properties(3.0, 2.0, "Coastal")
    assert cell_coastal_land.terrain_type == "plains"
    cell_coastal_water = get_terrain_properties(35.0, 2.0, "Coastal")
    assert cell_coastal_water.terrain_type == "water"
    assert cell_coastal_water.movement_cost == 999.0  # blocked
    
    print(" - test_procedural_terrain PASSED!")


def test_continuous_movement():
    print("Running test_continuous_movement...")
    
    # Create friendly Infantry unit at x=1.0, y=1.0
    friendly = BattlefieldUnit(
        id="unit-001",
        faction="FRIENDLY",
        x=1.0,
        y=1.0,
        label="Friendly Infantry",
        assetClass="Infantry",
        hp=100.0,
        alive=True
    )
    
    state = BattlefieldState(
        turn=1,
        width=44,
        height=28,
        weather="Clear",
        units=[friendly],
        objectives=[],
        ended=False
    )
    
    # Commander moves the Infantry unit to x=10.0, y=1.0 (eastward)
    command = {
        "action_type": "MOVE",
        "unit_id": "unit-001",
        "target": {"x": 10.0, "y": 1.0}
    }
    
    updated_state, movements, combat_results, casualties = simulate_spatial_tick(state, command)
    
    # Check that unit has moved
    assert len(movements) == 1, "Expected 1 movement event"
    moved_unit = updated_state.units[0]
    assert moved_unit.x > 1.0, f"Expected unit to move east, but x is {moved_unit.x}"
    assert moved_unit.y == 1.0, f"Expected y to stay 1.0, got {moved_unit.y}"
    
    # Base Infantry mobility is 7.3; on Plains movement cost is 1.0, so speed = 7.3 grid units.
    # The step distance should be exactly 7.3, placing the unit at x = 8.3.
    assert math.isclose(moved_unit.x, 8.3, abs_tol=0.01), f"Expected x close to 8.3, got {moved_unit.x}"
    
    print(" - test_continuous_movement PASSED!")


def test_weather_and_damage_movement_modifiers():
    print("Running test_weather_and_damage_movement_modifiers...")
    
    # 1. Storm speed penalty check
    friendly_storm = BattlefieldUnit(
        id="unit-storm",
        faction="FRIENDLY",
        x=1.0,
        y=1.0,
        label="Friendly Infantry",
        assetClass="Infantry",
        hp=100.0,
        alive=True
    )
    state_storm = BattlefieldState(
        turn=1,
        width=44,
        height=28,
        weather="Storm",
        units=[friendly_storm]
    )
    command = {"action_type": "MOVE", "unit_id": "unit-storm", "target": {"x": 10.0, "y": 1.0}}
    res_storm, _, _, _ = simulate_spatial_tick(state_storm, command)
    # Speed should be base speed (7.3) * storm modifier (0.7) = 5.11 grid units
    assert math.isclose(res_storm.units[0].x, 6.11, abs_tol=0.02), f"Expected x=6.11 under Storm, got {res_storm.units[0].x}"

    # 2. Damaged state speed penalty check
    friendly_damaged = BattlefieldUnit(
        id="unit-damaged",
        faction="FRIENDLY",
        x=1.0,
        y=1.0,
        label="Friendly Infantry",
        assetClass="Infantry",
        hp=40.0,  # HP < 50 triggers Damaged speed penalty
        alive=True
    )
    state_damaged = BattlefieldState(
        turn=1,
        width=44,
        height=28,
        weather="Clear",
        units=[friendly_damaged]
    )
    command = {"action_type": "MOVE", "unit_id": "unit-damaged", "target": {"x": 10.0, "y": 1.0}}
    res_damaged, _, _, _ = simulate_spatial_tick(state_damaged, command)
    # Speed should be base speed (7.3) * damaged modifier (0.7) = 5.11 grid units
    assert math.isclose(res_damaged.units[0].x, 6.11, abs_tol=0.02), f"Expected x=6.11 under Damaged state, got {res_damaged.units[0].x}"

    print(" - test_weather_and_damage_movement_modifiers PASSED!")


def test_probabilistic_combat():
    print("Running test_probabilistic_combat...")
    
    # Place friendly Armor and hostile Recon near each other
    # Armor attack is high, range is 11.0.
    friendly = BattlefieldUnit(
        id="friendly-armor",
        faction="FRIENDLY",
        x=1.0,
        y=1.0,
        label="Friendly Armor",
        assetClass="Armor",
        hp=150.0,
        alive=True
    )
    hostile = BattlefieldUnit(
        id="hostile-recon",
        faction="ENEMY",
        x=4.0,  # 3.0 grid distance, well within vision and range
        y=1.0,
        label="Hostile Recon",
        assetClass="Recon",
        hp=80.0,
        alive=True
    )
    
    state = BattlefieldState(
        turn=1,
        width=44,
        height=28,
        weather="Clear",
        units=[friendly, hostile]
    )
    
    # Force combat via commander manual directive
    command = {
        "action_type": "ATTACK",
        "unit_id": "friendly-armor",
        "target": {"unit_id": "hostile-recon"}
    }
    
    # We execute multiple ticks to evaluate combat hits and damage reduction
    random.seed(42)  # Set seed for deterministic rolls
    
    updated_state, movements, combat_results, casualties = simulate_spatial_tick(state, command)
    
    assert len(combat_results) >= 1, "Expected combat engagements"
    # Combat must result in a HIT or MISS
    cb = combat_results[0]
    assert cb["attacker_id"] == "friendly-armor"
    assert cb["defender_id"] == "hostile-recon"
    
    if cb["outcome"] == "HIT":
        assert cb["damage"] > 0.0, "Expected positive damage on hit"
        target_unit = updated_state.units[1]
        assert target_unit.hp < 80.0, f"Expected enemy HP to decrease, got {target_unit.hp}"
        print(f"   Hit succeeded dealing {cb['damage']} damage.")
    else:
        print("   Shot missed target.")

    print(" - test_probabilistic_combat PASSED!")


def test_objective_capture():
    print("Running test_objective_capture...")
    
    # Place objective at x=22.0, y=20.0
    objective = BattlefieldObjective(
        id="obj-alpha",
        x=22.0,
        y=20.0,
        label="Alpha Sector Base",
        controller="NEUTRAL",
        progress_friendly=0.0,
        progress_enemy=0.0
    )
    
    # Place friendly infantry unit right on top of objective
    friendly = BattlefieldUnit(
        id="friendly-infantry",
        faction="FRIENDLY",
        x=22.0,
        y=20.0,
        label="Friendly Infantry",
        assetClass="Infantry",
        hp=100.0,
        alive=True
    )
    
    state = BattlefieldState(
        turn=1,
        width=44,
        height=28,
        weather="Clear",
        units=[friendly],
        objectives=[objective]
    )
    
    # Hold command so unit captures the objective point
    command = {
        "action_type": "HOLD",
        "unit_id": "friendly-infantry"
    }
    
    updated_state, _, _, _ = simulate_spatial_tick(state, command)
    
    # Check objective capture progression
    obj = updated_state.objectives[0]
    assert obj.progress_friendly > 0.0, f"Expected friendly progress to increase, got {obj.progress_friendly}"
    assert obj.progress_friendly == 15.0, f"Expected progress to be exactly 15.0 with 1 friendly unit, got {obj.progress_friendly}"
    
    print(" - test_objective_capture PASSED!")


if __name__ == "__main__":
    print("==================================================")
    print("  WarMatrix Simulation Backend Unit Tests")
    print("==================================================")
    
    try:
        test_procedural_terrain()
        test_continuous_movement()
        test_weather_and_damage_movement_modifiers()
        test_probabilistic_combat()
        test_objective_capture()
        print("\nALL WARMATRIX BACKEND UT UPGRADES PASSED SUCCESSFULLY!")
        sys.exit(0)
    except AssertionError as e:
        print(f"\nTEST SUITE ASSERTION FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nTEST SUITE ENCOUNTERED UNEXPECTED EXCEPTION: {e}")
        sys.exit(1)
