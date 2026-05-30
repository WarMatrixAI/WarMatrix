# pyrefly: ignore [missing-import]
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import json
import requests
import math
import random

from engine.game_state import GameState, BattlefieldState, BattlefieldUnit, BattlefieldObjective, update_state
from engine.transition import apply_action, simulate_spatial_tick, get_unit_template
from engine.monte_carlo import run_monte_carlo
from engine.mcts import run_mcts
from engine.strategy import strategic_override

router = APIRouter()


class SimulationRequest(BaseModel):
    action: str
    state: GameState
    n_sims: int = 400
    steps: int = 6
    mcts_iterations: int = 400
    seed: int | None = None


@router.post("/simulate_turn")
def simulate_turn(payload: SimulationRequest) -> Dict[str, Any]:
    action = payload.action
    state: GameState = payload.state

    # Apply player action to the client-provided state
    updated_state = apply_action(state, action)

    # Run Monte Carlo simulation from the updated client state
    sim = run_monte_carlo(updated_state, n_sims=payload.n_sims, steps=payload.steps, seed=payload.seed)

    # Strategic rule layer may override MCTS
    override = strategic_override(updated_state)
    if override:
        best_action = override
    else:
        best_action = run_mcts(updated_state, iterations=payload.mcts_iterations, seed=payload.seed)

    # Update selected fields with simulation outputs
    # prefer failure_probability and operational risk both returned
    updated_state.success_probability = sim.get("expected_success", updated_state.success_probability)
    # map operational risk if present
    if "expected_risk_operational" in sim:
        updated_state.operational_risk = sim["expected_risk_operational"]
    elif "expected_risk" in sim:
        updated_state.operational_risk = sim["expected_risk"]

    # Optionally persist this updated state on the server
    try:
        update_state(updated_state)
    except Exception:
        pass

    # Round numeric outputs for clarity
    state_dict = updated_state.as_dict()
    for k, v in state_dict.items():
        if isinstance(v, float):
            state_dict[k] = round(v, 3)

    sim_out = {}
    if "expected_success" in sim:
        sim_out["expected_success"] = round(sim["expected_success"], 3)
    if "failure_probability" in sim:
        sim_out["failure_probability"] = round(sim["failure_probability"], 3)
    if "expected_risk_operational" in sim:
        sim_out["expected_risk_operational"] = round(sim["expected_risk_operational"], 3)
    if "uncertainty" in sim:
        sim_out["uncertainty"] = round(sim["uncertainty"], 3)

    return {
        "state": state_dict,
        "simulation": sim_out,
        "recommended_next_action": best_action,
    }


# ─── Authoritative Spatial Wargaming Endpoints ────────────────────────────

_LATEST_PEAKS: List[Dict[str, Any]] = []
_LATEST_TERRAIN: str = "Plains"


class SpatialInitializeRequest(BaseModel):
    scenario: Dict[str, Any]


class SpatialTickRequest(BaseModel):
    command: Dict[str, Any]
    current_state: Dict[str, Any]
    end_simulation: bool = False
    max_new_tokens: int = 320
    temperature: float = 0.35
    top_p: float = 0.9


class GenerateScenarioRequest(BaseModel):
    prompt: str                          # natural-language description of the scenario
    terrain_type: str = "Plains"         # suggested terrain override (AI may override)
    weather: str = "Clear"               # suggested weather override
    max_new_tokens: int = 512
    temperature: float = 0.6
    top_p: float = 0.9


