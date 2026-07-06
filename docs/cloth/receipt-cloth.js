import * as THREE from 'three';
import { PAPER_PRESET, gridForViewport } from './config.js';
import { createXPBDSolver } from './xpbd-solver.js';
import { captureReceiptTexture, measureUvRegions, hitUvRegion } from './texture-capture.js';

var MAX_DT = PAPER_PRESET.maxFrameDt;

function pxToWorldX(px) {
  return px - window.innerWidth * 0.5;
}

function pxToWorldY(px) {
  return -(px - window.innerHeight * 0.5);
}

export function createReceiptCloth(options) {
  var canvas = document.querySelector(options.canvas);
  if (!canvas) return null;

  var renderer;
  var scene;
  var camera;
  var mesh;
  var solver;
  var running = false;
  var rafId = 0;
  var accum = 0;
  var lastNow = 0;
  var uvRegions = null;
  var dragPlane = new THREE.Plane();
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var hitPoint = new THREE.Vector3();
  var grabPointerId = null;
  var meshCenter = { x: 0, y: 0 };
  var onDownload = options.onDownload || function () {};
  var domFallback = options.domFallback;

  function setupRenderer() {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (_e) {
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return true;
  }

  function updateCamera() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    camera = new THREE.OrthographicCamera(-w * 0.5, w * 0.5, h * 0.5, -h * 0.5, 0.1, 3000);
    camera.position.z = 800;
  }

  function buildMesh(texture, width, height, segW, segH) {
    var geometry = new THREE.PlaneGeometry(width, height, segW, segH);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    var material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xfffaf2,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    var ambient = new THREE.AmbientLight(0xffffff, 0.55);
    var key = new THREE.DirectionalLight(0xfff8ee, 0.85);
    key.position.set(0.3, 1, 1.2);
    scene.add(ambient);
    scene.add(key);
  }

  function syncMeshFromSolver() {
    if (!mesh || !solver) return;
    var attr = mesh.geometry.attributes.position;
    var arr = attr.array;
    var sp = solver.pos;
    for (var i = 0; i < solver.count; i++) {
      arr[i * 3] = sp[i * 3];
      arr[i * 3 + 1] = sp[i * 3 + 1];
      arr[i * 3 + 2] = sp[i * 3 + 2];
    }
    attr.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  function step(dt) {
    solver.integrate(dt);
    solver.resetNaN();
    syncMeshFromSolver();
  }

  function tick(now) {
    if (!running) return;
    if (!lastNow) lastNow = now;
    var frameDt = Math.min((now - lastNow) / 1000, MAX_DT);
    lastNow = now;

    if (!document.hidden) {
      accum += frameDt;
      var sub = 0;
      while (accum >= PAPER_PRESET.fixedDt && sub < PAPER_PRESET.maxSubsteps) {
        step(PAPER_PRESET.fixedDt);
        accum -= PAPER_PRESET.fixedDt;
        sub++;
      }
      renderer.render(scene, camera);
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

  function onPointerDown(event) {
    if (event.button !== 0) return;
    var hit = raycastMesh(event);
    if (!hit) return;

    if (hit.uv && uvRegions) {
      var region = hitUvRegion(uvRegions, hit.uv.x, hit.uv.y);
      if (region) {
        if (region.type === 'download') {
          onDownload();
          var a = document.createElement('a');
          a.href = region.href;
          a.download = '';
          a.click();
        } else if (region.type === 'link') {
          window.location.href = region.href;
        }
        return;
      }
    }

    if (hit.uv.y < 0.08) return;

    grabPointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), hit.point);

    var vi = solver.nearestVertex(hit.point.x - meshCenter.x, hit.point.y - meshCenter.y);
    var g = solver.vertexToGrid(vi);
    solver.setGrab({
      cx: g.ix,
      cy: g.iy,
      radius: PAPER_PRESET.grabRadius,
      strength: PAPER_PRESET.grabStiffness,
      x: hit.point.x - meshCenter.x,
      y: hit.point.y - meshCenter.y,
    });
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (grabPointerId !== event.pointerId) return;
    screenToPointer(event);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return;
    var g = solver;
    var grab = { cx: 0, cy: 0, radius: PAPER_PRESET.grabRadius, strength: PAPER_PRESET.grabStiffness };
    var vi = solver.nearestVertex(hitPoint.x - meshCenter.x, hitPoint.y - meshCenter.y);
    var grid = solver.vertexToGrid(vi);
    grab.cx = grid.ix;
    grab.cy = grid.iy;
    grab.x = hitPoint.x - meshCenter.x;
    grab.y = hitPoint.y - meshCenter.y;
    solver.setGrab(grab);
  }

  function endGrab(event) {
    if (event && grabPointerId !== event.pointerId) return;
    solver.clearGrab();
    grabPointerId = null;
    if (event) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (_e) {
        /* ignore */
      }
    }
  }

  function attachInteraction() {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endGrab);
    canvas.addEventListener('pointercancel', endGrab);
    window.addEventListener('blur', function () {
      endGrab(null);
    });
  }

  function detachInteraction() {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', endGrab);
    canvas.removeEventListener('pointercancel', endGrab);
  }

  function onResize() {
    if (!renderer) return;
    updateCamera();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  return {
    init: async function (sourceScroll) {
      if (!setupRenderer()) return false;

      scene = new THREE.Scene();
      updateCamera();
      window.addEventListener('resize', onResize, { passive: true });

      var article = sourceScroll.querySelector('.receipt');
      if (!article) return false;

      var rect = sourceScroll.getBoundingClientRect();
      var captured = await captureReceiptTexture(article);
      uvRegions = measureUvRegions(article);

      var grid = gridForViewport();
      var cx = pxToWorldX(rect.left + rect.width * 0.5);
      var cy = pxToWorldY(rect.top + rect.height * 0.5);
      meshCenter.x = cx;
      meshCenter.y = cy;

      solver = createXPBDSolver(grid.segW, grid.segH, captured.width, captured.height);
      solver.initGrid(0, 0);
      var barLocal = pxToWorldY(rect.bottom) - cy;
      solver.setPrinterBar(barLocal);

      var tex = new THREE.CanvasTexture(captured.canvas);
      buildMesh(tex, captured.width, captured.height, grid.segW, grid.segH);
      mesh.position.set(cx, cy, 0);
      syncMeshFromSolver();

      canvas.classList.add('is-active');
      attachInteraction();
      return true;
    },

    start: function () {
      if (running) return;
      running = true;
      lastNow = 0;
      accum = 0;
      rafId = requestAnimationFrame(tick);
    },

    stop: function () {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      detachInteraction();
    },

    destroy: function () {
      this.stop();
      window.removeEventListener('resize', onResize);
      if (mesh) {
        mesh.geometry.dispose();
        mesh.material.map.dispose();
        mesh.material.dispose();
      }
      if (renderer) renderer.dispose();
      if (domFallback) domFallback.style.visibility = '';
    },

    hideDom: function (scrollEl) {
      var paper = scrollEl.querySelector('.receipt');
      if (paper) paper.style.visibility = 'hidden';
    },
  };
}
