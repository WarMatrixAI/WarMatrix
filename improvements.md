## **1. Current System Overview**

The existing simulation operates on a **grid-based coordinate system (≈30×40)** where entities (“blips”) represent friendly units, enemy units, and objectives. Each entity is assigned a fixed health value, and interactions are resolved through direct commands specifying movement and target coordinates.

The system supports:

* 2D tactical visualization with indexed grid positions
* 3D terrain rendering (procedural elevation only)
* Basic simulation through coordinate-driven movement and attack resolution
* Static objective capture mechanics (progress-based)

While functional, the current model abstracts away most real-world dynamics, limiting realism and strategic depth.

---

## **2. Limitations of the Current Approach**

Several structural constraints prevent the simulation from scaling into a realistic wargaming environment:

### **2.1 Grid-Based Coordinate System**

* Discrete cells restrict movement and positioning
* No concept of real-world scale, distance, or orientation
* Limits integration with realistic terrain and physics

### **2.2 Lack of Semantic Terrain**

* Terrain is purely elevation-based (mountains only)
* No differentiation between urban areas, roads, water, or cover
* 3D map is visual-only and not used in simulation logic

### **2.3 Abstract Entity Modeling**

* All entities are treated uniformly (100 HP)
* No differentiation in unit roles, capabilities, or behavior
* Combat is deterministic and instantaneous

### **2.4 Instantaneous Simulation Resolution**

* Commands resolve immediately without time progression
* No intermediate states such as movement, detection, or engagement phases

### **2.5 Simplistic Objective System**

* Objectives rely on static capture mechanics
* No dynamic mission evolution or strategic variation

---

## **3. Transition to a Real-World Coordinate System**

A foundational upgrade involves replacing the current grid-based coordinates with a **continuous, real-world coordinate system**.

### **Proposed Changes**

* Use continuous spatial coordinates (latitude/longitude abstraction)
* Introduce real distance, direction, and scale
* Generate maps based on **randomized coordinate regions** instead of fixed grids

### **Impact**

* Enables realistic movement, range calculation, and spatial reasoning
* Allows seamless integration of terrain, airspace, and maritime zones
* Removes artificial constraints imposed by discrete grids

---

## **4. Evolution of Map Generation**

### **Current State**

* Procedural generation produces only elevation (mountainous terrain)

### **Target State**

Map generation evolves into a **multi-layered world model**:

#### **4.1 Terrain Semantics**

Each location includes:

* Terrain type (urban, plain, mountain, water)
* Elevation
* Movement cost
* Cover value
* Visibility modifiers

#### **4.2 Environment Types**

* Urban zones (dense structures, limited visibility)
* Open terrain (high visibility, low cover)
* Water bodies (naval domain)
* Roads (faster traversal)

#### **4.3 3D Integration**

* 3D map becomes a **representation of simulation data**, not just a visual mesh
* Urban environments initially approximated using simple structures before full modeling

---

## **5. Time-Stepped Simulation Architecture**

The simulation will transition from instant resolution to a **tick-based system**.

### **Simulation Loop**

Each time step processes:

1. Unit state updates
2. Movement progression
3. Detection checks
4. Engagement resolution
5. Objective updates

### **Impact**

* Introduces temporal dynamics
* Allows interruption, reaction, and emergent behavior
* Enables more realistic combat flow

---

## **6. Advanced Entity Modeling**

Entities will evolve from abstract blips into **stateful units with defined roles**.

### **Enhancements**

* Unit types (infantry, armor, recon, etc.)
* Attributes:

  * Detection range
  * Engagement range
  * Mobility
  * Behavior patterns

### **Combat Model Upgrade**

* Replace simple HP with **state-based damage**:

  * Active
  * Damaged (reduced effectiveness)
  * Destroyed

---

## **7. Detection and Engagement System**

Combat will follow a structured pipeline:

1. **Detection** (based on distance, terrain, and conditions)
2. **Targeting** (line-of-sight and prioritization)
3. **Engagement** (range, accuracy, weapon effects)
4. **Resolution** (probabilistic outcomes)

### **Key Additions**

* Line-of-sight constraints
* Terrain-influenced visibility
* Probabilistic hit and damage models

---

## **8. Environmental and Weather Systems**

Environmental factors will directly influence simulation outcomes.

### **Parameters**

* Weather (rain, fog, storms)
* Time of day (day/night cycles)
* Visibility range

### **Effects**

* Detection degradation
* Movement penalties
* Accuracy variation

---

## **9. Objective and Mission System Redesign**

Objectives will shift from static capture mechanics to **dynamic mission-driven logic**.

### **New Objective Types**

* Area control
* Reconnaissance
* Escort and defense
* Target elimination

### **Enhancements**

* Dynamic objective updates during simulation
* Contested zones and influence-based control
* Partial success and failure conditions

---

## **10. Multi-Domain Combat Expansion**

The simulation will expand beyond land-based operations into a **multi-domain environment**.

### **Domains**

* **Land:** terrain-aware movement and combat
* **Air:** altitude-based movement, large detection radius
* **Naval:** surface movement restricted to water
* **Underwater:** sonar-based detection, no line-of-sight dependency

### **Note**

Multi-domain integration will be introduced incrementally, with land simulation fully stabilized first.

---

## **11. Simulation Lifecycle and Outcome Evaluation**

The simulation will adopt a structured lifecycle:

* Initialization
* Active engagement
* Resolution
* Post-simulation evaluation

### **Outcome Metrics**

* Objective completion
* Casualties and survivability
* Territorial control
* Operational efficiency

This replaces binary win/loss conditions with **graded mission outcomes**.