@router.post("/initialize_scenario")
def initialize_scenario(payload: SpatialInitializeRequest) -> Dict[str, Any]:
    """
    Initializes the wargaming battlefield state with continuous units, objectives,
    weather, and procedurally generated terrain parameters.
    """
    global _LATEST_PEAKS, _LATEST_TERRAIN

    scenario = payload.scenario
    _LATEST_PEAKS = scenario.get("mapPeaks", [])
    _LATEST_TERRAIN = scenario.get("terrainType", "Plains")
    weather = scenario.get("weather", "Clear")

    units_data = scenario.get("units", [])
    battlefield_units: List[BattlefieldUnit] = []
    battlefield_objectives: List[BattlefieldObjective] = []

    # Map raw scenario list into actual stateful entities
    for idx, u in enumerate(units_data):
        asset_class = u.get("assetClass", "Infantry")
        role = u.get("allianceRole", "FRIENDLY")
        uid = u.get("id") or f"unit-{idx+1:03d}"

        # Treat objective type roles separately
        if role in ("NEUTRAL", "INFRASTRUCTURE", "OBJECTIVE") or asset_class.lower() == "objective":
            battlefield_objectives.append(BattlefieldObjective(
                id=uid,
                x=float(u.get("x", 1.0)),
                y=float(u.get("y", 1.0)),
                label=u.get("label", "Objective Point"),
                controller=role if role in ("FRIENDLY", "ENEMY") else "NEUTRAL"
            ))
        else:
            specs = get_unit_template(asset_class)
            battlefield_units.append(BattlefieldUnit(
                id=uid,
                faction="FRIENDLY" if "FRIENDLY" in str(role).upper() else "ENEMY",
                x=float(u.get("x", 1.0)),
                y=float(u.get("y", 1.0)),
                label=u.get("label", f"Unit {idx+1}"),
                hp=float(specs["max_hp"]),
                max_hp=float(specs["max_hp"]),
                attack=float(specs["attack"]),
                defense=float(specs["defense"]),
                range=float(specs["range"]),
                mobility=float(specs["mobility"]),
                detection_range=float(specs["detection_range"]),
                assetClass=asset_class,
                allianceRole=role,
                alive=True
            ))

    # Construct and return the initial wargame state
    initial_state = BattlefieldState(
        turn=1,
        width=12,
        height=8,
        weather=weather,
        units=battlefield_units,
        objectives=battlefield_objectives,
        ended=False
    )

    return {
        "updated_battlefield_state": initial_state.dict()
    }


# ─── AI Scenario Generation ───────────────────────────────────────────────────

_SCENARIO_SYSTEM_PROMPT = (
    "You are the WarMatrix Tactical Scenario Designer AI. Given a natural-language scenario description, "
    "you must produce a JSON object describing a complete wargaming battlefield scenario. "
    "The JSON must have exactly these top-level keys:\n"
    "  terrainType   : one of Plains | Mountain | Forest | Desert | Coastal | Urban\n"
    "  weather       : one of Clear | Fog | Storm | Sandstorm | Rain\n"
    "  mapPeaks      : array of {cx, cy, h, r2} elevation peak objects (0-4 items)\n"
    "  units         : array of unit objects, each with keys:\n"
    "                    id (string), label (string), assetClass (Infantry|Armor|Recon|Artillery|Logistics|Command),\n"
    "                    allianceRole (FRIENDLY|ENEMY), x (float 0-11), y (float 0-7)\n"
    "  objectives    : array of objective objects, each with keys:\n"
    "                    id (string), label (string), x (float), y (float), controller (NEUTRAL|FRIENDLY|ENEMY)\n"
    "Output ONLY valid JSON with no markdown fences, no comments, and no extra text."
)


