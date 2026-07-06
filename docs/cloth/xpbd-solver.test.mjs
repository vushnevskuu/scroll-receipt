import { createXPBDSolver } from './xpbd-solver.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var solver = createXPBDSolver(4, 6, 100, 150);
solver.initGrid(0, 0);

assert(solver.count === 35, 'vertex count');
assert(solver.invMass[0] === 0, 'bottom pinned');

var i0 = solver.pos[0];
solver.integrate(1 / 120);
solver.resetNaN();
assert(Number.isFinite(solver.pos[0]), 'no NaN after step');

console.log('xpbd-solver tests passed');
