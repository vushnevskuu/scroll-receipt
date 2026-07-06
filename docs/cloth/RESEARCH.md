# Research notes (XPBD receipt cloth)

| Source | Borrowed |
|--------|----------|
| three.js `webgpu_compute_cloth` | Verlet loop structure, subdivided plane, per-frame buffer attribute update |
| three-simplecloth | TypedArray particle storage outside render tree |
| threelab Cloth | Pin modes (hard/soft rows), wind as external force |
| webgpu_cloth_simulator | XPBD distance compliance, substeps, bending stiffness tuning |
| CIS565 WebGL Cloth | Grab pins concept (adapted to CPU XPBD) |
| PositionBasedDynamics | Distance + bending constraint math, inverse mass |

Rejected: WebGPU-only paths, Ammo soft body (vertex order fragile), DOM spring as primary.
