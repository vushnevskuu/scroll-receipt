import * as THREE from 'three';
import { LAB_CONFIG, labPhaseFromUrl, debugPhysicsEnabled, isClothTune } from './config.js';
import { createLabSolver } from './solver.js';
import { createClothSettingsPanel } from '../cloth/cloth-settings.js?v=35';

var DEBUG_ENDPOINT = 'http://127.0.0.1:7540/ingest/05f1d2ec-79df-4774-9818-e44340640ea1';
var SESSION_ID = '5a92cc';
var animationLoopCount = 0;
var rendererCount = 0;

function dbgLog(_location, _message, _data) {
  // #region agent log
  // Disabled by default — add ?debugLog=1 to enable (avoids fetch spam / lag).
  try {
    if (new URLSearchParams(window.location.search).get('debugLog') !== '1') return;
    fetch(DEBUG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        location: _location,
        message: _message,
        data: _data,
        timestamp: Date.now(),
        runId: 'physics-lab',
      }),
    }).catch(function () {});
  } catch (_e) {
    /* ignore */
  }
  // #endregion
}

function createHud() {
  var el = document.createElement('div');
  el.id = 'physics-debug-hud';
  el.style.cssText =
    'position:fixed;left:8px;top:8px;z-index:10000;font:12px/1.45 ui-monospace,monospace;color:#6f6;padding:10px 12px;background:rgba(0,0,0,0.82);border:1px solid #363;pointer-events:none;white-space:pre;min-width:220px';
  document.body.appendChild(el);
  return el;
}

