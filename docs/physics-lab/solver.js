import { LAB_CONFIG } from './config.js';

function dist2(ax, ay, bx, by) {
  var dx = bx - ax;
  var dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Stable XPBD cloth core for physics-lab (local mesh units). */
export function createLabSolver(segW, segH, width, height, phase) {
  var cols = segW + 1;
  var rows = segH + 1;
  var count = cols * rows;
  var pos = new Float32Array(count * 3);
  var prev = new Float32Array(count * 3);
  var rest = new Float32Array(count * 3);
  var invMass = new Float32Array(count);
  var constraints = [];
  var grab = null;
  var paused = false;
  var settled = false;
  var releaseCooldown = 0;
  var softRelease = false;
  var softReleaseSteps = 0;
  var physicsState = 'idle';
  var invalidCount = 0;
  var maxSpeed = 0;
  var maxPosMag = 0;
  var currentPhase = phase;
  var bound = Math.max(width, height) * LAB_CONFIG.positionBoundMultiplier;
  var barY = -height * 0.5;

  function idx(ix, iy) {
    return iy * cols + ix;
  }

  function geomIdx(ix, iySolver) {
    return ix + cols * (segH - iySolver);
  }

  function addConstraint(i, j, compliance, kind) {
    if (i === j) return;
    var ri = i * 3;
    var rj = j * 3;
    var rlen = dist2(pos[ri], pos[ri + 1], pos[rj], pos[rj + 1]);
    if (!Number.isFinite(rlen) || rlen < LAB_CONFIG.epsilon) return;
    constraints.push({ i: i, j: j, rest: rlen, compliance: compliance, kind: kind });
  }

  function syncConstraints() {
    var sc = LAB_CONFIG.structuralCompliance;
    var sh = LAB_CONFIG.shearCompliance;
    var bc = LAB_CONFIG.bendCompliance;
    for (var c = 0; c < constraints.length; c++) {
      var cn = constraints[c];
      if (cn.kind === 0) cn.compliance = sc;
      else if (cn.kind === 1) cn.compliance = sh;
      else if (cn.kind === 2) cn.compliance = bc;
    }
  }

  function buildConstraints(p) {
    constraints.length = 0;
    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var i = idx(ix, iy);
        if (ix < segW) addConstraint(i, idx(ix + 1, iy), LAB_CONFIG.structuralCompliance, 0);
        if (iy < segH) addConstraint(i, idx(ix, iy + 1), LAB_CONFIG.structuralCompliance, 0);
        if (p >= 3) {
          if (ix < segW && iy < segH) addConstraint(i, idx(ix + 1, iy + 1), LAB_CONFIG.shearCompliance, 1);
          if (ix > 0 && iy < segH) addConstraint(i, idx(ix - 1, iy + 1), LAB_CONFIG.shearCompliance, 1);
        }
        if (p >= 4) {
          if (ix < segW - 1 && iy < segH) addConstraint(i, idx(ix + 2, iy), LAB_CONFIG.bendCompliance, 2);
          if (iy < segH - 1) addConstraint(i, idx(ix, iy + 2), LAB_CONFIG.bendCompliance, 2);
        }
      }
    }
  }

  function initRest() {
    var hw = width * 0.5;
    var hh = height * 0.5;
    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var i = idx(ix, iy);
        var x = (ix / segW) * width - hw;
        var y = (iy / segH) * height - hh;
        rest[i * 3] = x;
        rest[i * 3 + 1] = y;
        rest[i * 3 + 2] = 0;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = 0;
        invMass[i] = 1;
      }
    }
    for (var x = 0; x < cols; x++) invMass[idx(x, 0)] = 0;
    prev.set(pos);
    buildConstraints(currentPhase);
    invalidCount = 0;
    maxPosMag = computeMaxPosMag();
    paused = false;
    settled = currentPhase < 2;
    physicsState = 'ready';
  }

  function solveDistance(c, dt) {
    var i = c.i;
    var j = c.j;
    var ix = i * 3;
    var jx = j * 3;
    var ax = pos[ix];
    var ay = pos[ix + 1];
    var bx = pos[jx];
    var by = pos[jx + 1];
    var dx = bx - ax;
    var dy = by - ay;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < LAB_CONFIG.epsilon) return;
    var w1 = invMass[i];
    var w2 = invMass[j];
    var wSum = w1 + w2;
    if (wSum <= LAB_CONFIG.epsilon) return;
    var alpha = c.compliance / (dt * dt);
    var C = len - c.rest;
    var lambda = -C / (wSum + alpha);
    var nx = dx / len;
    var ny = dy / len;
    if (w1 > 0) {
      pos[ix] += lambda * w1 * nx;
      pos[ix + 1] += lambda * w1 * ny;
    }
    if (w2 > 0) {
      pos[jx] -= lambda * w2 * nx;
      pos[jx + 1] -= lambda * w2 * ny;
    }
  }

  function applyPins() {
    for (var x = 0; x < cols; x++) {
      var i = idx(x, 0);
      pos[i * 3 + 1] = rest[i * 3 + 1];
      pos[i * 3 + 2] = 0;
    }
  }

  function applyGrab() {
    if (!grab || currentPhase < 5) return;
    var g = grab;
    var r2 = g.radius * g.radius;
    for (var iy = 1; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var i = idx(ix, iy);
        if (invMass[i] <= 0) continue;
        var dx = ix - g.cx;
        var dy = iy - g.cy;
        var d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        var d = Math.sqrt(d2);
        var t = 1 - d / g.radius;
        var w = t * t * (3 - 2 * t) * LAB_CONFIG.grabStiffness;
        var mx = (g.x - pos[i * 3]) * w;
        var my = (g.y - pos[i * 3 + 1]) * w;
        var mlen = Math.sqrt(mx * mx + my * my);
        if (mlen > LAB_CONFIG.maxGrabStep) {
          var s = LAB_CONFIG.maxGrabStep / mlen;
          mx *= s;
          my *= s;
        }
        pos[i * 3] += mx;
        pos[i * 3 + 1] += my;
        prev[i * 3] += mx * 0.85;
        prev[i * 3 + 1] += my * 0.85;
      }
    }
  }

  function collision() {
    for (var i = 0; i < count; i++) {
      if (invMass[i] > 0 && pos[i * 3 + 1] < barY) pos[i * 3 + 1] = barY;
    }
  }

  function computeMaxPosMag() {
    var m = 0;
    for (var i = 0; i < count * 3; i++) m = Math.max(m, Math.abs(pos[i]));
    return m;
  }

  function safetyGuards(dt) {
    invalidCount = 0;
    for (var i = 0; i < count * 3; i++) {
      if (!Number.isFinite(pos[i])) invalidCount++;
    }
    if (invalidCount > 0) {
      controlledReset('non-finite');
      return false;
    }
    maxPosMag = computeMaxPosMag();
    // #region agent log
    // fetch logging disabled — use ?debugLog=1 in lab URL if needed
    // #endregion
    if (maxPosMag > bound) {
      controlledReset('bound');
      return false;
    }
    if (!grab && maxPosMag > height * 1.35) {
      controlledReset('creep');
      return false;
    }
    maxSpeed = 0;
    for (var p = 0; p < count; p++) {
      if (invMass[p] <= 0) continue;
      var px = p * 3;
      var sp = Math.sqrt((pos[px] - prev[px]) ** 2 + (pos[px + 1] - prev[px + 1]) ** 2) / dt;
      if (sp > maxSpeed) maxSpeed = sp;
    }
    return true;
  }

  function controlledReset(reason) {
    pos.set(rest);
    prev.set(rest);
    grab = null;
    paused = false;
    settled = currentPhase < 2;
    physicsState = 'reset:' + reason;
    invalidCount = 0;
    maxSpeed = 0;
    maxPosMag = computeMaxPosMag();
  }

  function clampVelocities() {
    var maxV = LAB_CONFIG.maxVertexSpeed;
    for (var p = 0; p < count; p++) {
      if (invMass[p] <= 0) continue;
      var px = p * 3;
      var vx = pos[px] - prev[px];
      var vy = pos[px + 1] - prev[px + 1];
      var sp = Math.sqrt(vx * vx + vy * vy);
      if (sp > maxSpeed) maxSpeed = sp;
      if (sp > maxV && sp > LAB_CONFIG.epsilon) {
        var s = maxV / sp;
        pos[px] = prev[px] + vx * s;
        pos[px + 1] = prev[px + 1] + vy * s;
      }
    }
  }

  function integrate(dt) {
    if (paused && !grab) return;
    if (!safetyGuards(dt)) return;
    if (settled && !grab) {
      physicsState = 'settled';
      applyPins();
      return;
    }

    var gy = currentPhase >= 2 ? LAB_CONFIG.gravityPhase2 : 0;
    var damp = 1 - LAB_CONFIG.damping;

    for (var i = 0; i < count; i++) {
      if (invMass[i] <= 0) continue;
      var ix = i * 3;
      var vx = (pos[ix] - prev[ix]) * damp;
      var vy = (pos[ix + 1] - prev[ix + 1]) * damp;
      prev[ix] = pos[ix];
      prev[ix + 1] = pos[ix + 1];
      prev[ix + 2] = pos[ix + 2];
      pos[ix] += vx;
      pos[ix + 1] += vy + gy * dt * dt;
    }

    var inRelease = releaseCooldown > 0 || softRelease;
    var iterCount = inRelease ? Math.min(3, LAB_CONFIG.iterations) : LAB_CONFIG.iterations;
    if (releaseCooldown > 0) releaseCooldown--;
    if (softRelease) {
      softReleaseSteps++;
      if (softReleaseSteps > 16) softRelease = false;
    }

    for (var k = 0; k < iterCount; k++) {
      for (var c = 0; c < constraints.length; c++) {
        var cn = constraints[c];
        if (inRelease && cn.compliance > LAB_CONFIG.structuralCompliance) continue;
        solveDistance(cn, dt);
      }
      applyPins();
      collision();
    }
    applyGrab();
    applyPins();
    collision();

    if (!safetyGuards(dt)) return;

    clampVelocities();

    if (!safetyGuards(dt)) return;

    if (grab) physicsState = 'dragging';
    else if (inRelease) physicsState = 'releasing';
    else if (maxSpeed < 0.02 && currentPhase >= 2) settled = true;
    else physicsState = 'simulating';

    if (softRelease && !grab && maxSpeed < 0.01) softRelease = false;

    if (!grab && !softRelease && currentPhase >= 2) {
      var pull = 0.012;
      for (var ri = 0; ri < count; ri++) {
        if (invMass[ri] <= 0) continue;
        var rx = ri * 3;
        pos[rx] += (rest[rx] - pos[rx]) * pull;
        pos[rx + 1] += (rest[rx + 1] - pos[rx + 1]) * pull;
      }
    }
  }

  function syncToGeometry(array) {
    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var si = idx(ix, iy);
        var gi = geomIdx(ix, iy);
        array[gi * 3] = pos[si * 3];
        array[gi * 3 + 1] = pos[si * 3 + 1];
        array[gi * 3 + 2] = pos[si * 3 + 2];
      }
    }
  }

  function vertexColors(array, threshold) {
    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var si = idx(ix, iy);
        var gi = geomIdx(ix, iy);
        var r = 1;
        var g = 1;
        var b = 1;
        if (invMass[si] === 0) {
          r = 1;
          g = 0.15;
          b = 0.15;
        } else if (grab && Math.abs(ix - grab.cx) <= grab.radius && Math.abs(iy - grab.cy) <= grab.radius) {
          r = 0.2;
          g = 1;
          b = 0.25;
        } else {
          var sp = Math.hypot(pos[si * 3] - prev[si * 3], pos[si * 3 + 1] - prev[si * 3 + 1]);
          if (sp > threshold) {
            r = 1;
            g = 0.9;
            b = 0.1;
          }
        }
        array[gi * 3] = r;
        array[gi * 3 + 1] = g;
        array[gi * 3 + 2] = b;
      }
    }
  }

  function nearestVertex(lx, ly) {
    var best = 0;
    var bestD = Infinity;
    for (var i = 0; i < count; i++) {
      var dx = pos[i * 3] - lx;
      var dy = pos[i * 3 + 1] - ly;
      var d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function vertexToGrid(vi) {
    return { ix: vi % cols, iy: Math.floor(vi / cols) };
  }

  function validateConstraintList() {
    var errors = [];
    for (var c = 0; c < constraints.length; c++) {
      var cn = constraints[c];
      if (cn.i === cn.j) errors.push('self');
      if (!Number.isFinite(cn.rest) || cn.rest < LAB_CONFIG.epsilon) errors.push('rest');
    }
    return errors;
  }

  initRest();

  return {
    pos: pos,
    prev: prev,
    rest: rest,
    invMass: invMass,
    count: count,
    cols: cols,
    rows: rows,
    segH: segH,
    idx: idx,
    geomIdx: geomIdx,
    integrate: integrate,
    syncToGeometry: syncToGeometry,
    vertexColors: vertexColors,
    controlledReset: controlledReset,
    nearestVertex: nearestVertex,
    vertexToGrid: vertexToGrid,
    validateConstraintList: validateConstraintList,
    setGrab: function (g) {
      grab = g;
      settled = false;
      paused = false;
    },
    clearGrab: function () {
      if (grab) {
        releaseCooldown = 12;
        softRelease = true;
        softReleaseSteps = 0;
        for (var i = 0; i < count; i++) {
          if (invMass[i] <= 0) continue;
          var px = i * 3;
          prev[px] = pos[px];
          prev[px + 1] = pos[px + 1];
        }
      }
      grab = null;
      settled = false;
      paused = false;
    },
    getGrab: function () {
      return grab;
    },
    get constraintCount() {
      return constraints.length;
    },
    get activeGrabConstraints() {
      return grab ? 1 : 0;
    },
    get stats() {
      return {
        invalidCount: invalidCount,
        maxSpeed: maxSpeed,
        maxPosMag: maxPosMag,
        constraintCount: constraints.length,
        activeGrab: grab ? 1 : 0,
        physicsState: physicsState,
        paused: paused,
        bound: bound,
      };
    },
    setPhase: function (p) {
      currentPhase = p;
      buildConstraints(p);
      controlledReset('phase');
    },
    getPhase: function () {
      return currentPhase;
    },
    applyPreset: function (patch) {
      if (patch.structuralCompliance != null) LAB_CONFIG.structuralCompliance = patch.structuralCompliance;
      if (patch.shearCompliance != null) LAB_CONFIG.shearCompliance = patch.shearCompliance;
      if (patch.bendCompliance != null) LAB_CONFIG.bendCompliance = patch.bendCompliance;
      if (patch.damping != null) LAB_CONFIG.damping = patch.damping;
      if (patch.grabStiffness != null) LAB_CONFIG.grabStiffness = patch.grabStiffness;
      if (patch.grabRadius != null) LAB_CONFIG.grabRadius = patch.grabRadius;
      if (patch.gravity != null) LAB_CONFIG.gravityPhase2 = patch.gravity;
      if (patch.iterations != null) LAB_CONFIG.iterations = patch.iterations;
      if (patch.maxVertexSpeed != null) LAB_CONFIG.maxVertexSpeed = patch.maxVertexSpeed;
      if (patch.maxGrabStep != null) LAB_CONFIG.maxGrabStep = patch.maxGrabStep;
    },
    syncConstraints: syncConstraints,
    getPreset: function () {
      return {
        structuralCompliance: LAB_CONFIG.structuralCompliance,
        shearCompliance: LAB_CONFIG.shearCompliance,
        bendCompliance: LAB_CONFIG.bendCompliance,
        damping: LAB_CONFIG.damping,
        grabStiffness: LAB_CONFIG.grabStiffness,
        grabRadius: LAB_CONFIG.grabRadius,
        gravity: LAB_CONFIG.gravityPhase2,
        iterations: LAB_CONFIG.iterations,
        maxVertexSpeed: LAB_CONFIG.maxVertexSpeed,
        maxGrabStep: LAB_CONFIG.maxGrabStep,
      };
    },
  };
}
