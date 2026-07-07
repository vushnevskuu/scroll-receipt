import { createXPBDSolver } from './xpbd-solver.js';
import { PAPER_PRESET } from './config.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var solver = createXPBDSolver(4, 6, 100, 150);
solver.initGrid(0, 0);
solver.setPrinterBar(-75);

assert(solver.count === 35, 'vertex count');
assert(solver.invMass[solver.idx(0, 6)] === 0, 'top pinned');
assert(solver.constraintCount > 0, 'constraints built');
assert(solver.pos[solver.idx(2, 0) * 3 + 2] > 0, 'free edge starts curled in depth');

var topY = solver.pos[solver.idx(0, 6) * 3 + 1];
solver.integrate(1 / 120);
solver.resetNaN();
assert(solver.pos[solver.idx(0, 6) * 3 + 1] === topY, 'pinned vertex stays');

var freeIdx = solver.idx(0, 0);
var freeBefore = solver.pos[freeIdx * 3 + 1];
var freeDepthBefore = solver.pos[freeIdx * 3 + 2];
solver.setGrab({ cx: 0, cy: 0, radius: 2, strength: 0.95, x: 0, y: freeBefore - 40, z: freeDepthBefore + 20 });
for (var s = 0; s < 12; s++) solver.integrate(1 / 120);
assert(solver.pos[freeIdx * 3 + 1] < freeBefore - 5, 'grab moves free edge down');
assert(solver.pos[freeIdx * 3 + 2] > freeDepthBefore, 'grab can lift free edge in depth');

var geomTop = solver.geomIdx(0, 6);
var geomBottom = solver.geomIdx(0, 0);
assert(geomTop !== geomBottom, 'geometry index remap differs top/bottom');

var acc = 0;
var substeps = 0;
var dt = 0.2;
while (acc < dt && substeps < PAPER_PRESET.maxSubsteps) {
  acc += PAPER_PRESET.fixedDt;
  substeps++;
}
assert(substeps === PAPER_PRESET.maxSubsteps, 'accumulator capped');

solver.pos[0] = NaN;
solver.resetNaN();
assert(Number.isFinite(solver.pos[0]), 'reset after NaN');

console.log('xpbd-solver tests passed');