def _procedural_scenario_fallback(
    prompt: str,
    terrain_type: str,
    weather: str,
) -> Dict[str, Any]:
    """
    Deterministic procedural fallback that generates a reasonable scenario
    from simple heuristics when the AI server is offline.
    """
    rng = random.Random(hash(prompt) & 0xFFFF_FFFF)
    n_friendly = rng.randint(2, 4)
    n_enemy = rng.randint(2, 4)
    asset_classes = ["Infantry", "Armor", "Recon", "Artillery", "Logistics", "Command"]

    units = []
    for i in range(n_friendly):
        units.append({
            "id": f"friendly-{i+1:03d}",
            "label": f"Friendly {asset_classes[i % len(asset_classes)]} {i+1}",
            "assetClass": asset_classes[i % len(asset_classes)],
            "allianceRole": "FRIENDLY",
            "x": round(rng.uniform(0.5, 3.5), 1),
            "y": round(rng.uniform(0.5, 6.5), 1),
        })
    for i in range(n_enemy):
        units.append({
            "id": f"enemy-{i+1:03d}",
            "label": f"Enemy {asset_classes[i % len(asset_classes)]} {i+1}",
            "assetClass": asset_classes[i % len(asset_classes)],
            "allianceRole": "ENEMY",
            "x": round(rng.uniform(8.0, 11.5), 1),
            "y": round(rng.uniform(0.5, 6.5), 1),
        })

    objectives = [
        {"id": "obj-alpha", "label": "Alpha Sector", "x": 6.0, "y": 2.0, "controller": "NEUTRAL"},
        {"id": "obj-bravo", "label": "Bravo Sector", "x": 6.0, "y": 5.5, "controller": "NEUTRAL"},
    ]

    peaks = []
    if terrain_type == "Mountain":
        peaks = [
            {"cx": rng.uniform(3, 9), "cy": rng.uniform(2, 6), "h": rng.uniform(150, 300), "r2": rng.uniform(4, 12)}
            for _ in range(rng.randint(1, 3))
        ]

    return {
        "terrainType": terrain_type,
        "weather": weather,
        "mapPeaks": peaks,
        "units": units,
        "objectives": objectives,
    }


def _build_battlefield_from_scenario(scenario: Dict[str, Any]) -> BattlefieldState:
    """Convert a raw scenario dict (from AI or procedural fallback) into a BattlefieldState."""
    terrain_type = scenario.get("terrainType", "Plains")
    weather = scenario.get("weather", "Clear")
    peaks = scenario.get("mapPeaks", [])

    units_data = scenario.get("units", [])
    objectives_data = scenario.get("objectives", [])

    battlefield_units: List[BattlefieldUnit] = []
    for idx, u in enumerate(units_data):
        asset_class = u.get("assetClass", "Infantry")
        role = u.get("allianceRole", "FRIENDLY")
        uid = u.get("id") or f"unit-{idx+1:03d}"
        specs = get_unit_template(asset_class)
        battlefield_units.append(BattlefieldUnit(
            id=uid,
            faction="FRIENDLY" if "FRIENDLY" in str(role).upper() else "ENEMY",
            x=float(u.get("x", 1.0)),
            y=float(u.get("y", 1.0)),
            label=u.get("label", f"Unit {idx+1}"),
            assetClass=asset_class,
            allianceRole=role,
            hp=float(specs["max_hp"]),
            max_hp=float(specs["max_hp"]),
            attack=float(specs["attack"]),
            defense=float(specs["defense"]),
            range=float(specs["range"]),
            mobility=float(specs["mobility"]),
            detection_range=float(specs["detection_range"]),
            alive=True,
        ))

    battlefield_objectives: List[BattlefieldObjective] = []
    for o in objectives_data:
        battlefield_objectives.append(BattlefieldObjective(
            id=o.get("id", f"obj-{len(battlefield_objectives)+1}"),
            x=float(o.get("x", 6.0)),
            y=float(o.get("y", 4.0)),
            label=o.get("label", "Objective"),
            controller=o.get("controller", "NEUTRAL"),
        ))

    return BattlefieldState(
        turn=1,
        width=12,
        height=8,
        weather=weather,
        units=battlefield_units,
        objectives=battlefield_objectives,
        ended=False,
    ), terrain_type, peaks


