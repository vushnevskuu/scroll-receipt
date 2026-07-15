import { PAPER_PRESET } from './config.js';

var EPSILON = 1e-8;

function dist2(ax, ay, bx, by) {
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
  var rest = new Float32Array(count * 3);
  var invMass = new Float32Array(count);
  var pinY = new Float32Array(count);
  var constraints = [];
  var sleeping = false;
  var grab = null;
  var nanCount = 0;
  var maxSpeed = 0;
  var maxPosMag = 0;
  var releaseCooldown = 0;
  var softRelease = false;
  var softReleaseSteps = 0;
  var bound = Math.max(width, height) * 3;
  var lastResetReason = '';
  var simTime = 0;
  var printerAttached = true;

  function idx(ix, iy) {
    return iy * cols + ix;
  }

  /** PlaneGeometry row 0 = top; solver row 0 = bottom/free edge. */
  function geomIdx(ix, iySolver) {
    return ix + cols * (segH - iySolver);
  }

  function computeMaxPosMag() {
    var m = 0;
    for (var i = 0; i < count * 3; i++) m = Math.max(m, Math.abs(pos[i]));
    return m;
  }

  function addConstraint(i, j, compliance, kind) {
    if (i === j) return;
    var restLen = dist2(pos[i * 3], pos[i * 3 + 1], pos[j * 3], pos[j * 3 + 1]);
    if (!Number.isFinite(restLen) || restLen < EPSILON) return;
    constraints.push({ i: i, j: j, rest: restLen, compliance: compliance, kind: kind });
  }

  function buildConstraints() {
    constraints.length = 0;
    var sc = PAPER_PRESET.structuralCompliance;
    var sh = PAPER_PRESET.shearCompliance;
    var bc = PAPER_PRESET.bendCompliance;
    // Vertical bend softer than horizontal: receipt curls down the length.
    var bcV = bc * 1.8;

    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var i = idx(ix, iy);
        if (ix < segW) addConstraint(i, idx(ix + 1, iy), sc, 0);
        if (iy < segH) addConstraint(i, idx(ix, iy + 1), sc, 0);
        if (ix < segW && iy < segH) addConstraint(i, idx(ix + 1, iy + 1), sh, 1);
        if (ix > 0 && iy < segH) addConstraint(i, idx(ix - 1, iy + 1), sh, 1);
        if (ix < segW - 1 && iy < segH) addConstraint(i, idx(ix + 2, iy), bc, 2);
        if (iy < segH - 1 && ix < cols) addConstraint(i, idx(ix, iy + 2), bcV, 3);
      }
    }
  }

  function syncConstraints() {
    var sc = PAPER_PRESET.structuralCompliance;
    var sh = PAPER_PRESET.shearCompliance;
    var bc = PAPER_PRESET.bendCompliance;
    var bcV = bc * 1.8;
    for (var c = 0; c < constraints.length; c++) {
      var cn = constraints[c];
      if (cn.kind === 0) cn.compliance = sc;
      else if (cn.kind === 1) cn.compliance = sh;
      else if (cn.kind === 2) cn.compliance = bc;
      else if (cn.kind === 3) cn.compliance = bcV;
    }
  }

  function controlledReset(reason) {
    lastResetReason = reason;
    pos.set(rest);
    prev.set(rest);
    grab = null;
    printerAttached = true;
    sleeping = false;
    softRelease = false;
    releaseCooldown = 0;
    softReleaseSteps = 0;
    nanCount = 0;
    maxSpeed = 0;
    maxPosMag = computeMaxPosMag();
  }

  function clampPositions(limit) {
    for (var i = 0; i < count * 3; i++) {
      if (pos[i] > limit) pos[i] = limit;
      if (pos[i] < -limit) pos[i] = -limit;
    }
    maxPosMag = computeMaxPosMag();
  }

  function relaxedPose(offsetX, offsetY, u, v, hw, hh) {
    var x = offsetX + u * width - hw;
    var yBase = offsetY + v * height - hh;
    var edge = Math.abs(u - 0.5) * 2;
    var topBias = Math.pow(1 - v, 1.65);
    var guidePhase = Math.min((1 - v) / 0.16, 1);
    var printerGuide = Math.sin(guidePhase * Math.PI) * (1 - guidePhase);
    var z = topBias * PAPER_PRESET.curlLift * (0.76 + edge * edge * PAPER_PRESET.curlEdgeBoost);

    z += printerGuide * PAPER_PRESET.printerCurlLift;

    return {
      x: x,
      y: yBase - z * PAPER_PRESET.curlDrop,
      z: z,
    };
  }

  function safetyGuards() {
    for (var i = 0; i < count * 3; i++) {
      if (!Number.isFinite(pos[i])) {
        nanCount++;
        controlledReset('non-finite');
        return false;
      }
    }
    maxPosMag = computeMaxPosMag();
    if (maxPosMag > bound) {
      if (grab) {
        clampPositions(bound);
        return true;
      }
      controlledReset('bound');
      return false;
    }
    if (!grab && printerAttached && maxPosMag > height * 1.35) {
      controlledReset('creep');
      return false;
    }
    return true;
  }

  function initGrid(offsetX, offsetY) {
    var hw = width * 0.5;
    var hh = height * 0.5;
    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var i = idx(ix, iy);
        var u = ix / segW;
        var v = iy / segH;
        var pose = relaxedPose(offsetX, offsetY, u, v, hw, hh);
        pos[i * 3] = pose.x;
        pos[i * 3 + 1] = pose.y;
        pos[i * 3 + 2] = pose.z;
        rest[i * 3] = pose.x;
        rest[i * 3 + 1] = pose.y;
        rest[i * 3 + 2] = pose.z;
        // Free edge slightly heavier so the sheet hangs like paper, not silk.
        var freeBias = 1 - v;
        invMass[i] = 1 / (1 + freeBias * 0.7);
        pinY[i] = pose.y;
      }
    }

    for (var x = 0; x < cols; x++) {
      var top = idx(x, rows - 1);
      invMass[top] = 0;
      pinY[top] = pos[top * 3 + 1];
      if (rows > 1) {
        var soft = idx(x, rows - 2);
        invMass[soft] = 0.12;
        pinY[soft] = pos[soft * 3 + 1];
      }
    }

    prev.set(pos);
    buildConstraints();
    printerAttached = true;
    sleeping = false;
    nanCount = 0;
    maxPosMag = computeMaxPosMag();
    simTime = 0;
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
    if (len < EPSILON) return;

    var w1 = invMass[i];
    var w2 = invMass[j];
    var wSum = w1 + w2;
    if (wSum <= EPSILON) return;

    var stretch = (len - c.rest) / len;
    // Paper: resist stretch/shear hard, allow lengthwise curl.
    var stiffness =
      c.kind === 0 ? 0.68 : c.kind === 1 ? 0.42 : c.kind === 2 ? 0.13 : 0.07;
    var corr = stretch * stiffness;
    var sx = dx * corr;
    var sy = dy * corr;
    var w1n = w1 / wSum;
    var w2n = w2 / wSum;

    if (w1 > 0) {
      pos[ix] += sx * w1n;
      pos[ix + 1] += sy * w1n;
    }
    if (w2 > 0) {
      pos[jx] -= sx * w2n;
      pos[jx + 1] -= sy * w2n;
    }
  }

  function applyPins() {
    if (!printerAttached) return;
    for (var i = 0; i < count; i++) {
      if (invMass[i] === 0) {
        pos[i * 3] = rest[i * 3];
        pos[i * 3 + 1] = rest[i * 3 + 1];
        pos[i * 3 + 2] = rest[i * 3 + 2];
      } else if (invMass[i] > 0 && invMass[i] < 0.2) {
        pos[i * 3] += (rest[i * 3] - pos[i * 3]) * 0.35;
        pos[i * 3 + 1] += (rest[i * 3 + 1] - pos[i * 3 + 1]) * 0.85;
        pos[i * 3 + 2] += (rest[i * 3 + 2] - pos[i * 3 + 2]) * 0.7;
      }
    }
  }

  function applyGrab() {
    if (!grab) return;
    var g = grab;
    var strength = g.strength != null ? g.strength : PAPER_PRESET.grabStiffness;
    var radius = g.radius != null ? g.radius : PAPER_PRESET.grabRadius;
    var maxStep = PAPER_PRESET.maxGrabStep;
    var r2 = radius * radius;
    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        if (printerAttached && iy >= rows - 2) continue;
        var i = idx(ix, iy);
        if (invMass[i] <= 0) continue;
        var dx = ix - g.cx;
        var dy = iy - g.cy;
        var d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        var d = Math.sqrt(d2);
        var t = 1 - d / radius;
        var w = t * t * (3 - 2 * t) * strength;
        var mx = (g.x - pos[i * 3]) * w;
        var my = (g.y - pos[i * 3 + 1]) * w;
        var mlen = Math.sqrt(mx * mx + my * my);
        if (mlen > maxStep) {
          var s = maxStep / mlen;
          mx *= s;
          my *= s;
        }
        pos[i * 3] += mx;
        pos[i * 3 + 1] += my;
        prev[i * 3] = pos[i * 3] - mx * 0.08;
        prev[i * 3 + 1] = pos[i * 3 + 1] - my * 0.08;
      }
    }
  }

  function applyDepthPose() {
    var speed = PAPER_PRESET.flutterSpeed;
    var detail = PAPER_PRESET.flutterDetail;
    var wind = PAPER_PRESET.windStrength;
    // Quiet air draft on paper edges — not fabric flutter.
    var force = PAPER_PRESET.flutterForce * (0.18 + wind * 0.55) * 0.012;

    for (var iy = 0; iy < rows; iy++) {
      var v = iy / segH;
      var freeBias = Math.pow(1 - v, 1.55);
      for (var ix = 0; ix < cols; ix++) {
        var i = idx(ix, iy);
        var p = i * 3;

        if (invMass[i] === 0) {
          pos[p + 2] = rest[p + 2];
          prev[p + 2] = pos[p + 2];
          continue;
        }

        var u = ix / segW;
        var edge = Math.abs(u - 0.5) * 2;
        var wavePhase = simTime * speed + u * 3.1 + v * 2.2;
        var wave = Math.sin(wavePhase) + Math.sin(wavePhase * (1.25 + detail) - edge * 2.1) * 0.28;
        var liftBias = freeBias * (0.35 + edge * edge * 0.65);
        var vx = pos[p] - prev[p];
        var vy = pos[p + 1] - prev[p + 1];
        var motionLift = Math.min(10, Math.sqrt(vx * vx + vy * vy) * 0.28);
        // Sag deepens the natural paper curl when hanging.
        var sagLift = Math.max(0, rest[p + 1] - pos[p + 1]) * 0.38;
        var targetZ =
          rest[p + 2] + wave * force * liftBias + motionLift * (0.08 + freeBias * 0.22) + sagLift;

        if (grab) {
          var gx = ix - grab.cx;
          var gy = iy - grab.cy;
          var gd2 = gx * gx + gy * gy;
          var gr = grab.radius != null ? grab.radius : PAPER_PRESET.grabRadius;
          if (gd2 <= gr * gr) {
            var gt = 1 - Math.sqrt(gd2) / gr;
            targetZ += PAPER_PRESET.grabLift * (0.25 + gt * 0.55);
          }
        }

        pos[p + 2] += (targetZ - pos[p + 2]) * 0.12;
        prev[p + 2] = pos[p + 2];
      }
    }
  }

  function applyWindSway() {
    if (grab) return;
    var wind = PAPER_PRESET.windStrength;
    if (wind <= 0.001) return;

    var basePhase = simTime * (0.35 + wind * 0.28);
    var maxSwing = 1.6 + wind * 6;

    for (var iy = 0; iy < rows; iy++) {
      var freeBias = 1 - iy / Math.max(1, rows - 1);
      if (freeBias <= 0) continue;
      var rowEase = freeBias * freeBias * (3 - 2 * freeBias);

      for (var ix = 0; ix < cols; ix++) {
        var i = idx(ix, iy);
        if (invMass[i] <= 0) continue;

        var p = i * 3;
        var u = ix / Math.max(1, segW);
        var phase = basePhase + u * 1.6 + freeBias * 0.8;
        var gust = Math.sin(phase) + Math.sin(phase * 0.41 - 0.7) * 0.3;
        var swayX = gust * maxSwing * rowEase * (0.35 + Math.abs(u - 0.5) * 0.9);
        var swayY = -Math.abs(Math.sin(phase * 0.55 + 0.5)) * wind * 1.4 * rowEase;
        var targetX = rest[p] + swayX;
        var targetY = rest[p + 1] + swayY;
        var blend = 0.008 + rowEase * (0.006 + wind * 0.008);

        pos[p] += (targetX - pos[p]) * blend;
        pos[p + 1] += (targetY - pos[p + 1]) * blend * 0.7;
      }
    }
  }

  function printerCollision(barY) {
    if (!printerAttached) return;
    for (var i = 0; i < count; i++) {
      if (pos[i * 3 + 1] > barY && invMass[i] > 0) {
        pos[i * 3 + 1] = barY;
      }
    }
  }

  function clampVelocities() {
    var maxV = PAPER_PRESET.maxVertexSpeed;
    for (var i = 0; i < count; i++) {
      if (invMass[i] <= 0) continue;
      var ix = i * 3;
      var vx = pos[ix] - prev[ix];
      var vy = pos[ix + 1] - prev[ix + 1];
      var vz = pos[ix + 2] - prev[ix + 2];
      var sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (sp > maxSpeed) maxSpeed = sp;
      if (sp > maxV && sp > EPSILON) {
        var s = maxV / sp;
        pos[ix] = prev[ix] + vx * s;
        pos[ix + 1] = prev[ix + 1] + vy * s;
        pos[ix + 2] = prev[ix + 2] + vz * s;
      }
    }
  }

  function integrate(dt) {
    var windActive = printerAttached && PAPER_PRESET.windStrength > 0.001;
    if (sleeping && !grab && !windActive) return;
    if (!safetyGuards()) return;

    var damp = 1 - PAPER_PRESET.damping;
    var gy = PAPER_PRESET.gravity;
    simTime += dt;

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
      pos[ix + 1] += vy + gy * dt * dt;
      pos[ix + 2] += vz;
    }

    var inRelease = releaseCooldown > 0 || softRelease;
    var iterCount = inRelease ? Math.min(3, PAPER_PRESET.iterations) : PAPER_PRESET.iterations;
    if (releaseCooldown > 0) releaseCooldown--;
    if (softRelease) {
      softReleaseSteps++;
      if (softReleaseSteps > 16) softRelease = false;
    }

    var sc = PAPER_PRESET.structuralCompliance;
    for (var k = 0; k < iterCount; k++) {
      for (var c = 0; c < constraints.length; c++) {
        var cn = constraints[c];
        if (inRelease && cn.compliance > sc) continue;
        solveDistance(cn, dt);
      }
      applyPins();
      printerCollision(PAPER_PRESET.printerBarY);
    }

    applyGrab();
    applyPins();
    printerCollision(PAPER_PRESET.printerBarY);
    applyWindSway();

    if (!safetyGuards()) return;

    clampVelocities();

    if (!safetyGuards()) return;

    applyDepthPose();

    if (grab) {
      for (var gi = 0; gi < count; gi++) {
        if (invMass[gi] <= 0) continue;
        var g3 = gi * 3;
        prev[g3] = pos[g3];
        prev[g3 + 1] = pos[g3 + 1];
      }
    }

    if (!grab && !softRelease) {
      var pull = PAPER_PRESET.shapeMemory * (printerAttached ? 1 : 0);
      for (var ri = 0; ri < count; ri++) {
        if (invMass[ri] <= 0) continue;
        var rx = ri * 3;
        // Keep XY shape; leave Z curl mostly alone so paper keeps its roll.
        pos[rx] += (rest[rx] - pos[rx]) * pull * 0.55;
        pos[rx + 1] += (rest[rx + 1] - pos[rx + 1]) * pull * 0.85;
        pos[rx + 2] += (rest[rx + 2] - pos[rx + 2]) * pull * 0.35;
      }
    }

    var energy = 0;
    for (var p = 0; p < count; p++) {
      if (invMass[p] <= 0) continue;
      var px = p * 3;
      var vx2 = pos[px] - prev[px];
      var vy2 = pos[px + 1] - prev[px + 1];
      var vz2 = pos[px + 2] - prev[px + 2];
      energy += vx2 * vx2 + vy2 * vy2 + vz2 * vz2;
    }
    sleeping = !grab && !softRelease && !windActive && energy < PAPER_PRESET.sleepThreshold;
  }

  function resetNaN() {
    var bad = false;
    for (var i = 0; i < count * 3; i++) {
      if (!Number.isFinite(pos[i])) {
        nanCount++;
        bad = true;
      }
    }
    if (bad) {
      controlledReset('nan');
    }
  }

  function applyPreset(patch) {
    for (var key in patch) {
      if (Object.prototype.hasOwnProperty.call(PAPER_PRESET, key)) {
        PAPER_PRESET[key] = patch[key];
      }
    }
  }

  function getPreset() {
    return {
      structuralCompliance: PAPER_PRESET.structuralCompliance,
      shearCompliance: PAPER_PRESET.shearCompliance,
      bendCompliance: PAPER_PRESET.bendCompliance,
      damping: PAPER_PRESET.damping,
      windStrength: PAPER_PRESET.windStrength,
      grabStiffness: PAPER_PRESET.grabStiffness,
      grabRadius: PAPER_PRESET.grabRadius,
      gravity: PAPER_PRESET.gravity,
      iterations: PAPER_PRESET.iterations,
      maxVertexSpeed: PAPER_PRESET.maxVertexSpeed,
      maxGrabStep: PAPER_PRESET.maxGrabStep,
    };
  }

  return {
    pos: pos,
    prev: prev,
    rest: rest,
    invMass: invMass,
    count: count,
    cols: cols,
    rows: rows,
    segH: segH,
    width: width,
    height: height,
    idx: idx,
    geomIdx: geomIdx,
    initGrid: initGrid,
    integrate: integrate,
    resetNaN: resetNaN,
    applyPreset: applyPreset,
    syncConstraints: syncConstraints,
    getPreset: getPreset,
    controlledReset: controlledReset,
    get constraintCount() {
      return constraints.length;
    },
    get isSleeping() {
      return sleeping;
    },
    get stats() {
      return {
        nanCount: nanCount,
        maxSpeed: maxSpeed,
        maxPosMag: maxPosMag,
        sleeping: sleeping,
        constraints: constraints.length,
        lastReset: lastResetReason,
        printerAttached: printerAttached,
      };
    },
    setGrab: function (g) {
      grab = g;
      sleeping = false;
      softRelease = false;
    },
    clearGrab: function (options) {
      if (grab) {
        var carryX = options && Number.isFinite(options.carryX) ? options.carryX : 0;
        var carryY = options && Number.isFinite(options.carryY) ? options.carryY : 0;
        var preserveMotion = !!(options && options.preserveMotion);
        var uniformCarry = !!(options && options.uniformCarry);
        releaseCooldown = 12;
        softRelease = true;
        softReleaseSteps = 0;
        for (var i = 0; i < count; i++) {
          if (invMass[i] <= 0) continue;
          var px = i * 3;
          if (preserveMotion) {
            var rowWeight = uniformCarry ? 1 : 0.35 + (1 - Math.floor(i / cols) / Math.max(1, rows - 1)) * 0.65;
            prev[px] = pos[px] - carryX * rowWeight;
            prev[px + 1] = pos[px + 1] - carryY * rowWeight;
          } else {
            prev[px] = pos[px];
            prev[px + 1] = pos[px + 1];
          }
          prev[px + 2] = pos[px + 2];
        }
      }
      grab = null;
      sleeping = false;
    },
    getGrab: function () {
      return grab;
    },
    setPrinterBar: function (y) {
      PAPER_PRESET.printerBarY = y;
    },
    detachFromPrinter: function () {
      printerAttached = false;
      for (var x = 0; x < cols; x++) {
        invMass[idx(x, rows - 1)] = 1;
        if (rows > 1) invMass[idx(x, rows - 2)] = 1;
      }
      sleeping = false;
      softRelease = false;
      releaseCooldown = 0;
    },
    isPrinterAttached: function () {
      return printerAttached;
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
