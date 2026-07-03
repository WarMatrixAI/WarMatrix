# WarMatrix Simulation Architecture Upgrades Blueprint (improvements.md)

This document outlines the detailed architectural blueprints, transition roadmaps, and specifications for upgrades to the **WarMatrix Tactical Simulation Engine**. It replaces previous documents to serve as the single, authoritative reference for wargaming upgrades.

---

## 🗺️ 1. Transition to Real-World Continuous Coordinate System

The legacy grid-based coordinate system ($\approx 30 \times 40$ discrete cells) abstracts away real-world dynamics, restricting range calculations, positioning, and pathfinding. 

### Specifications
*   **Continuous Coordinates:** Transition the wargaming battlefield to a continuous spatial float coordinate system:
    $$x \in [1.0, 44.0], \quad y \in [1.0, 28.0]$$
*   **Scale and Distance:** Introduce Euclidean distance formulas ($d = \sqrt{\Delta x^2 + \Delta y^2}$) for detection ranges, weapon engagement radii, and velocity calculations.
*   **Orientation and Heading:** Units will track orientation angles ($[0.0 - 360.0]$ degrees) to enable flanking bonuses, frontal armor protection, and direction-specific sensor arcs.

---

## 🎲 2. Deterministic Seed-Based Procedural Map Generation

Map generation shifts from expensive, non-deterministic AI prompt outputs to a rule-based deterministic procedural pipeline driven by a **32-bit unsigned seed value**.

### Specifications
*   **Seed System Range:** $0$ to $4,294,967,295$ (unsigned 32-bit integer).
*   **Deterministic Guarantee:** Given the same seed, the generator must produce identical topography, elevation maps, biomes, road networks, infrastructure locations, objectives, force deployments, and weather parameters.
*   **Procedural Pipeline:**
    $$\text{Seed} \rightarrow \text{Terrain Generator} \rightarrow \text{Water Generator} \rightarrow \text{Biome Generator} \rightarrow \text{Infrastructure} \rightarrow \text{Objectives} \rightarrow \text{Force Deployment}$$
*   **Semantic Terrain Layer:** Predefined rule-based algorithms generating elevations, cover values, movement costs, visibility modifiers, and traversability metrics.
    *   *Roads:* Fast traversal (`movement_cost = 0.5`, offers 0 cover, 1.0 visibility).
    *   *Forests:* Traversal penalty (`movement_cost = 1.3`, 0.5 cover, 0.6 visibility).
    *   *Deserts:* Dunes traversal penalty (`movement_cost = 1.2`, 0.1 cover, 0.9 visibility).
    *   *Urban blocks:* Traversal penalty (`movement_cost = 1.5`, 0.6 cover, 0.5 visibility).
    *   *Mountains:* Traversal penalty (`movement_cost = 2.0`, 0.4 cover, 0.7 visibility).
    *   *Coastal water:* Impassable for land units (`movement_cost = 999.0`).
*   **Urban Environment Generation:** Seed-based road layout networks, city blocks, districts (industrial, residential, military zones) with predefined cover values and communication signal interference.
*   **Maritime Environment Generation:** Support for coastlines, rivers, deep-water regions, and lakes to establish land-sea domains (naval operations, amphibious logistics).
*   **Strategic Infrastructure Generation:** Bridges, airfields, port hubs, military bases, radar arrays, observatories, and fuel depots are procedurally mapped based on terrain suitability.
*   **Natural Objective Emergence:** Objectives are generated directly from infrastructure assets (e.g. secure mountain pass, seize radar array, defend fuel depot) instead of arbitrary grid coordinates.
*   **Force Deployment Suitability:**
    *   *Mechanized Forces:* Procedurally deploy near roads, open terrain, and supply lines.
    *   *Infantry Forces:* Spawn in cover (urban blocks, forests, fortifications).
    *   *Naval Forces:* Spawn in open water and deep port lanes.
    *   *Air Assets:* Spawn on airfields and forward bases.

---

## ⏱️ 3. Time-Stepped Continuous Simulation Loop

The wargame transitions from instant turn resolution to a concurrent, continuous tick-based execution model.

### Specifications
*   **5-Step Tick Cycle:** Each simulation tick executes:
    1.  **Unit State updates:** Parse command queues, check battery levels and resource status.
    2.  **Movement Progression:** Incrementally step unit positions along coordinates based on terrain and weather speed multipliers.
    3.  **Detection Checks:** Enforce line-of-sight (LoS) checks and update perceived states.
    4.  **Combat Resolution:** Apply probabilistic hit/damage equations for units in engagement range.
    5.  **Objective Updates:** Calculate zone capture progress.
*   **Non-Blocking Decision-Making:** AI and users issue orders asynchronously. The simulation continuously updates and propagates actions in the background.

---

## 🪖 4. Troop-Based Modeling & Unit Compositions

