import * as THREE from 'three';
import { PAPER_PRESET, gridForViewport, isDebugPhysics, isClothTune } from './config.js?v=76';
import { createXPBDSolver } from './xpbd-solver.js?v=76';
import { captureReceiptTexture, measureUvRegions, hitUvRegion } from './texture-capture.js?v=60';
import { createClothSettingsPanel } from './cloth-settings.js?v=76';
import { applyReceiptPerforation, buildReceiptAlphaMask } from './receipt-perforation.js?v=63';

var MAX_DT = PAPER_PRESET.maxFrameDt;
var CAMERA_DISTANCE = 780;
var DEBUG_ENDPOINT = 'http://127.0.0.1:7540/ingest/05f1d2ec-79df-4774-9818-e44340640ea1';
var SESSION_ID = '5a92cc';
var loopCount = 0;
var DETACH_PULL_DOWN = 26;
var DETACH_DISTANCE = 42;
var DROP_CALLBACK_MS = 900;
var DROP_DRIFT_PX_PER_SEC = 560;

function dbgLog(location, message, data, hypothesisId) {
  // #region agent log
  try {
    if (new URLSearchParams(window.location.search).get('debugLog') !== '1') return;
    fetch(DEBUG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        location: location,
        message: message,
        data: data,
        hypothesisId: hypothesisId,
        timestamp: Date.now(),
        runId: 'pre-fix',
      }),
    }).catch(function () {});
  } catch (_e) {
    /* ignore */
  }
  // #endregion
}

function pxToWorldX(px) {
  return px - window.innerWidth * 0.5;
}

