- Simulation Requirements Prompt (LLM + Hybrid Comms, ROS 2‑Ready)

Build a **2D drone–tank simulation** with a **FastAPI + WebSocket** backend and a **browser-based HTML5 Canvas GUI**, designed for **offline portability**.
The communication layer must be **swappable for a ROS 2 backend** in future releases without changing core simulation or GUI logic.

---

## 1) Architecture Summary

* **Backend:** FastAPI app hosting REST + WebSocket; fixed-timestep simulation loop (configurable dt), event bus, and message router.
* **Frontend:** Single-page app (Canvas renderer + UI). GUI subscribes to state deltas via WS; sends commands via REST/WS.
* **Data Model:** Entities (drones, tanks) hold kinematics + metadata. Scenario/terrain loaders populate world on reset. All public state serializable to JSON.
* **Replaceable comms:** Common message schema used both by WS and (future) ROS 2 topics/services.
* **Runtime speed scaling:** Simulation speed slider adjusts the fixed timestep multiplier. Physics calculations, timers, and AI update intervals scale proportionally so that entity motion, detection logic, and animations remain consistent at any speed.

---

## 2) Entities & Rendering

### Drones

* **Shape:** Delta wing (wider base, short nose; stealth UAV silhouette)
* **Orientation:** Nose points toward heading
* **Fill color (mode/state):** Green = idle/search, Yellow = tracking target, Red = kamikaze/engaging
* **Outline:** Bright yellow when selected
* **Size:** Adjustable via GUI, supports **very small scaling** (down to 2–4 px body width) for large‑area maps. Rendering logic preserves outline visibility at minimum scale.

### Tanks

* **Shape:** Square with beveled corners (slight chamfer)
* **Fill color (status):** Red = not discovered, Blue = discovered, Grey = destroyed
* **Extra:** Small black “X” overlay for destroyed tanks
* **State Flags:** `idle | moving | engaging | destroyed`
* **Size:** Adjustable via GUI, supports very small scaling similar to drones.

---

## 3) Movement & Constraints

* Continuous rectangular arena; all entities remain in-bounds.
* Unicycle kinematics for movement.
* Tanks avoid other tanks, destroyed tanks, and blocked terrain.
* **Scaling impact:** Physics, detection ranges, and speeds remain independent of visual size.

**Basic Tank Movement Logic:** Normal roam/patrol, avoidance, flee/ambush on detection, periodic recalculation.

**Tank Command Modes:** GO\_TO, PATROL\_ROUTE, HOLD\_POSITION, FLEE\_TO\_COVER, HIDE\_AND\_AMBUSH

**Manual Control:** Select via click, change mode via dropdown/context menu, display mode above tank. **When multiple entities are selected** (shift‑click), cycling through them can be done via keyboard shortcuts (e.g., Tab/Shift+Tab) or by clicking their name in the entity list. Selected entity’s control focus is highlighted in both the canvas and sidebar.

---

## 4) Detection & Exposure

* Configurable detection radius.
* Tank turns Blue when in range of a drone, reverts to Red otherwise.
* Kamikaze: drone engages, both turn Grey.
* Detection circle style and scaling preserved at all zoom levels.

---

## 5) Drone Command Modes

* GO\_TO, FOLLOW\_TANK, FOLLOW\_TEAMMATE, RANDOM\_SEARCH, PATROL\_ROUTE, HOLD\_POSITION

**Manual Control:** Select via click, move with WASD/Arrows, Space to stop, switch mode via dropdown/context menu. **When multiple drones are selected**, quick-switch controls and entity list selection work the same as tanks.

---

## 5.1) Tank Behavior Editing (like drones)

* Change strategy from dropdown, update route visually, switch simple mode.
* GUI sidebar with live strategy/mode display.

---

## 6) Communication Layer

* Now: WebSocket; Future: ROS 2 topics/services
* Supports broadcast, targeted commands, and events

---

## 7) LLM Integration

* OpenAI-compatible endpoint for LLM control (per-drone or shared "big brain" LLM)
* Policy/validation layer, auth tokens, streaming support

---

## 8) Live Chat Panel

* Scrollable feed like Telegram group, operator input, persistent logs
* Supports human messages, LLM messages, and multi-drone comms
* Future: group/private chats for LLM drones (WhatsApp-style)

---

## 9) GUI Layout & Features

* **Entity Controls:** Add/remove drones/tanks at runtime via GUI buttons/menu
* **Simulation Control:** Start/Pause/Reset, speed slider for runtime speed scaling, zoom/pan
* **Scaling Controls:** Runtime sliders for entity visual size
* **Selection:** Click to select, shift-click to multi-select, quick‑switch shortcuts for multi‑selection
* **Sidebars:** Entity list/filters (left), entity controls/chat/events (right)
* **Style:** Dark theme, modern Apple‑like design — fast, functional, minimal shadows, bright outlines, smooth animations

---

## 10) Performance

* Viewport culling, vector rendering, delta updates
* LOD rendering for tiny entities in large maps

---

## 11) Controls & Metrics

* Adjustable speeds, detection ranges, simulation speed
* Track: kills, losses, mission duration

---

## 12) Scenario Loader

* Load JSON/CSV, deterministic seeds, per-entity scale

---

## 13) Testing & Automation Hooks

* Programmatic API: spawn, command, state query
* GUI-free automated tests
* **Specific functional test cases:**

  * Follow Tank → drone changes position and heading toward correct target
  * Follow Teammate → relative distance maintained
  * Detection color change → correct timing on entry/exit of range
  * Kamikaze → both entities turn Grey and stop
  * Manual control overrides AI correctly
  * Add/remove entity updates state without crash
  * Scaling changes do not affect physics/detection

---

## 14) Terrain & Map System

* Grid with move costs, blocked cells, cover, elevation

---

## 15) Tank Strategy Framework

* FSM or behavior tree; built-in strategies
* Switchable at runtime via GUI

---

## 16) ROS 2 Compatibility Notes

* Mirror schemas to ROS 2 topics/services

---

## 17) Next Release (Planned)

* LLM-driven chat behaviors
* Group/private chat channels
* Terrain-aware detection
* Multi-scale rendering enhancements