Abstract health points (HP = 100) are replaced by exact troop counts and granular composition parameters.

### Specifications
*   **Unit Breakdown:** Units maintain explicit counts for infantry squads, support personnel, and heavy asset crews.
    *   *Example:* Infantry: 32, Support: 6, Heavy: 2.
*   **Granular Casualties:** Engage outcomes degrade troop counts (e.g. losing 4 infantry squads) rather than subtracting abstract HP numbers.
*   **Non-Linear Degradation:** Operational effectiveness and fire rate degrade non-linearly as troop counts decrease.

---

## 🔋 5. Equipment & Resource Logistics Modeling

Units track ammunition, weapons, and logistical supplies individually. Ticks consume resources dynamically based on actions.

### Specifications
*   **Equipment Inventories:** Units track weapon assets (rifles, machine guns, anti-armor launchers) and support equipment (batteries, communications devices).
*   **Logistical Supplies:** Tracked resource values include:
    *   *Ammunition:* Consumed per weapon firing event. Low ammo reduces engagement capabilities.
    *   *Fuel:* Consumed during vehicle movements. Low fuel restricts movement speed and traversal ranges.
    *   *Food:* Consumed over time. Low food levels degrade unit morale and physical endurance.
    *   *Batteries:* Consumed during active sensor/comms usage. Low batteries degrade detection range and signal transmission.
*   **Combat Ineffectiveness:** Units can become combat-ineffective (due to lack of ammo/fuel) without being destroyed, introducing resupply/recovery mechanics.

---

## 💥 6. State-Dependent Combat Effectiveness

Damage calculations shift from deterministic values to a state-dependent combat effectiveness function:

$$\text{effectiveness} = f(\text{troop\_count}, \text{ammo}, \text{terrain}, \text{morale})$$

*   *Morale & Suppression:* Suppressed units or units with depleted supplies suffer accuracy penalties.
*   *Environmental Conditions:* Active weather (storms, sandstorms) directly degrade weapon ranges and hit probabilities.

---

## 👁️ 7. Symmetric Fog-of-War & State Separation

Robust separation of wargaming ground truth from the perceived operational picture prevents cheating and implements realistic strategic uncertainty.

### Specifications
*   **Ground Truth State (Hidden):** The absolute, hidden wargame engine state. Tracks exact troop compositions, inventory counts, coordinates, and health properties.
*   **Observed State (Perceived):** Imperfect, filtered views provided symmetrically to the user, Allied AI, and Enemy AI:
    *   Estimated troop counts (provided as ranges, e.g. 20-30 infantry).
    *   Inferred weapon classes and stale position vectors.
    *   Confidence ratings (low, medium, high) based on distance and weather.
*   **Symmetric Fog-of-War:** No actor has access to ground truth. Player, Allied AI, and Enemy AI operate under the same detection limits.
*   **Dual AI Architecture:**
    *   *Allied AI (Execution Layer):* Decentrally executes commander directives. Coordinates maneuvers based solely on observed state parameters.
    *   *Enemy AI (Command Layer):* Opposing commander. Plans maneuvers and issues orders using estimated player troop counts and coordinates.
*   **Detection-Driven Updates:** Perceived details improve (narrower ranges, higher confidence) based on observer proximity, active recon assets, and contact duration. contact loss causes info to go stale.

---

## 📡 8. Command Propagation & Communication Delays

Centralized, instantaneous command execution is replaced by a delayed transmission pipeline.

### Specifications
*   **Transmission Pipeline:**
    $$\text{Command Issued} \rightarrow \text{Transmission Delay} \rightarrow \text{Unit Receives} \rightarrow \text{Execution Begins}$$
*   **Delay Calculation:** Latency is modeled dynamically:
    $$\text{delay} = \text{base\_latency} + \text{distance\_factor} + \text{terrain\_penalty}$$
    *   *Terrain penalty:* High elevation mountains or dense urban blocks interfere with radio signals, increasing delay or causing complete packet drop.
*   **Independent Channels:** Units communicate on separate, encrypted channels. Disabling a unit's radio (low battery or jammer) isolates it from commander control.

---

## 🤖 9. Restructured Role of AI

AI is moved up the generation stack to focus on qualitative contextualization:
*   **Procedural Systems Handle:** Terrains, elevations, water meshes, infrastructures, and force coordinates.
*   **AI Models Handle:** Mission briefings, threat SITREPs, intelligence reports, and narrative wargaming AARs.

---

## 🏆 10. Lifecycle & Outcome Evaluation

Binary win/loss parameters are replaced by graded operational metrics evaluated across:
*   Objective completion rates.
*   Casualty and asset attrition ratios.
*   Territorial control maps.
*   Logistical operational efficiency.

---
*Created by the WarMatrix Tactical Simulation Architect Core*
