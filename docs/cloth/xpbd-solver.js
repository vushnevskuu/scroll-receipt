import { PAPER_PRESET } from './config.js';

function dist(ax, ay, bx, by) {
  var dx = bx - ax;
  var dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function createXPBDSolver(segW, segH, width, height) {
  var cols = segW + 1;
  var rows = segH + 1;
  var count = cols * rows;
  var pos = new Float32Array(count * 3);
  var prev = new Float32Array(count * 3);
  var invMass = new Float32Array(count);
  var pinY = new Float32Array(count);
  var constraints = [];
  var lambdas = [];
  var sleeping = false;
  var grab = null;

  function idx(ix, iy) {
    return iy * cols + ix;
  }

  function initGrid(offsetX, offsetY) {
    var hw = width * 0.5;
    var hh = height * 0.5;
    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var i = idx(ix, iy);
        var u = ix / segW;
        var v = iy / segH;
        pos[i * 3] = offsetX + u * width - hw;
        pos[i * 3 + 1] = offsetY + v * height - hh;
        pos[i * 3 + 2] = 0;
        invMass[i] = 1;
        pinY[i] = 0;
      }
    }

    for (var x = 0; x < cols; x++) {
      var bottom = idx(x, 0);
      invMass[bottom] = 0;
      pinY[bottom] = pos[bottom * 3 + 1];
      if (rows > 1) {
        var soft = idx(x, 1);
        invMass[soft] = 0.15;
        pinY[soft] = pos[soft * 3 + 1];
      }
    }

    prev.set(pos);
    buildConstraints();
  }

  function addConstraint(i, j, compliance) {
    var rest = dist(pos[i * 3], pos[i * 3 + 1], pos[j * 3], pos[j * 3 + 1]);
    constraints.push({ i: i, j: j, rest: rest, compliance: compliance });
    lambdas.push(0);
  }

  function buildConstraints() {
    constraints.length = 0;
    lambdas.length = 0;
    var sc = PAPER_PRESET.structuralCompliance;
    var sh = PAPER_PRESET.shearCompliance;
    var bc = PAPER_PRESET.bendCompliance;

    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var i = idx(ix, iy);
        if (ix < segW) addConstraint(i, idx(ix + 1, iy), sc);
        if (iy < segH) addConstraint(i, idx(ix, iy + 1), sc);
        if (ix < segW && iy < segH) addConstraint(i, idx(ix + 1, iy + 1), sh);
        if (ix > 0 && iy < segH) addConstraint(i, idx(ix - 1, iy + 1), sh);
        if (ix < segW - 1 && iy < segH) addConstraint(i, idx(ix + 2, iy), bc);
        if (iy < segH - 1 && ix < cols) addConstraint(i, idx(ix, iy + 2), bc);
      }
    }
  }

  function solveDistance(c, dt) {
    var i = c.i;
    var j = c.j;
    var ix = i * 3;
    var jx = j * 3;
    var ax = pos[ix];
    var ay = pos[ix + 1];
    var az = pos[ix + 2];
    var bx = pos[jx];
    var by = pos[jx + 1];
    var bz = pos[jx + 2];
    var dx = bx - ax;
    var dy = by - ay;
    var dz = bz - az;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-8) return;

    var w1 = invMass[i];
    var w2 = invMass[j];
    var wSum = w1 + w2;
    if (wSum <= 0) return;

    var alpha = c.compliance / (dt * dt);
    var C = len - c.rest;
    var lambda = -C / (wSum + alpha);
    var nx = dx / len;
    var ny = dy / len;
    var nz = dz / len;

    if (w1 > 0) {
      pos[ix] += lambda * w1 * nx;
      pos[ix + 1] += lambda * w1 * ny;
      pos[ix + 2] += lambda * w1 * nz;
    }
    if (w2 > 0) {
      pos[jx] -= lambda * w2 * nx;
      pos[jx + 1] -= lambda * w2 * ny;
      pos[jx + 2] -= lambda * w2 * nz;
    }
  }

  function applyPins() {
    for (var i = 0; i < count; i++) {
      if (invMass[i] === 0) {
        pos[i * 3 + 1] = pinY[i];
        pos[i * 3 + 2] = 0;
      }
    }
  }

  function applyGrab() {
    if (!grab) return;
    var g = grab;
    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        if (iy <= 1) continue;
        var i = idx(ix, iy);
        if (invMass[i] <= 0) continue;
        var dx = ix - g.cx;
        var dy = iy - g.cy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > g.radius) continue;
        var t = 1 - d / g.radius;
        var w = t * t * g.strength;
        pos[i * 3] += (g.x - pos[i * 3]) * w;
        pos[i * 3 + 1] += (g.y - pos[i * 3 + 1]) * w;
      }
    }
  }

  function printerCollision(barY) {
    for (var i = 0; i < count; i++) {
      if (pos[i * 3 + 1] < barY && invMass[i] > 0) {
        pos[i * 3 + 1] = barY;
      }
    }
  }

  function integrate(dt) {
    if (sleeping && !grab) return;
    var damp = 1 - PAPER_PRESET.damping;

    for (var i = 0; i < count; i++) {
      if (invMass[i] <= 0) continue;
      var ix = i * 3;
      var vx = (pos[ix] - prev[ix]) * damp;
      var vy = (pos[ix + 1] - prev[ix + 1]) * damp;
      var vz = (pos[ix + 2] - prev[ix + 2]) * damp;
      prev[ix] = pos[ix];
      prev[ix + 1] = pos[ix + 1];
      prev[ix + 2] = pos[ix + 2];
      pos[ix] += vx;
      pos[ix + 1] += vy;
      pos[ix + 2] += vz;
    }

    for (var k = 0; k < PAPER_PRESET.iterations; k++) {
      for (var c = 0; c < constraints.length; c++) {
        solveDistance(constraints[c], dt);
      }
      applyGrab();
      applyPins();
      printerCollision(PAPER_PRESET.printerBarY);
    }

    var energy = 0;
    for (var p = 0; p < count; p++) {
      if (invMass[p] <= 0) continue;
      var px = p * 3;
      var vx2 = pos[px] - prev[px];
      var vy2 = pos[px + 1] - prev[px + 1];
      energy += vx2 * vx2 + vy2 * vy2;
    }
    sleeping = !grab && energy < PAPER_PRESET.sleepThreshold;
  }

  function resetNaN() {
    for (var i = 0; i < count * 3; i++) {
      if (!Number.isFinite(pos[i])) pos[i] = prev[i] || 0;
    }
  }

  return {
    pos: pos,
    prev: prev,
    invMass: invMass,
    count: count,
    cols: cols,
    rows: rows,
    width: width,
    height: height,
    idx: idx,
    initGrid: initGrid,
    integrate: integrate,
    resetNaN: resetNaN,
    setGrab: function (g) {
      grab = g;
      sleeping = false;
    },
    clearGrab: function () {
      grab = null;
    },
    setPrinterBar: function (y) {
      PAPER_PRESET.printerBarY = y;
    },
    nearestVertex: function (wx, wy) {
      var best = 0;
      var bestD = Infinity;
      for (var i = 0; i < count; i++) {
        var dx = pos[i * 3] - wx;
        var dy = pos[i * 3 + 1] - wy;
        var d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    vertexToGrid: function (vi) {
      return { ix: vi % cols, iy: Math.floor(vi / cols) };
    },
  };
}