@router.post("/generate_scenario")
def generate_scenario(payload: GenerateScenarioRequest) -> Dict[str, Any]:
    """
    AI-powered scenario generation endpoint.
    Accepts a natural-language prompt and returns a fully initialised BattlefieldState.

    The AI server is queried first; if it is offline or returns invalid JSON,
    a deterministic procedural fallback generator is used instead.
    """
    global _LATEST_PEAKS, _LATEST_TERRAIN

    scenario_dict: Optional[Dict[str, Any]] = None
    source = "procedural_fallback"

    # ── 1. Attempt AI-generated scenario ────────────────────────────────────
    try:
        ai_payload = {
            "instruction": _SCENARIO_SYSTEM_PROMPT,
            "battlefield_data": (
                f"Scenario request: {payload.prompt}\n"
                f"Suggested terrain: {payload.terrain_type}\n"
                f"Suggested weather: {payload.weather}\n"
                "Output ONLY the JSON object. Do not include any extra text, markdown, or explanation."
            ),
            "max_new_tokens": payload.max_new_tokens,
            "temperature": payload.temperature,
            "top_p": payload.top_p,
        }
        res = requests.post(
            "http://127.0.0.1:8000/api/sitrep",
            json=ai_payload,
            timeout=90.0,
        )
        if res.status_code == 200:
            data = res.json()
            raw_text: str = data.get("response", "")

            # Strip any accidental markdown fences the model may emit
            if "```" in raw_text:
                raw_text = raw_text.split("```")[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]

            candidate = json.loads(raw_text.strip())
            # Validate minimal required keys
            if "units" in candidate and isinstance(candidate["units"], list):
                scenario_dict = candidate
                source = data.get("source", "local_model")  # 'local_model' or 'lm_studio'
    except Exception:
        pass  # Fall through to procedural generation

    # ── 2. Procedural fallback ───────────────────────────────────────────────
    if scenario_dict is None:
        scenario_dict = _procedural_scenario_fallback(
            prompt=payload.prompt,
            terrain_type=payload.terrain_type,
            weather=payload.weather,
        )

    # ── 3. Build BattlefieldState ────────────────────────────────────────────
    initial_state, terrain_type, peaks = _build_battlefield_from_scenario(scenario_dict)
    _LATEST_TERRAIN = terrain_type
    _LATEST_PEAKS = peaks

    return {
        "updated_battlefield_state": initial_state.dict(),
        "scenario_definition": scenario_dict,
        "generation_source": source,
        "prompt": payload.prompt,
    }


@router.post("/simulate_tick")
def simulate_tick(payload: SpatialTickRequest) -> Dict[str, Any]:
    """
    Authoritative turn simulation endpoint. Executes tick movement, line-of-sight checks,
    combat resolution, and calls wargaming LLM for narrative synthesis reports.
    """
    global _LATEST_PEAKS, _LATEST_TERRAIN

    command = payload.command
    state_dict = payload.current_state

    # Parse and execute wargaming pipeline
    state = BattlefieldState(**state_dict)
    updated_state, movements, combat_results, casualties = simulate_spatial_tick(
        state, command, _LATEST_PEAKS
    )

    # 1. Map to high-level GameState vector for Monte Carlo MCTS risk/success predictions
    friendly_units = [u for u in updated_state.units if u.faction == "FRIENDLY" and u.alive]
    enemy_units = [u for u in updated_state.units if u.faction == "ENEMY" and u.alive]

    total_friendly = max(1, len([u for u in updated_state.units if u.faction == "FRIENDLY"]))
    total_enemy = max(1, len([u for u in updated_state.units if u.faction == "ENEMY"]))

    fr_ratio = len(friendly_units) / max(1, len(friendly_units) + len(enemy_units))
    morale = 0.72 * (len(friendly_units) / total_friendly)
    supply = 0.65 * (len(friendly_units) / total_friendly)
    operational_risk = max(0.0, min(1.0, 0.40 + 0.50 * (1.0 - fr_ratio)))

    vector_state = GameState(
        morale=morale,
        supply=supply,
        operational_risk=operational_risk,
        success_probability=0.55,
        mobility=0.70,
        communications=0.82,
        fires=0.75,
        force_ratio=fr_ratio
    )

    # Run Monte Carlo Rollout and MCTS using vector mechanics
    sim = run_monte_carlo(vector_state, n_sims=100, steps=4)
    override = strategic_override(vector_state)
    recommended_action = override if override else run_mcts(vector_state, iterations=100)

    expected_success = sim.get("expected_success", 0.55)
    expected_risk = sim.get("expected_risk_operational", operational_risk)

    # 2. Immersive Military Narrative Synthesis (Procedural fall-back + LLM call)
    narrative_summary = build_procedural_briefing(updated_state, movements, combat_results, casualties)

    # Attempt to synthesis briefing via fine-tuned Local AI Server
    try:
        ai_payload = {
            "instruction": "Summarize the events of this simulation tick in a professional, high-fidelity military wargaming narrative report.",
            "battlefield_data": narrative_summary,
            "max_new_tokens": payload.max_new_tokens,
            "temperature": payload.temperature,
            "top_p": payload.top_p
        }
        res = requests.post("http://127.0.0.1:8000/api/sitrep", json=ai_payload, timeout=6.0)
        if res.status_code == 200:
            data = res.json()
            if data.get("ok") and data.get("response"):
                narrative_summary = data.get("response")
    except Exception:
        pass  # Gracefully fall back to premium procedural narrative summary

    return {
        "updated_battlefield_state": updated_state.dict(),
        "unit_movements": movements,
        "combat_results": combat_results,
        "casualties": casualties,
        "simulation_results": {
            "expected_success": round(expected_success, 3),
            "expected_risk_operational": round(expected_risk, 3),
            "recommended_next_action": recommended_action or "HOLD"
        },
        "ai_narrative_output": narrative_summary,
        "terminated": updated_state.ended,
        "termination_reason": updated_state.end_reason
    }


