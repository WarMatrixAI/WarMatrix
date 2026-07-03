# WarMatrix Tactical Simulation Console

## Project Profile
- **Tech Stack:** Next.js 15 (React 19 App Router), Tailwind CSS (curated HSL tactical theme), Framer Motion, Lucide Icons, Radix UI, Three.js (`React Three Fiber` / `@react-three/drei`), FastAPI (Uvicorn), Python 3.10 - 3.12, PyTorch, CUDA.
- **Architecture:** Co-located client-backend monorepo structure. Next.js app client-side, FastAPI wargaming engine (`backend/`), and a local inference server (`ai_server/`).
- **Target Environments:** Node.js >= 20, Python 3.12, NVIDIA GPU (CUDA enabled), Modern Web Browsers.

## Persona & Role
- Act as a Senior Tactical AI Architect and Systems Engineer.
- Maintain a tone that is highly concise, direct, instructional, and military-grade.
- Prioritize floating-point mathematical precision, strict type safety, memory safety, and robust information-state separation (ground truth vs perceived state) above all else.

## General Instructions
- Always follow existing patterns found in the codebase.
- Do not run terminal command lines containing `cd`. Execute all scripts and commands from the project workspace root directory.
- Preserve existing comments and docstrings when modifying files.
- Resolve active TypeScript compilation errors before finishing tasks. Reference [errors.txt](file:///c:/Users/FIDO/GitHub/WarMatrix/errors.txt) and [compile_errors.txt](file:///c:/Users/FIDO/GitHub/WarMatrix/compile_errors.txt) to verify type safety.
- Keep the continuous coordinate system as floating-point numbers. Never regress coordinates back to discrete integer grids.
- Ensure all API endpoints conform strictly to the specified data models and JSON payload formats.

### Core Data Models (`backend/engine/game_state.py`)
*   **GameState (Vector Layer):**
    ```python
    class GameState(BaseModel):
        morale: float              # Clamped [0.0 - 1.0]
        supply: float              # Clamped [0.0 - 1.0]
        operational_risk: float    # Clamped [0.0 - 1.0]
        success_probability: float # Clamped [0.0 - 1.0]
        mobility: float            # Clamped [0.0 - 1.0]
        communications: float      # Clamped [0.0 - 1.0]
        fires: float               # Clamped [0.0 - 1.0]
        force_ratio: float         # Clamped [0.0 - 1.0]
    ```
*   **BattlefieldUnit (Spatial Layer):**
    ```python
    class BattlefieldUnit(BaseModel):
        id: str
        faction: str               # 'FRIENDLY' | 'ENEMY'
        x: float                   # Map X-coordinate [1.0 - 44.0]
        y: float                   # Map Y-coordinate [1.0 - 28.0]
        label: str
        hp: float = 100.0
        max_hp: float = 100.0
        attack: float = 25.0
        defense: float = 15.0
        range: float = 7.3
        mobility: float = 7.3
        detection_range: float = 11.0
        alive: bool = True
        assetClass: str = "Infantry" # Infantry | Armor | Recon | Artillery | Logistics | Command Unit
        allianceRole: Optional[str] = None
    ```
*   **BattlefieldObjective (Spatial Layer):**
    ```python
    class BattlefieldObjective(BaseModel):
        id: str
        x: float
        y: float
        label: str
        controller: str = "NEUTRAL" # 'FRIENDLY' | 'ENEMY' | 'NEUTRAL'
        progress_friendly: float = 0.0
        progress_enemy: float = 0.0
    ```
*   **BattlefieldState (Spatial Layer):**
    ```python
    class BattlefieldState(BaseModel):
        turn: int = 1
        width: int = 44
        height: int = 28
        weather: str = "Clear"      # Clear | Fog | Storm | Sandstorm | Rain
        units: List[BattlefieldUnit] = []
        objectives: List[BattlefieldObjective] = []
        ended: bool = False
        winner: Optional[str] = None
        end_reason: Optional[str] = None
    ```

### REST API Specifications
*   `POST /backend/api/simulate_turn` - Takes `action` and high-level `GameState` vector. Runs Monte Carlo/MCTS rollouts to return expectation values.
*   `POST /backend/api/initialize_scenario` - Hydrates a scenario definition into spatial `BattlefieldState` units and objectives.
*   `POST /backend/api/generate_scenario` - Translates a natural language prompt into a structured scenario using `ai_server` (falls back to a local procedural generator if offline).
*   `POST /backend/api/simulate_tick` - Simulates spatial movements, LoS checks, engagements, captures, and requests an LLM tactical SITREP.
*   `POST /backend/api/procedural/urban/generate` - Returns a procedurally generated urban map based on a `seed` and `size` parameter.
*   `POST /api/sitrep` (AI Server port 8000) - Accepts wargaming wargaming context instruction and raw tick wargaming text to return SITREP narrative.

### Simulation Engine Tick Sequence (`backend/engine/transition.py`)
1.  **Directives Compilation:** Compiles user and automated enemy logic (seizing objectives or moving to engage nearest friendly unit in vision).
2.  **Movement Resolution:** Calculate speed: `speed = base_mobility / movement_cost`.
    *   *Terrain Cost Modifiers:* `Roads` = 0.5 (exposed), `Forests` = 1.3, `Deserts` = 1.2, `Urban blocks` = 1.5, `Mountains` = 2.0, `Coastal water` = 999.0 (impassable).
    *   *Weather Speed Reductions:* Rain/Storm reduces speed by 30% (`0.7x`); Sandstorm reduces speed by 20% (`0.8x`).
    *   *Health Penalty:* Units with `hp < 50.0` suffer a 30% movement penalty (`0.7x`).
3.  **Detection and Line-of-Sight (LoS):** Unit can detect target if distance is within effective range:
    $$\text{eff\_det} = \text{base\_det} \times \text{weather\_vis\_mod} \times \text{target\_vis\_mod}$$
    *   *Weather Visibility Modifier:* Fog = 0.5, Sandstorm = 0.6, Storm = 0.7.
    *   *HP Penalty:* Units with `hp < 50.0` have detection ranges reduced by 20% (`0.8x`).
4.  **Combat Engagement Resolution:** Combat occurs if target is within effective engagement range:
    $$\text{eff\_range} = \text{base\_range} \times \left(1.0 + \frac{\text{elevation\_self} - \text{elevation\_target}}{100}\right)$$
    *   *Engagement Accuracy:*
        $$\text{accuracy} = \text{base\_accuracy} \times (1.0 - \text{target\_cover}) \times \text{modifiers}$$
        *   Weather penalties: Storm/Sandstorm = 0.75x, Rain/Fog = 0.85x.
        *   Elevation height advantage: Altitude difference > 10m increases accuracy by +15% (`1.15x`).
        *   HP penalty: Attacker `hp < 50.0` reduces accuracy by 30% (`0.7x`).
        *   Defensive stance: Defender executing `DEFEND` directive reduces accuracy by 20% (`0.8x`).
    *   *Damage Resolution:*
        $$\text{damage} = \text{base\_attack} \times \text{variance} \times (1.0 - \text{defense\_reduction})$$
        *   Defense reduction: Clamped defense rating ($min(0.6, \frac{\text{target\_defense}}{100})$).
        *   Damage variance: Random float between `[0.85, 1.15]`.
5.  **Objectives & Lifecycle Ends:** Capture when within distance $\le 4.4$ (progress updates by +15% per unit). Operation terminates if turn reaches 15, all friendly/enemy units are eliminated, or all objectives are secured.

### Simulation Transition & Evolution Roadmap
*   **Current System Overview:** The simulation operates on a grid-based coordinate system ($\approx 30 \times 40$) representing entities as "blips" with fixed health (100 HP). It supports 2D tactical visualization, procedural elevation 3D rendering, basic coordinate-driven movement/combat, and static objective captures.
*   **Limitations of Current Approach:**
    *   *Grid-Based Constraints:* Discrete cells limit range calculations, physics, and terrain scaling.
    *   *Semantic Lack:* Elevation-only mountains do not represent roads, water, urban regions, or cover.
    *   *Abstract Entity Modeling:* Generic HP values hide capabilities, unit roles, and status dynamics.
    *   *Instant Resolution:* Instant state transitions lack intermediate movement, detection, or execution phases.
    *   *Simplistic Objectives:* Static mechanics restrict strategic mission variations.
*   **Transition to Real-World Coordinate System:**
    *   Adopt continuous spatial float coordinates (latitude/longitude abstraction).
    *   Introduce real scale, distance, and direction metrics.
    *   Generate maps from randomized coordinate bounds rather than static grid cells.
*   **Evolution of Map Generation:** Transition from mountainous elevation to a multi-layered world model:
    *   *Terrain Semantics:* Location-aware terrain type, movement cost, cover, elevation, and visibility factors.
    *   *Environment Domains:* Roads, plain fields, forests, deserts, water bodies, and urban grids.
    *   *3D Integration:* Convert the 3D map from a simple render mesh into an authoritative spatial model.
*   **Time-Stepped Simulation Architecture:** Shift from instant command resolution to a tick-based sequence:
    1. Unit state updates $\rightarrow$ 2. Movement progression $\rightarrow$ 3. Detection checks $\rightarrow$ 4. Combat resolution $\rightarrow$ 5. Objective updates.
*   **Advanced Entity Modeling:** Upgrade units to stateful entities with roles (infantry, armor, recon, support) and state-based damage tracking (Active, Damaged, Destroyed).
*   **Detection & Engagement Pipeline:** Probabilistic resolution model enforcing line-of-sight checks, elevation differences, cover modifiers, and weather visibility dampeners.
*   **Environmental & Weather Integration:** Weather conditions (storm, sandstorm, rain, fog) and day/night cycles directly degrading visibility, speed, and combat accuracy.
*   **Dynamic Objective Redesign:** Capture progress replaced by dynamic zone influence, escort, target elimination, and partial mission success scoring.
*   **Multi-Domain Combat Expansion:** Step-by-step introduction of air domains (altitude, large vision), naval surface regions, and underwater sonar grids, starting with land simulation stabilization.
*   **Simulation Lifecycle Evaluation:** Graded operational outcomes (casualty ratios, objective rates, territorial control) replacing binary win/loss parameters.

### Deterministic Seed-Based Procedural World Generation Pipeline
*   **Context & Core Rules:** Replace AI-driven wargaming map generation (non-deterministic, non-scalable, high latency/cost, lack of structured cell values) with a deterministic 32-bit seed-based generator (`0 - 4,294,967,295`). Changing the seed produces a different layout, but generating the same seed always yields identical topology, elevation, water, roads, infrastructures, forces, and initial weather.
*   **Subsystem Pipeline:**
    $$\text{Seed} \rightarrow \text{Terrain Generator} \rightarrow \text{Water Generator} \rightarrow \text{Biome Generator} \rightarrow \text{Infrastructure} \rightarrow \text{Objectives} \rightarrow \text{Force Deployment}$$
*   **Semantic Terrain Layer:** Predefined rule-based algorithms generating elevations, cover values, movement costs, visibility modifiers, and traversability metrics.
*   **Settlements, Infrastructure & Objectives:** Cities, district blocks, road nets, and industrial facilities are procedurally spawned. Strategically relevant assets (military bases, ports, bridges, airfields, radar arrays) are generated naturally, which in turn spawn objectives (e.g. secure bridge, capture airfield).
*   **Force Deployment suitability:**
    *   *Mechanized Forces:* Procedurally deploy near roads, open terrain, and supply lines.
    *   *Infantry Forces:* Spawn in cover (urban blocks, forests, fortifications).
    *   *Naval Forces:* Spawn in open water and deep port lanes.
    *   *Air Assets:* Spawn on airfields and forward bases.
*   **AI Role Re-allocation:** AI does not generate map layouts; it is placed at the top of the stack, taking the structured procedural wargaming output to compile contextual mission briefings, Sitreps, and narrative operational descriptions.

### Advanced Upgrade blueprint
*   **Troop-Based Modeling:** Replace HP with exact troop counts and granular unit compositions (infantry, support, heavy). Attrition degrades capability non-linearly.
*   **Equipment & Resource Modeling:** Track equipment (rifles, machine guns, anti-armor) and resources (ammunition, fuel, food, batteries). Ticks consume resources dynamically based on actions.
*   **State-Dependent Effectiveness:** Calculate combat effectiveness dynamically:
    $$\text{effectiveness} = f(\text{troop\_count}, \text{ammo}, \text{terrain}, \text{morale})$$
*   **Symmetric Fog-of-War & State Separation:**
    *   *Ground Truth State:* Hidden. Exact troop counts, inventory, true coordinates, and stats.
    *   *Observed State:* Filtered estimates (ranges, possible equipment, confidence levels, and stale info) provided to player and AI models alike.
    *   *Dual AI Structure:* Allied AI (controls allied units using observed data and user commands) and Enemy AI (opposing commander planning strategies with observed player data).
*   **Command & Communication Propagation:** Delayed, independent transmission pipeline:
    $$\text{Command Issued} \rightarrow \text{Transmission Delay} \rightarrow \text{Unit Receives} \rightarrow \text{Execution Begins}$$
    Model communication delays dynamically:
    $$\text{delay} = \text{base\_latency} + \text{distance\_factor} + \text{terrain\_penalty}$$
*   **Continuous Simulation Loop:** Tick-based real-time execution. Units execute orders continuously until new commands arrive. AI models continuously evaluate the simulation and issue commands in real-time.

## Coding Style & Standards
- Use 2 spaces for indentation.
- Enforce strict type annotations across TypeScript codebase; never use `any`.
- Enforce strict equality (`===`) across all comparative operations.
- Format mathematical expressions using standard LaTeX delimiters: inline math with `\(...\)` or `$...$`, and display math with `\[...\]` or `$$...$$`.
- Design UIs adhering to the "Glass Cockpit" dark-ops tactical aesthetic (scanlines, CRT HUD, glassmorphism, responsive grids).
- Use custom theme tokens from [tailwind.config.ts](file:///c:/Users/FIDO/GitHub/WarMatrix/tailwind.config.ts) and [globals.css](file:///c:/Users/FIDO/GitHub/WarMatrix/src/app/globals.css). Never use generic primaries.

## Exclusions & Constraints
- Never look at, index, or parse build folders like `.next/`, `node_modules/`, or `.venv/`.
- Do not use third-party libraries for simple utility functions.
- Do not convert continuous spatial coordinates to discrete integers inside wargaming simulation modules.

## Advanced Features & Syntax Extensions
- **Modular Memory Imports:** You can modularize massive configuration files by importing sub-documents using the `@` prefix path notation.
  - Relative import: `@./docs/style-guidance.md`
  - Absolute import: `@/Users/name/global-rules.md`
- **Hierarchical Resolution:** The Gemini CLI handles these files using a specific scoping cascade where deeper folders add or overwrite rules:
  - `~/.gemini/GEMINI.md` (Global default parameters for all projects)
  - `./GEMINI.md` (Project root folder rules)
  - `./src/components/GEMINI.md` (Highly isolated module-level behavior)

## Quick Commands
- To generate an optimized initial file based on your codebase, execute the `/init` command in your root directory.
- To force-refresh the agent's memory layout after making file modifications, run the `/memory reload` or `/memory refresh` command.

---
*Updated by Antigravity AI Engine*
