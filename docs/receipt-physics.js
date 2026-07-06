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

    var segmentsX = Math.max(8, Math.round(worldW / 24));
    var segmentsY = Math.max(12, Math.round(worldH / 24));

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
      segmentsX + 1,
      segmentsY + 1,
      0,
      true
    );

    var cfg = softBody.get_m_cfg();
    cfg.set_viterations(6);
    cfg.set_piterations(6);
    cfg.set_kDP(0.015);
    cfg.set_kPR(0.01);

    softBody.setTotalMass(0.2, false);
    AmmoLib.castObject(softBody, AmmoLib.btCollisionObject).getCollisionShape().setMargin(MARGIN * 2);
    physicsWorld.addSoftBody(softBody, 1, -1);
    softBody.setActivationState(4);

    cloth.userData.physicsBody = softBody;
    cloth.userData.segmentsX = segmentsX;
    cloth.userData.segmentsY = segmentsY;
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
      vel.setX(vel.x() + dx * 0.012);
      vel.setY(vel.y() + dy * 0.018 + 1.5);
    }
  }

  function applyWindAndSpring() {
    windPhase += 0.016;
    var wind = Math.sin(windPhase * 1.2) * 0.9;

    var nodes = softBody.get_m_nodes();
    var count = nodes.size();

    for (var i = 0; i < count; i++) {
      var node = nodes.at(i);
      var pos = node.get_m_x();
      var force = node.get_m_f();

      force.setX(force.x() + wind * 0.35);
      force.setY(force.y() + Math.sin(windPhase + i * 0.05) * 0.08);

      force.setX(force.x() + (0 - pos.x()) * 0.0012);
      force.setY(force.y() + (0 - pos.y()) * 0.0015);
    }
  }

  function syncClothMesh() {
    if (!cloth || !softBody) return;

    var positions = cloth.geometry.attributes.position.array;
    var nodes = softBody.get_m_nodes();
    var resX = cloth.userData.segmentsX + 1;
    var resY = cloth.userData.segmentsY + 1;

    for (var j = 0; j < resY; j++) {
      for (var i = 0; i < resX; i++) {
        var node = nodes.at(i + j * resX);
        var p = node.get_m_x();
        var vert = i + (resY - 1 - j) * resX;
        positions[vert * 3] = p.x();
        positions[vert * 3 + 1] = p.y();
        positions[vert * 3 + 2] = p.z();
      }
    }

    cloth.geometry.attributes.position.needsUpdate = true;
    cloth.geometry.computeVertexNormals();
  }

  function stepPhysics(dt) {
    applyWindAndSpring();
    physicsWorld.stepSimulation(dt, 6, 1 / 180);
    syncClothMesh();
  }

  function animate() {
    if (!running) return;
    var dt = Math.min(clock.getDelta(), 0.033);
    stepPhysics(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  function samplePixelVisible(screenX, screenY) {
    var gl = renderer.getContext();
    var dpr = renderer.getPixelRatio();
    var px = Math.floor(screenX * dpr);
    var py = Math.floor((window.innerHeight - screenY) * dpr);
    var buf = new Uint8Array(4);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf[3] > 8 || buf[0] + buf[1] + buf[2] > 40;
  }

  function isClothVisible(rect) {
    var cx = rect.left + rect.width * 0.5;
    var cy = rect.top + rect.height * 0.5;
    return samplePixelVisible(cx, cy);
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

  function renderFrame() {
    stepPhysics(1 / 60);
    renderer.render(scene, camera);
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
        renderFrame();

        if (!isClothVisible(rect)) {
          await new Promise(function (resolve) {
            requestAnimationFrame(resolve);
          });
          renderFrame();
        }

        if (!isClothVisible(rect)) {
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