def build_procedural_briefing(
    state: BattlefieldState,
    movements: List[Dict[str, Any]],
    combat_results: List[Dict[str, Any]],
    casualties: List[Dict[str, Any]]
) -> str:
    """
    Creates a premium, rich military tactical situation summary based on wargame events.
    """
    lines = []
    lines.append(f"=== SITUATION UPLINK: TURN {state.turn} ===")
    lines.append(f"Operational Environment: {state.weather} weather conditions.")

    # 1. Movements
    if movements:
        lines.append("\n[MOVEMENT VECTOR PROGRESSION]")
        for mv in movements:
            unit = next((u for u in state.units if u.id == mv["unit_id"]), None)
            label = unit.label if unit else mv["unit_id"]
            lines.append(f" - {label} maneuvered from [{mv['from']['x']}, {mv['from']['y']}] to [{mv['to']['x']}, {mv['to']['y']}].")
    else:
        lines.append("\n - No significant troop movement maneuvers detected.")

    # 2. Combat Resolution
    if combat_results:
        lines.append("\n[TACTICAL ENGAGEMENTS RESOLVED]")
        for cb in combat_results:
            attacker = next((u for u in state.units if u.id == cb["attacker_id"]), None)
            defender = next((u for u in state.units if u.id == cb["defender_id"]), None)
            atk_lbl = attacker.label if attacker else cb["attacker_id"]
            def_lbl = defender.label if defender else cb["defender_id"]

            if cb["outcome"] == "HIT":
                lines.append(f" - {atk_lbl} fired upon {def_lbl}: DIRECT HIT deals {cb['damage']} damage (Remaining HP: {defender.hp if defender else 0}).")
            else:
                lines.append(f" - {atk_lbl} engaged {def_lbl}: Round missed target due to cover/evasion.")
    else:
        lines.append("\n - No combat fire exchanges occurred in this sector.")

    # 3. Casualties
    if casualties:
        lines.append("\n[CASUALTY & ASSET DEGRADATION REPORT]")
        for c in casualties:
            unit = next((u for u in state.units if u.id == c["unit_id"]), None)
            lbl = unit.label if unit else c["unit_id"]
            lines.append(f" - WARNING: {lbl} ({c['faction']}) has been DESTROYED in action.")

    # 4. Objectives
    lines.append("\n[OBJECTIVES STATUS SECURED]")
    for obj in state.objectives:
        lines.append(f" - Objective '{obj.label}' is currently under control of {obj.controller} (Friendly progress: {obj.progress_friendly}%, Hostile progress: {obj.progress_enemy}%).")

    if state.ended:
        lines.append(f"\n[OPERATION TERMINATED] Result: {state.winner} Victory. Reason: {state.end_reason}")

    return "\n".join(lines)
