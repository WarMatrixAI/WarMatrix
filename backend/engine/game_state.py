from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


class GameState(BaseModel):
    morale: float = Field(0.5, ge=0.0, le=1.0)
    supply: float = Field(0.5, ge=0.0, le=1.0)
    operational_risk: float = Field(0.5, ge=0.0, le=1.0)
    success_probability: float = Field(0.5, ge=0.0, le=1.0)
    mobility: float = Field(0.5, ge=0.0, le=1.0)
    communications: float = Field(0.5, ge=0.0, le=1.0)
    fires: float = Field(0.5, ge=0.0, le=1.0)
    force_ratio: float = Field(0.5, ge=0.0, le=1.0)

    @validator("morale", "supply", "operational_risk", "success_probability", "mobility", "communications", "fires", "force_ratio", pre=True)
    def _ensure_clamped(cls, v):
        return _clamp(v)

    def clamp(self) -> "GameState":
        return GameState(
            morale=_clamp(self.morale),
            supply=_clamp(self.supply),
            operational_risk=_clamp(self.operational_risk),
            success_probability=_clamp(self.success_probability),
            mobility=_clamp(self.mobility),
            communications=_clamp(self.communications),
            fires=_clamp(self.fires),
            force_ratio=_clamp(self.force_ratio),
        )

    def as_dict(self) -> Dict:
        return self.dict()


# Simple module-level stored state for convenience (can be replaced by DB)
_CURRENT_STATE = GameState(
    morale=0.72,
    supply=0.65,
    operational_risk=0.40,
    success_probability=0.55,
    mobility=0.70,
    communications=0.82,
    fires=0.75,
    force_ratio=0.65,
)


def get_state() -> GameState:
    return _CURRENT_STATE.copy()


def update_state(new_state: GameState) -> None:
    global _CURRENT_STATE
    if isinstance(new_state, dict):
        _CURRENT_STATE = GameState(**new_state)
    elif isinstance(new_state, GameState):
        _CURRENT_STATE = new_state
    else:
        _CURRENT_STATE = GameState(**dict(new_state))


# ─── Authoritative Spatial Wargaming Models ───────────────────────────────

class BattlefieldUnit(BaseModel):
    id: str
    faction: str  # 'FRIENDLY' or 'ENEMY'
    x: float
    y: float
    label: str
    hp: float = 100.0
    max_hp: float = 100.0
    attack: float = 25.0
    defense: float = 15.0
    range: float = 2.0
    mobility: float = 2.0
    alive: bool = True
    assetClass: Optional[str] = "Infantry"
    allianceRole: Optional[str] = None
    detection_range: float = 3.0


class BattlefieldObjective(BaseModel):
    id: str
    x: float
    y: float
    label: str
    controller: str = "NEUTRAL"  # 'FRIENDLY' | 'ENEMY' | 'NEUTRAL'
    progress_friendly: float = 0.0
    progress_enemy: float = 0.0


class BattlefieldState(BaseModel):
    turn: int = 1
    width: int = 12
    height: int = 8
    weather: str = "Clear"
    units: List[BattlefieldUnit] = []
    objectives: List[BattlefieldObjective] = []
    ended: bool = False
    winner: Optional[str] = None
    end_reason: Optional[str] = None