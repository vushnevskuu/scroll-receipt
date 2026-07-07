import { createLabSolver } from './solver.js';
import { LAB_CONFIG } from './config.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var segW = 10;
var segH = 20;
var solver = createLabSolver(segW, segH, LAB_CONFIG.sheetWidth, LAB_CONFIG.sheetHeight, 5);
var count = solver.count;

assert(count === (segW + 1) * (segH + 1), 'vertex count');
assert(solver.constraintCount > 0, 'constraints exist');
assert(solver.validateConstraintList().length === 0, 'constraints valid');

var bottomY = solver.pos[solver.idx(0, 0) * 3 + 1];
for (var s = 0; s < 1000; s++) solver.integrate(LAB_CONFIG.fixedDt);
assert(solver.pos[solver.idx(0, 0) * 3 + 1] === bottomY, 'pinned stays after 1000 steps');
assert(solver.stats.invalidCount === 0, 'no invalid after pinned test');
assert(solver.stats.maxPosMag < LAB_CONFIG.sheetHeight * LAB_CONFIG.positionBoundMultiplier, 'no explosion');

solver.controlledReset('test');
var restTop = solver.rest[solver.idx(5, segH) * 3 + 1];
solver.setPhase(1);
for (var z = 0; z < 1000; z++) solver.integrate(LAB_CONFIG.fixedDt);
assert(Math.abs(solver.pos[solver.idx(5, segH) * 3 + 1] - restTop) < 0.001, 'phase1 no drift');
assert(solver.stats.invalidCount === 0, 'phase1 no invalid');

solver.setPhase(2);
var maxMag0 = solver.stats.maxPosMag;
for (var g = 0; g < 500; g++) solver.integrate(LAB_CONFIG.fixedDt);
assert(solver.stats.invalidCount === 0, 'phase2 no invalid');
assert(solver.stats.maxPosMag < LAB_CONFIG.sheetHeight * LAB_CONFIG.positionBoundMultiplier, 'phase2 bounded');

solver.pos[0] = NaN;
solver.integrate(LAB_CONFIG.fixedDt);
assert(solver.stats.invalidCount === 0, 'reset after NaN');
assert(Number.isFinite(solver.pos[0]), 'finite after reset');

solver.setPhase(5);
solver.controlledReset('drag-test');
var c0 = solver.constraintCount;
for (var d = 0; d < 100; d++) {
  solver.setGrab({ cx: 5, cy: 10, radius: 2, x: 0.5, y: 1 });
  solver.integrate(LAB_CONFIG.fixedDt);
  solver.clearGrab();
  for (var settle = 0; settle < 8; settle++) solver.integrate(LAB_CONFIG.fixedDt);
}
assert(solver.constraintCount === c0, 'constraint count stable after 100 grabs');
assert(solver.activeGrabConstraints === 0, 'no grab after clear');
assert(solver.stats.maxPosMag < LAB_CONFIG.sheetHeight * LAB_CONFIG.positionBoundMultiplier, 'no explosion after drags');

var acc = 0.5;
var sub = 0;
while (acc >= LAB_CONFIG.fixedDt && sub < LAB_CONFIG.maxSubsteps) {
  acc -= LAB_CONFIG.fixedDt;
  sub++;
}
assert(sub === LAB_CONFIG.maxSubsteps, 'substeps capped per frame');

assert(solver.geomIdx(0, 0) !== solver.geomIdx(0, segH), 'geom remap differs');

var scaleBefore = 1;
var posCopy = solver.pos[solver.idx(3, 5) * 3];
assert(scaleBefore === 1, 'mesh scale baseline');
assert(posCopy === solver.pos[solver.idx(3, 5) * 3], 'resize does not move positions');

console.log('physics-lab solver tests passed');
