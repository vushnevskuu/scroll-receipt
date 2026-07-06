import * as THREE from 'three';

var GRAVITY = 0;
var MARGIN = 0.02;

function waitForAmmo() {
  return new Promise(function (resolve) {
    if (typeof Ammo === 'undefined') {
      resolve(null);
      return;
    }
    Ammo().then(resolve);
  });
}

function loadHtml2Canvas() {
  return import('https://esm.sh/html2canvas@1.4.1').then(function (m) {
    return m.default || m;
  });
}

function pxToWorldX(px) {
  return px - window.innerWidth * 0.5;
}

function pxToWorldY(px) {
  return -(px - window.innerHeight * 0.5);
}

function rectToWorld(rect) {
  return {
    width: rect.width,
    height: rect.height,
    centerX: pxToWorldX(rect.left + rect.width * 0.5),
    centerY: pxToWorldY(rect.top + rect.height * 0.5),
  };
}

export function createReceiptPhysics(options) {
  var canvas = document.querySelector(options.canvas);
  if (!canvas) return null;

  var renderer;
  var scene;
  var camera;
  var physicsWorld;
  var cloth;
  var softBody;
  var running = false;
  var windPhase = 0;
  var clock = new THREE.Clock();
  var AmmoLib = null;

  function setupRenderer() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    updateCamera();
    window.addEventListener('resize', onResize);
  }

  function updateCamera() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    camera = new THREE.OrthographicCamera(
      -width * 0.5,
      width * 0.5,
      height * 0.5,
      -height * 0.5,
      0.1,
      2000
    );
    camera.position.z = 500;
  }

  function onResize() {
    if (!renderer) return;
    updateCamera();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  function initPhysics() {
    var collisionConfiguration = new AmmoLib.btSoftBodyRigidBodyCollisionConfiguration();
    var dispatcher = new AmmoLib.btCollisionDispatcher(collisionConfiguration);
    var broadphase = new AmmoLib.btDbvtBroadphase();
    var solver = new AmmoLib.btSequentialImpulseConstraintSolver();
    var softBodySolver = new AmmoLib.btDefaultSoftBodySolver();
    physicsWorld = new AmmoLib.btSoftRigidDynamicsWorld(
      dispatcher,
      broadphase,
      solver,
      collisionConfiguration,
      softBodySolver
    );
    physicsWorld.setGravity(new AmmoLib.btVector3(0, GRAVITY, 0));
    physicsWorld.getWorldInfo().set_m_gravity(new AmmoLib.btVector3(0, GRAVITY, 0));
  }

  function clearCloth() {
    if (cloth) {
      scene.remove(cloth);
      if (cloth.material.map) cloth.material.map.dispose();
      cloth.material.dispose();
      cloth.geometry.dispose();
      cloth = null;
    }
    if (softBody && physicsWorld) {
      physicsWorld.removeSoftBody(softBody);
      softBody = null;
    }
  }

  function createCloth(rect, texture) {
    var world = rectToWorld(rect);
    var worldW = world.width;
    var worldH = world.height;
    var centerX = world.centerX;
    var centerY = world.centerY;

    var segmentsX = Math.max(8, Math.round(worldW / 28));
    var segmentsY = Math.max(12, Math.round(worldH / 28));
    var resX = segmentsX + 1;
    var resY = segmentsY + 1;

    var geometry = new THREE.PlaneGeometry(worldW, worldH, segmentsX, segmentsY);
    geometry.translate(centerX, centerY, 0);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if (texture.image) {
      texture.needsUpdate = true;
    }

    var material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthTest: false,
    });

    cloth = new THREE.Mesh(geometry, material);
    scene.add(cloth);

    var halfW = worldW * 0.5;
    var halfH = worldH * 0.5;

    var c00 = new AmmoLib.btVector3(centerX - halfW, centerY + halfH, 0);
    var c01 = new AmmoLib.btVector3(centerX + halfW, centerY + halfH, 0);
    var c10 = new AmmoLib.btVector3(centerX - halfW, centerY - halfH, 0);
    var c11 = new AmmoLib.btVector3(centerX + halfW, centerY - halfH, 0);

    var helpers = new AmmoLib.btSoftBodyHelpers();
    softBody = helpers.CreatePatch(
      physicsWorld.getWorldInfo(),
      c00,
      c01,
      c10,
      c11,
      resX,
      resY,
      0,
      true
    );

    var cfg = softBody.get_m_cfg();
    cfg.set_viterations(8);
    cfg.set_piterations(8);
    cfg.set_kDP(0.02);
    cfg.set_kPR(0.02);

    softBody.setTotalMass(0.35, false);
    AmmoLib.castObject(softBody, AmmoLib.btCollisionObject).getCollisionShape().setMargin(MARGIN * 3);
    physicsWorld.addSoftBody(softBody, 1, -1);
    softBody.setActivationState(4);

    cloth.userData.physicsBody = softBody;
    syncClothMesh();
    applyTearImpulse();
  }

  function applyTearImpulse() {
    var nodes = softBody.get_m_nodes();
    var count = nodes.size();

    for (var i = 0; i < count; i++) {
      var node = nodes.at(i);
      var pos = node.get_m_x();
      var vel = node.get_m_v();

      var dx = 0 - pos.x();
      var dy = 0 - pos.y();
      vel.setX(vel.x() + dx * 0.008);
      vel.setY(vel.y() + dy * 0.01 + 0.8);
    }
  }

  function applyWindAndSpring() {
    windPhase += 0.016;
    var wind = Math.sin(windPhase * 1.2) * 0.6;

    var nodes = softBody.get_m_nodes();
    var count = nodes.size();

    for (var i = 0; i < count; i++) {
      var node = nodes.at(i);
      var pos = node.get_m_x();
      var force = node.get_m_f();

      force.setX(force.x() + wind * 0.25);
      force.setY(force.y() + Math.sin(windPhase + i * 0.05) * 0.05);

      force.setX(force.x() + (0 - pos.x()) * 0.0008);
      force.setY(force.y() + (0 - pos.y()) * 0.001);
    }
  }

  function syncClothMesh() {
    if (!cloth || !softBody) return false;

    var positions = cloth.geometry.attributes.position.array;
    var nodes = softBody.get_m_nodes();
    var numVerts = positions.length / 3;
    var nodeCount = nodes.size();
    var count = Math.min(numVerts, nodeCount);

    for (var i = 0; i < count; i++) {
      var node = nodes.at(i);
      var p = node.get_m_x();
      var x = p.x();
      var y = p.y();
      var z = p.z();

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return false;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    cloth.geometry.attributes.position.needsUpdate = true;
    return true;
  }

  function stepPhysics(dt) {
    applyWindAndSpring();
    physicsWorld.stepSimulation(dt, 8, 1 / 120);
    return syncClothMesh();
  }

  function animate() {
    if (!running) return;
    var dt = Math.min(clock.getDelta(), 0.033);
    stepPhysics(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  function isClothMeshValid() {
    if (!cloth) return false;
    var positions = cloth.geometry.attributes.position.array;
    var samples = [0, Math.floor(positions.length / 6), Math.floor(positions.length / 3) - 1];

    for (var i = 0; i < samples.length; i++) {
      var idx = samples[i] * 3;
      if (!Number.isFinite(positions[idx]) || !Number.isFinite(positions[idx + 1])) {
        return false;
      }
    }

    return true;
  }

  async function captureTexture(receiptEl) {
    try {
      var html2canvas = await Promise.race([
        loadHtml2Canvas(),
        new Promise(function (_, reject) {
          setTimeout(function () {
            reject(new Error('html2canvas timeout'));
          }, 1200);
        }),
      ]);
      var captureTarget = receiptEl.querySelector('.receipt') || receiptEl;
      var snapshot = await html2canvas(captureTarget, {
        scale: Math.min(window.devicePixelRatio, 2),
        backgroundColor: '#f6f2ea',
        logging: false,
        useCORS: true,
      });
      return new THREE.CanvasTexture(snapshot);
    } catch (_err) {
      return createFallbackTexture(receiptEl);
    }
  }

  function createFallbackTexture(receiptEl) {
    var article = receiptEl.querySelector('.receipt') || receiptEl;
    var texCanvas = document.createElement('canvas');
    texCanvas.width = Math.max(article.offsetWidth, 360);
    texCanvas.height = Math.max(article.offsetHeight, 540);
    var ctx = texCanvas.getContext('2d');
    ctx.fillStyle = '#f6f2ea';
    ctx.fillRect(0, 0, texCanvas.width, texCanvas.height);
    ctx.fillStyle = '#1a1916';
    ctx.font = '600 18px IBM Plex Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCROLL RECEIPT', texCanvas.width * 0.5, 48);
    return new THREE.CanvasTexture(texCanvas);
  }

  function renderFrames(count) {
    for (var i = 0; i < count; i++) {
      stepPhysics(1 / 60);
      renderer.render(scene, camera);
    }
  }

  return {
    init: async function () {
      setupRenderer();
      AmmoLib = await waitForAmmo();
      if (!AmmoLib) return false;
      initPhysics();
      return true;
    },

    handoff: async function (scrollEl, rect) {
      if (!AmmoLib) return false;

      try {
        if (!rect || rect.width < 10 || rect.height < 10) {
          rect = scrollEl.getBoundingClientRect();
        }
        if (rect.width < 10 || rect.height < 10) return false;

        clearCloth();

        var texture = await captureTexture(scrollEl);
        createCloth(rect, texture);
        renderFrames(3);

        if (!isClothMeshValid()) {
          clearCloth();
          return false;
        }

        canvas.classList.add('is-active');
        scrollEl.style.visibility = 'hidden';
        scrollEl.setAttribute('aria-hidden', 'true');

        if (!running) {
          running = true;
          clock.start();
          animate();
        }

        return true;
      } catch (_err) {
        clearCloth();
        canvas.classList.remove('is-active');
        return false;
      }
    },

    destroy: function () {
      running = false;
      clearCloth();
      window.removeEventListener('resize', onResize);
      if (renderer) renderer.dispose();
    },
  };
}