function pxToWorldY(px) {
  return -(px - window.innerHeight * 0.5);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createReceiptCloth(options) {
  var canvas = document.querySelector(options.canvas);
  if (!canvas) return null;

  var renderer;
  var scene;
  var camera;
  var mesh;
  var shadowMesh;
  var solver;
  var running = false;
  var rafId = 0;
  var accum = 0;
  var lastNow = 0;
  var uvRegions = null;
  var dragPlane = new THREE.Plane();
  var planeNormal = new THREE.Vector3(0, 0, 1);
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var hitPoint = new THREE.Vector3();
  var grabPointerId = null;
  var grabAnchor = null;
  var meshCenter = { x: 0, y: 0 };
  var meshScale = 1;
  var debugEnabled = isDebugPhysics();
  var debugHud = null;
  var debugPoints = null;
  var frameStats = { fps: 0, frameDt: 0, substeps: 0, frames: 0, lastFpsTime: 0 };
  var onTear = options.onTear || function () {};
  var onVisibilityChange = null;
  var onContextLost = null;
  var onContextRestored = null;
  var simPaused = false;
  var settingsPanel = null;
  var detachedFromPrinter = false;
  var releasedDetachedReceipt = false;
  var dropStartedAt = 0;
  var pendingDropHref = '';
  var tearCallbackSent = false;
  var freeFallActive = false;
  var freeFallVelocity = { x: 0, y: 0, spin: 0 };
  var revealProgress = 1;
  var revealRect = null;
  var hoverState = {
    active: false,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    currentX: 0,
    currentY: 0,
    currentZ: 0,
    prevX: 0,
    prevY: 0,
    targetStepX: 0,
    targetStepY: 0,
    currentStepX: 0,
    currentStepY: 0,
    radius: 0,
    currentRadius: 0,
    cx: 0,
    cy: 0,
  };

  function setupRenderer() {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (_e) {
      dbgLog('receipt-cloth.js:setupRenderer', 'WebGL renderer failed', {}, 'E');
      return false;
    }
    var dpr = Math.min(window.devicePixelRatio, window.innerWidth < 640 ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    return true;
  }

  function updateCamera() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var fov = THREE.MathUtils.radToDeg(2 * Math.atan(h / (2 * CAMERA_DISTANCE)));
    if (!camera) {
      camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 4000);
      camera.position.set(0, 0, CAMERA_DISTANCE);
    } else {
      camera.fov = fov;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function fixReceiptUvs(geometry) {
    var uv = geometry.attributes.uv;
    for (var i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
    }
    uv.needsUpdate = true;
  }

  function buildMesh(texture, alphaCanvas, width, height, segW, segH) {
    var geometry = new THREE.PlaneGeometry(width, height, segW, segH);
    fixReceiptUvs(geometry);
    texture.flipY = false;
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    alphaCanvas = alphaCanvas || null;

    var alphaTexture = null;
    if (alphaCanvas) {
      alphaTexture = new THREE.CanvasTexture(alphaCanvas);
      alphaTexture.flipY = false;
      alphaTexture.needsUpdate = true;
      alphaTexture.colorSpace = THREE.NoColorSpace;
      alphaTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }

    var material = new THREE.MeshBasicMaterial({
      map: texture,
      alphaMap: alphaTexture,
      color: 0xffffff,
      // Paper is viewed from its printed side. Front faces + depth writes avoid
      // transparent self-sorting artifacts when the sheet bends.
      side: THREE.FrontSide,
      transparent: false,
      alphaTest: 0.02,
      depthWrite: true,
    });
    material.toneMapped = false;

    shadowMesh = null;

    mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(1, 1, 1);
    meshScale = 1;
    mesh.renderOrder = 1;
    scene.add(mesh);

    if (debugEnabled) buildDebugHelpers(segW, segH);
  }

  function buildDebugHelpers(segW, segH) {
    debugHud = document.createElement('div');
    debugHud.id = 'physics-debug-hud';
    debugHud.style.cssText =
      'position:fixed;left:8px;top:8px;z-index:9999;font:11px/1.4 monospace;color:#0f0;background:rgba(0,0,0,0.75);padding:8px;pointer-events:none;white-space:pre';
    document.body.appendChild(debugHud);

    var cols = segW + 1;
    var rows = segH + 1;
    var geo = new THREE.BufferGeometry();
    var verts = new Float32Array(cols * rows * 3);
    var colors = new Float32Array(cols * rows * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var mat = new THREE.PointsMaterial({ size: 4, vertexColors: true, depthTest: false });
    debugPoints = new THREE.Points(geo, mat);
    debugPoints.renderOrder = 10;
    scene.add(debugPoints);
  }

  function updateDebugHud(substeps) {
    if (!debugHud || !solver || !mesh) return;
    var st = solver.stats;
    debugHud.textContent =
      'FPS ' +
      frameStats.fps.toFixed(0) +
      '\nframeDt ' +
      (frameStats.frameDt * 1000).toFixed(1) +
      'ms\nsubsteps ' +
      substeps +
      '/' +
      PAPER_PRESET.maxSubsteps +
      '\niterations ' +
      PAPER_PRESET.iterations +
      '\nloops ' +
      loopCount +
      '\nverts ' +
      solver.count +
      '\nconstraints ' +
      st.constraints +
      '\nNaN ' +
      st.nanCount +
      '\nmaxSpeed ' +
      st.maxSpeed.toFixed(1) +
      '\ndrag ' +
      (grabPointerId !== null) +
      '\nsleep ' +
      st.sleeping +
      '\nmeshScale ' +
      mesh.scale.x.toFixed(3) +
      '\nflipY ' +
      mesh.material.map.flipY;
  }

  function updateDebugPoints() {
    if (!debugPoints || !solver) return;
    var attr = debugPoints.geometry.attributes.position;
    var col = debugPoints.geometry.attributes.color;
    var arr = attr.array;
    var carr = col.array;
    var grab = solver.getGrab();
    for (var iy = 0; iy < solver.rows; iy++) {
      for (var ix = 0; ix < solver.cols; ix++) {
        var si = solver.idx(ix, iy);
        var gi = solver.geomIdx(ix, iy);
        arr[gi * 3] = solver.pos[si * 3] + mesh.position.x;
        arr[gi * 3 + 1] = solver.pos[si * 3 + 1] + mesh.position.y;
        arr[gi * 3 + 2] = 2;
        var r = 0.2;
        var g = 0.8;
        var b = 0.2;
        if (solver.invMass[si] === 0) {
          r = 1;
          g = 0.2;
          b = 0.2;
        } else if (solver.invMass[si] > 0 && solver.invMass[si] < 0.2) {
          r = 1;
          g = 0.55;
          b = 0.1;
        }
        if (grab && Math.abs(ix - grab.cx) <= grab.radius && Math.abs(iy - grab.cy) <= grab.radius) {
          r = 0.2;
          g = 1;
          b = 0.3;
        }
        carr[gi * 3] = r;
        carr[gi * 3 + 1] = g;
        carr[gi * 3 + 2] = b;
      }
    }
    attr.needsUpdate = true;
    col.needsUpdate = true;
  }

  function syncMeshFromSolver(computeNormals) {
    if (!mesh || !solver) return;
    var attr = mesh.geometry.attributes.position;
    var arr = attr.array;
    var sp = solver.pos;
    var cols = solver.cols;
    var rows = solver.rows;
    for (var iy = 0; iy < rows; iy++) {
      for (var ix = 0; ix < cols; ix++) {
        var si = solver.idx(ix, iy);
        var gi = ix + cols * (solver.segH - iy);
        arr[gi * 3] = sp[si * 3];
        arr[gi * 3 + 1] = sp[si * 3 + 1];
        arr[gi * 3 + 2] = sp[si * 3 + 2];
      }
    }
    attr.needsUpdate = true;
    if (computeNormals) mesh.geometry.computeVertexNormals();
  }

  function updateRevealClip() {
    if (!canvas || !revealRect || revealProgress >= 0.999) {
      canvas.style.removeProperty('clip-path');
      return;
    }

    var topInset = Math.max(0, Math.floor(revealRect.top - 4));
    var revealBottom = revealRect.top + Math.max(10, revealRect.height * revealProgress);
    var bottomInset = Math.max(0, Math.ceil(window.innerHeight - revealBottom));
    canvas.style.clipPath = 'inset(' + topInset + 'px 0 ' + bottomInset + 'px 0)';
  }

  function setCanvasInteractionState(state) {
    canvas.classList.toggle('is-hovering', state === 'hover');
    canvas.classList.toggle('is-dragging', state === 'drag');
  }

  function resetHover(immediate) {
    hoverState.active = false;
    hoverState.targetStepX = 0;
    hoverState.targetStepY = 0;
    hoverState.radius = 0;
    hoverState.targetZ = 0;

    if (immediate) {
      hoverState.targetX = 0;
      hoverState.targetY = 0;
      hoverState.currentX = 0;
      hoverState.currentY = 0;
      hoverState.currentZ = 0;
      hoverState.currentStepX = 0;
      hoverState.currentStepY = 0;
      hoverState.currentRadius = 0;
      hoverState.prevX = 0;
      hoverState.prevY = 0;
    } else {
      hoverState.targetX = hoverState.currentX;
      hoverState.targetY = hoverState.currentY;
    }
  }

  function updateHoverTarget(hit) {
    if (!hit || !hit.uv || !mesh || detachedFromPrinter || releasedDetachedReceipt) {
      resetHover(false);
      setCanvasInteractionState('');
      return;
    }

    var localX = hit.point.x - mesh.position.x;
    var localY = hit.point.y - mesh.position.y;
    var hoverVertex = solver.nearestVertex(localX, localY);
    var hoverGrid = solver.vertexToGrid(hoverVertex);

    if (!hoverState.active) {
      hoverState.currentX = localX;
      hoverState.currentY = localY;
      hoverState.prevX = localX;
      hoverState.prevY = localY;
    }

    hoverState.active = true;
    hoverState.targetStepX = localX - hoverState.prevX;
    hoverState.targetStepY = localY - hoverState.prevY;
    hoverState.prevX = localX;
    hoverState.prevY = localY;
    hoverState.targetX = localX;
    hoverState.targetY = localY;
    hoverState.targetZ = 4.5 + Math.max(0, 1 - Math.abs(hit.uv.x - 0.5) * 1.2) * 2;
    hoverState.radius = Math.max(3, PAPER_PRESET.grabRadius * 1.25);
    hoverState.cx = hoverGrid.ix;
    hoverState.cy = Math.min(hoverGrid.iy, solver.rows - 3);
    setCanvasInteractionState('hover');
  }

  function applyHoverField(dt) {
    if (!solver || grabPointerId !== null || detachedFromPrinter || releasedDetachedReceipt) return;

    var easing = 1 - Math.exp(-dt * 20);
    hoverState.currentX += (hoverState.targetX - hoverState.currentX) * easing;
    hoverState.currentY += (hoverState.targetY - hoverState.currentY) * easing;
    hoverState.currentZ += (hoverState.targetZ - hoverState.currentZ) * easing;
    hoverState.currentStepX += (hoverState.targetStepX - hoverState.currentStepX) * easing;
    hoverState.currentStepY += (hoverState.targetStepY - hoverState.currentStepY) * easing;
    hoverState.currentRadius += (hoverState.radius - hoverState.currentRadius) * easing;

    if (!hoverState.active && hoverState.currentRadius < 0.08 && Math.abs(hoverState.currentZ) < 0.08) {
      hoverState.currentRadius = 0;
      hoverState.currentZ = 0;
      hoverState.currentStepX = 0;
      hoverState.currentStepY = 0;
      return;
    }

    var radius = hoverState.currentRadius;
    if (radius <= 0.08) return;

    var hoverZ = hoverState.currentZ;
    var dragX = clamp(hoverState.currentStepX, -1.4, 1.4);
    var dragY = clamp(hoverState.currentStepY, -1.4, 1.4);
    var influenceScale = Math.min(1, dt * 42);
    var minY = solver.rows - 2;

    for (var iy = Math.max(0, hoverState.cy - Math.ceil(radius)); iy < Math.min(solver.rows, hoverState.cy + Math.ceil(radius) + 1); iy++) {
      if (iy >= minY) continue;

      for (var ix = Math.max(0, hoverState.cx - Math.ceil(radius)); ix < Math.min(solver.cols, hoverState.cx + Math.ceil(radius) + 1); ix++) {
        var vi = solver.idx(ix, iy);
        if (solver.invMass[vi] <= 0) continue;

        var dx = ix - hoverState.cx;
        var dy = iy - hoverState.cy;
        var dist = Math.sqrt(dx * dx + dy * dy * 0.85);
        if (dist > radius) continue;

        var falloff = Math.max(0, 1 - dist / radius);
        var pinch = falloff * falloff * (3 - 2 * falloff);
        var pi = vi * 3;
        var targetZ = solver.rest[pi + 2] + hoverZ * pinch;
        var shiftX = dragX * pinch * 0.022 * influenceScale;
        var shiftY = dragY * pinch * 0.022 * influenceScale;
        var shiftZ = (targetZ - solver.pos[pi + 2]) * 0.11 * influenceScale;

        // Move pos and prev together: bounded hover shape, no injected velocity/creep.
        solver.pos[pi] += shiftX;
        solver.pos[pi + 1] += shiftY;
        solver.pos[pi + 2] += shiftZ;
        solver.prev[pi] += shiftX;
        solver.prev[pi + 1] += shiftY;
        solver.prev[pi + 2] += shiftZ;
      }
    }

    hoverState.targetStepX *= 0.8;
    hoverState.targetStepY *= 0.8;
    hoverState.currentStepX *= 0.86;
    hoverState.currentStepY *= 0.86;
  }

  function physicsStep(dt) {
    if (freeFallActive) {
      applyFreeFall(dt);
      return;
    }
    applyHoverField(dt);
    solver.integrate(dt);
    solver.resetNaN();
  }

  function tick(now) {
    if (!running) return;
    if (!lastNow) lastNow = now;
    var frameDt = Math.min((now - lastNow) / 1000, MAX_DT);
    lastNow = now;
    frameStats.frameDt = frameDt;

    if (!document.hidden && !simPaused) {
      accum += frameDt;
      var sub = 0;
      while (accum >= PAPER_PRESET.fixedDt && sub < PAPER_PRESET.maxSubsteps) {
        physicsStep(PAPER_PRESET.fixedDt);
        accum -= PAPER_PRESET.fixedDt;
        sub++;
      }
      frameStats.substeps = sub;
      syncMeshFromSolver(true);
      if (debugEnabled) updateDebugPoints();
      renderer.render(scene, camera);

      frameStats.frames++;
      if (now - frameStats.lastFpsTime > 500) {
        frameStats.fps = (frameStats.frames * 1000) / (now - frameStats.lastFpsTime);
        frameStats.frames = 0;
        frameStats.lastFpsTime = now;
      if (debugEnabled) updateDebugHud(sub);
        // #region agent log
        dbgLog(
          'receipt-cloth.js:tick',
          'frame sample',
          {
            fps: frameStats.fps,
            substeps: sub,
            meshScaleX: mesh ? mesh.scale.x : null,
            maxSpeed: solver ? solver.stats.maxSpeed : null,
            sleeping: solver ? solver.stats.sleeping : null,
          },
          'C'
        );
        // #endregion
      }

      if (releasedDetachedReceipt && !tearCallbackSent && now - dropStartedAt > DROP_CALLBACK_MS) {
        tearCallbackSent = true;
        onTear(pendingDropHref);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function screenToPointer(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function raycastMesh(event) {
    screenToPointer(event);
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObject(mesh);
    if (!hits.length) return null;
    return hits[0];
  }

  function applySheetDrag(deltaX, deltaY) {
    if (!solver || !grabAnchor) return;
    var detached = detachedFromPrinter || !solver.isPrinterAttached();
    var limitedX = clamp(
      deltaX,
      -PAPER_PRESET.maxGrabStep * (detached ? 1.05 : 1.15),
      PAPER_PRESET.maxGrabStep * (detached ? 1.05 : 1.15)
    );
    var limitedY = clamp(
      deltaY,
      -PAPER_PRESET.maxGrabStep * (detached ? 1.15 : 1.3),
      PAPER_PRESET.maxGrabStep * (detached ? 1.15 : 1.3)
    );
    var rowSpan = Math.max(1, solver.rows - 1);
    var anchorRadius = Math.max(4, grabAnchor.radius * 2.75);

    for (var iy = 0; iy < solver.rows; iy++) {
      if (!detached && iy >= solver.rows - 2) continue;
      var rowT = iy / rowSpan;
      var rowWeight = detached
        ? 0.68 + Math.pow(rowT, 0.42) * 0.32
        : 0.42 + Math.pow(1 - rowT, 0.58) * 0.58;
      for (var ix = 0; ix < solver.cols; ix++) {
        var vi = solver.idx(ix, iy);
        if (solver.invMass[vi] <= 0) continue;

        var offsetX = ix - grabAnchor.cx;
        var offsetY = iy - grabAnchor.cy;
        var distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY * 0.9);
        var anchorWeight = Math.max(0, 1 - distance / anchorRadius);
        var influence = detached
          ? clamp(0.56 + rowWeight * 0.14 + anchorWeight * 0.3, 0.45, 1)
          : rowWeight * (0.74 + anchorWeight * 0.26);
        var pi = vi * 3;
        var moveX = limitedX * influence;
        var moveY = limitedY * influence;

        solver.pos[pi] += moveX;
        solver.pos[pi + 1] += moveY;
        solver.prev[pi] = solver.pos[pi] - moveX * 0.42;
        solver.prev[pi + 1] = solver.pos[pi + 1] - moveY * 0.42;
      }
    }
  }

  function shouldDetachFromPrinter() {
    if (!grabAnchor || !grabAnchor.canTear || detachedFromPrinter) return false;
    return grabAnchor.maxPullDown > DETACH_PULL_DOWN && grabAnchor.maxDistance > DETACH_DISTANCE;
  }

  function detachFromPrinter() {
    if (detachedFromPrinter || !solver) return;
    detachedFromPrinter = true;
    pendingDropHref =
      (grabAnchor && grabAnchor.tearHref) || (uvRegions && uvRegions.tear ? uvRegions.tear.href : '');
    solver.detachFromPrinter();
  }

  function applyDetachedDrift(dt) {
    if (!solver) return;
    var dropStep = DROP_DRIFT_PX_PER_SEC * dt;
    for (var iy = 0; iy < solver.rows; iy++) {
      for (var ix = 0; ix < solver.cols; ix++) {
        var vi = solver.idx(ix, iy);
        if (solver.invMass[vi] <= 0) continue;
        var pi = vi * 3;
        solver.pos[pi + 1] -= dropStep;
        solver.prev[pi + 1] -= dropStep * 0.72;
      }
    }
  }

  function applyFreeFall(dt) {
    if (!mesh) return;

    freeFallVelocity.y += PAPER_PRESET.gravity * 42 * dt;
    mesh.position.x += freeFallVelocity.x * dt;
    mesh.position.y += freeFallVelocity.y * dt;
    mesh.rotation.z += freeFallVelocity.spin * dt;
    freeFallVelocity.x *= 0.995;
    freeFallVelocity.spin *= 0.992;
  }

  function onPointerDown(event) {
    if (releasedDetachedReceipt) return;
    if (event.button !== 0) return;
    var hit = raycastMesh(event);
    if (!hit) return;
    var region = null;

    if (hit.uv && uvRegions) {
      region = hitUvRegion(uvRegions, hit.uv.x, hit.uv.y);
    }

    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, hit.point);

    var lx = hit.point.x - mesh.position.x;
    var ly = hit.point.y - mesh.position.y;
    var vi = solver.nearestVertex(lx, ly);
    var g = solver.vertexToGrid(vi);
    if (g.iy >= solver.rows - 2) {
      g.iy = Math.max(0, solver.rows - 4);
    }

    resetHover(true);
    grabPointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    setCanvasInteractionState('drag');
    grabAnchor = {
      cx: g.ix,
      cy: g.iy,
      radius: PAPER_PRESET.grabRadius,
      strength: PAPER_PRESET.grabStiffness,
      startX: lx,
      startY: ly,
      prevX: lx,
      prevY: ly,
      lastStepX: 0,
      lastStepY: 0,
      maxDistance: 0,
      maxPullDown: 0,
      canTear: true,
      tearHref:
        region && region.type === 'tear'
          ? region.href
          : uvRegions && uvRegions.tear
            ? uvRegions.tear.href
            : '',
    };
    solver.setGrab({
      cx: grabAnchor.cx,
      cy: grabAnchor.cy,
      radius: grabAnchor.radius,
      strength: grabAnchor.strength,
      x: lx,
      y: ly,
      z: hit.point.z - mesh.position.z + PAPER_PRESET.grabLift,
    });
    // #region agent log
    dbgLog('receipt-cloth.js:onPointerDown', 'grab start', { cx: g.ix, cy: g.iy, uvY: hit.uv ? hit.uv.y : null }, 'D');
    // #endregion
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (grabPointerId === null || !grabAnchor) {
      if (releasedDetachedReceipt) return;
      updateHoverTarget(raycastMesh(event));
      return;
    }
    if (grabPointerId !== event.pointerId) return;
    screenToPointer(event);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return;
    var localX = hitPoint.x - mesh.position.x;
    var localY = hitPoint.y - mesh.position.y;
    var stepX = localX - grabAnchor.prevX;
    var stepY = localY - grabAnchor.prevY;
    grabAnchor.prevX = localX;
    grabAnchor.prevY = localY;
    grabAnchor.lastStepX = stepX;
    grabAnchor.lastStepY = stepY;
    grabAnchor.maxPullDown = Math.max(grabAnchor.maxPullDown, grabAnchor.startY - localY);
    grabAnchor.maxDistance = Math.max(
      grabAnchor.maxDistance,
      Math.hypot(localX - grabAnchor.startX, localY - grabAnchor.startY)
    );
    if (shouldDetachFromPrinter()) detachFromPrinter();
    applySheetDrag(stepX, stepY);

    solver.setGrab({
      cx: grabAnchor.cx,
      cy: grabAnchor.cy,
      radius: detachedFromPrinter ? grabAnchor.radius + 1.2 : grabAnchor.radius,
      strength: detachedFromPrinter ? grabAnchor.strength * 0.82 : grabAnchor.strength,
      x: localX,
      y: localY,
      z: hitPoint.z - mesh.position.z + PAPER_PRESET.grabLift,
    });
  }

  function endGrab(event, clearOptions) {
    if (event && grabPointerId !== event.pointerId) return;
    solver.clearGrab(clearOptions);
    grabPointerId = null;
    grabAnchor = null;
    setCanvasInteractionState('');
    if (event) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (_e) {
        /* ignore */
      }
    }
  }

  function releaseDetachedReceipt(event) {
    if (!grabAnchor) {
      endGrab(event, null);
      return;
    }
    pendingDropHref = grabAnchor.tearHref || pendingDropHref;
    releasedDetachedReceipt = true;
    freeFallActive = true;
    resetHover(true);
    setCanvasInteractionState('');
    freeFallVelocity.x = clamp(grabAnchor.lastStepX * 12, -180, 180);
    freeFallVelocity.y = Math.min(-320, grabAnchor.lastStepY * 10 - 280);
    freeFallVelocity.spin = clamp(-grabAnchor.lastStepX * 0.08, -1, 1);
    dropStartedAt = performance.now();
    tearCallbackSent = false;
    endGrab(event, null);
  }

  function onPointerUp(event) {
    if (detachedFromPrinter) {
      releaseDetachedReceipt(event);
      return;
    }
    endGrab(event, null);
  }

  function onPointerCancel(event) {
    if (detachedFromPrinter) {
      releaseDetachedReceipt(event);
      return;
    }
    endGrab(event, null);
  }

  function onPointerLeave() {
    if (grabPointerId !== null) return;
    resetHover(false);
    setCanvasInteractionState('');
  }

  function attachInteraction() {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', onBlur);
  }

  function onBlur() {
    if (detachedFromPrinter) {
      releaseDetachedReceipt(null);
      return;
    }
    resetHover(true);
    setCanvasInteractionState('');
    endGrab(null, null);
  }

  function detachInteraction() {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('blur', onBlur);
  }

  function onResize() {
    if (!renderer) return;
    updateCamera();
    var dpr = Math.min(window.devicePixelRatio, window.innerWidth < 640 ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    // #region agent log
    dbgLog('receipt-cloth.js:onResize', 'resize', { meshScaleX: mesh ? mesh.scale.x : null, dpr: dpr }, 'B');
    // #endregion
  }

  return {
    init: async function (sourceScroll, options) {
      if (!setupRenderer()) return false;

      scene = new THREE.Scene();
      updateCamera();
      window.addEventListener('resize', onResize, { passive: true });

      onVisibilityChange = function () {
        if (document.hidden) {
          accum = 0;
          lastNow = 0;
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      onContextLost = function (e) {
        e.preventDefault();
        simPaused = true;
        running = false;
        dbgLog('receipt-cloth.js:contextlost', 'WebGL context lost', {}, 'E');
      };
      onContextRestored = function () {
        simPaused = false;
        if (!running) {
          running = true;
          rafId = requestAnimationFrame(tick);
        }
        dbgLog('receipt-cloth.js:contextrestored', 'WebGL context restored', {}, 'E');
      };
      canvas.addEventListener('webglcontextlost', onContextLost);
      canvas.addEventListener('webglcontextrestored', onContextRestored);

      var article = sourceScroll.querySelector('.receipt');
      if (!article) return false;
      detachedFromPrinter = false;
      releasedDetachedReceipt = false;
      freeFallActive = false;
      freeFallVelocity.x = 0;
      freeFallVelocity.y = 0;
      freeFallVelocity.spin = 0;
      dropStartedAt = 0;
      pendingDropHref = '';
      tearCallbackSent = false;
      grabPointerId = null;
      grabAnchor = null;
      resetHover(true);
      setCanvasInteractionState('');

      var providedRect = options && options.rect;
      var rect = providedRect || article.getBoundingClientRect();
      var perforation = applyReceiptPerforation(article);
      var captured = await captureReceiptTexture(article);
      uvRegions = measureUvRegions(article);
      revealRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
      revealProgress = 1;

      var grid = gridForViewport();
      var cx = pxToWorldX(rect.left + rect.width * 0.5);
      var cy = pxToWorldY(rect.top + rect.height * 0.5);
      meshCenter.x = cx;
      meshCenter.y = cy;

      solver = createXPBDSolver(grid.segW, grid.segH, captured.width, captured.height);
      solver.initGrid(0, 0);
      var barLocal = pxToWorldY(rect.top) - cy;
      solver.setPrinterBar(barLocal);
      solver.setFeedProgress(1);
      updateRevealClip();

      var tex = new THREE.CanvasTexture(captured.canvas);
      var alphaCanvas = buildReceiptAlphaMask(captured.width, captured.height, perforation);
      buildMesh(tex, alphaCanvas, captured.width, captured.height, grid.segW, grid.segH);
      mesh.position.set(cx, cy, 0);
      syncMeshFromSolver(true);

      // #region agent log
      dbgLog(
        'receipt-cloth.js:init',
        'cloth initialized',
        {
          flipY: tex.flipY,
          uvTop: mesh.geometry.attributes.uv.getY(0),
          uvBottom: mesh.geometry.attributes.uv.getY(mesh.geometry.attributes.uv.count - 1),
          meshW: captured.width,
          meshH: captured.height,
          segW: grid.segW,
          segH: grid.segH,
          constraints: solver.constraintCount,
          barLocal: barLocal,
          topVertexY: solver.pos[solver.idx(0, solver.segH) * 3 + 1],
          bottomVertexY: solver.pos[solver.idx(0, 0) * 3 + 1],
        },
        'A'
      );
      // #endregion

      canvas.classList.add('is-active');
      attachInteraction();

      if (settingsPanel) {
        settingsPanel.destroy();
        settingsPanel = null;
      }
      // Production: no settings UI. Dev-only via ?clothTune=1
      if (isClothTune()) {
        settingsPanel = createClothSettingsPanel({
          solver: solver,
          visible: true,
        });
      }

      return true;
    },

    start: function () {
      if (running) {
        dbgLog('receipt-cloth.js:start', 'duplicate start blocked', { loopCount: loopCount }, 'C');
        return;
      }
      running = true;
      loopCount++;
      lastNow = 0;
      accum = 0;
      rafId = requestAnimationFrame(tick);
      dbgLog('receipt-cloth.js:start', 'loop started', { loopCount: loopCount }, 'C');
    },

    stop: function () {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      detachInteraction();
    },

    destroy: function () {
      this.stop();
      window.removeEventListener('resize', onResize);
      if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (debugHud) debugHud.remove();
      if (settingsPanel) {
        settingsPanel.destroy();
        settingsPanel = null;
      }
      if (mesh) {
        mesh.geometry.dispose();
        mesh.material.map.dispose();
        if (mesh.material.alphaMap) mesh.material.alphaMap.dispose();
        mesh.material.dispose();
      }
      if (shadowMesh) shadowMesh.material.dispose();
      if (renderer) renderer.dispose();
      freeFallActive = false;
      freeFallVelocity.x = 0;
      freeFallVelocity.y = 0;
      freeFallVelocity.spin = 0;
      resetHover(true);
      setCanvasInteractionState('');
      canvas.classList.remove('is-active');
      canvas.style.removeProperty('clip-path');
      canvas.style.removeProperty('pointer-events');
    },

    hideDom: function (scrollEl) {
      var paper = scrollEl.querySelector('.receipt');
      if (paper) paper.style.visibility = 'hidden';
    },

    setRevealProgress: function (progress) {
      revealProgress = clamp(progress, 0, 1);
      if (solver && solver.setFeedProgress) {
        // Lead physics extrusion slightly ahead of the clip so the free edge sways.
        var feed = revealProgress <= 0 ? 0.02 : Math.min(1, revealProgress * 1.04);
        solver.setFeedProgress(feed);
      }
      updateRevealClip();
    },
  };
}