function boot() {
  var canvas = document.getElementById('lab-canvas');
  var phase = labPhaseFromUrl();
  var hudVisible = debugPhysicsEnabled();
  var hud = hudVisible ? createHud() : null;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    rendererCount = 1;
  } catch (e) {
    document.body.innerHTML = '<p style="color:#f66;font-family:monospace;padding:24px">WebGL unavailable</p>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x111111, 1);

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-8, 8, 10, -6, 0.1, 100);
  camera.position.set(0, 0, 20);
  camera.zoom = 1;
  camera.updateProjectionMatrix();

  scene.add(new THREE.AxesHelper(2));
  var grid = new THREE.GridHelper(16, 16, 0x444444, 0x222222);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  var solver = createLabSolver(LAB_CONFIG.segW, LAB_CONFIG.segH, LAB_CONFIG.sheetWidth, LAB_CONFIG.sheetHeight, phase);

  var geometry = new THREE.PlaneGeometry(LAB_CONFIG.sheetWidth, LAB_CONFIG.sheetHeight, LAB_CONFIG.segW, LAB_CONFIG.segH);
  var colors = new Float32Array(geometry.attributes.position.count * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  var material = new THREE.MeshBasicMaterial({ wireframe: true, vertexColors: true, side: THREE.DoubleSide });
  var mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(1, 1, 1);
  scene.add(mesh);

  var bbox = new THREE.Box3().setFromObject(mesh);
  var boxHelper = new THREE.Box3Helper(bbox, 0x6688ff);
  scene.add(boxHelper);

  var dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var localPoint = new THREE.Vector3();
  var grabPointerId = null;
  var grabAnchor = null;
  var settingsPanel = null;

  var running = false;
  var rafId = 0;
  var accum = 0;
  var lastNow = 0;
  var lastHud = 0;
  var frameStats = { fps: 0, frames: 0, substeps: 0 };

  function updateHud(now) {
    if (!hudVisible) return;
    var st = solver.stats;
    hud.textContent =
      'PHYSICS LAB phase ' +
      phase +
      '\nFPS ' +
      frameStats.fps.toFixed(0) +
      '\nframeDelta ' +
      (frameStats.frameDt * 1000).toFixed(2) +
      'ms\naccumulator ' +
      accum.toFixed(5) +
      '\nsubsteps ' +
      frameStats.substeps +
      '/' +
      LAB_CONFIG.maxSubsteps +
      '\nsolverIterations ' +
      LAB_CONFIG.iterations +
      '\nvertexCount ' +
      solver.count +
      '\nconstraintCount ' +
      st.constraintCount +
      '\nactiveGrabConstraints ' +
      st.activeGrab +
      '\nmaxVertexSpeed ' +
      st.maxSpeed.toFixed(3) +
      '\nmaxPositionMagnitude ' +
      st.maxPosMag.toFixed(3) +
      '\ninvalidValueCount ' +
      st.invalidCount +
      '\nanimationLoopCount ' +
      animationLoopCount +
      '\nrendererCount ' +
      rendererCount +
      '\nmeshScale ' +
      mesh.scale.x.toFixed(3) +
      '\ncameraZoom ' +
      camera.zoom.toFixed(3) +
      '\nphysicsState ' +
      st.physicsState;
  }

  function syncMesh() {
    solver.syncToGeometry(geometry.attributes.position.array);
    geometry.attributes.position.needsUpdate = true;
    solver.vertexColors(colors, LAB_CONFIG.speedHighlight);
    geometry.attributes.color.needsUpdate = true;
    bbox.setFromObject(mesh);
    boxHelper.box.copy(bbox);
  }

  function stepPhysics(dt) {
    solver.integrate(dt);
  }

  function tick(now) {
    if (!running) return;
    if (!lastNow) lastNow = now;
    var frameDt = Math.min((now - lastNow) / 1000, LAB_CONFIG.maxFrameDt);
    lastNow = now;
    frameStats.frameDt = frameDt;

    if (!document.hidden) {
      accum += frameDt;
      var sub = 0;
      while (accum >= LAB_CONFIG.fixedDt && sub < LAB_CONFIG.maxSubsteps) {
        stepPhysics(LAB_CONFIG.fixedDt);
        accum -= LAB_CONFIG.fixedDt;
        sub++;
      }
      if (sub >= LAB_CONFIG.maxSubsteps) accum = 0;
      frameStats.substeps = sub;
      syncMesh();
      renderer.render(scene, camera);

      frameStats.frames++;
      if (now - lastHud > 250) {
        frameStats.fps = (frameStats.frames * 1000) / (now - lastHud);
        frameStats.frames = 0;
        lastHud = now;
        updateHud(now);
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function screenToNdc(event) {
    var rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(event) {
    if (phase < 5 || event.button !== 0) return;
    screenToNdc(event);
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObject(mesh);
    if (!hits.length) return;
    var hit = hits[0];
    mesh.worldToLocal(localPoint.copy(hit.point));
    var vi = solver.nearestVertex(localPoint.x, localPoint.y);
    var g = solver.vertexToGrid(vi);
    if (g.iy <= 0) return;
    grabPointerId = event.pointerId;
    grabAnchor = { cx: g.ix, cy: g.iy, radius: LAB_CONFIG.grabRadius };
    solver.setGrab({
      cx: g.ix,
      cy: g.iy,
      radius: LAB_CONFIG.grabRadius,
      x: localPoint.x,
      y: localPoint.y,
    });
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (grabPointerId !== event.pointerId || !grabAnchor) return;
    screenToNdc(event);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, localPoint)) return;
    mesh.worldToLocal(localPoint);
    solver.setGrab({
      cx: grabAnchor.cx,
      cy: grabAnchor.cy,
      radius: LAB_CONFIG.grabRadius,
      x: localPoint.x,
      y: localPoint.y,
    });
  }

  function endGrab(event) {
    if (event && grabPointerId !== event.pointerId) return;
    solver.clearGrab();
    grabPointerId = null;
    grabAnchor = null;
    if (event) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (_e) {
        /* ignore */
      }
    }
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.updateProjectionMatrix();
    dbgLog('lab.js:resize', 'resize', { meshScale: mesh.scale.x, vertexCount: solver.count });
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endGrab);
  canvas.addEventListener('pointercancel', endGrab);
  window.addEventListener('blur', function () {
    endGrab(null);
  });
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) accum = 0;
  });

  syncMesh();
  updateHud(performance.now());
  dbgLog('lab.js:boot', 'lab-started', { phase: phase, constraints: solver.constraintCount, hud: !!hud });

  if (settingsPanel) settingsPanel.destroy();
  settingsPanel = createClothSettingsPanel({
    solver: solver,
    visible: isClothTune() || debugPhysicsEnabled(),
  });

  if (animationLoopCount > 0) {
    dbgLog('lab.js:boot', 'duplicate-loop-warning', { animationLoopCount: animationLoopCount });
  }
  animationLoopCount++;
  running = true;
  rafId = requestAnimationFrame(tick);
}

boot();
