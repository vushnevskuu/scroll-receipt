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

function captureTextureFromDom(receiptEl) {
  var article = receiptEl.querySelector('.receipt') || receiptEl;
  var dpr = Math.min(window.devicePixelRatio, 2);
  var w = Math.max(article.offsetWidth, 1);
  var h = Math.max(article.offsetHeight, 1);
  var canvas = document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#f6f2ea';
  ctx.fillRect(0, 0, w, h);

  var clone = article.cloneNode(true);
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.width = w + 'px';
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  document.body.appendChild(clone);

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
    '<foreignObject width="100%" height="100%">' +
    new XMLSerializer().serializeToString(clone) +
    '</foreignObject></svg>';
  document.body.removeChild(clone);

  var img = new Image();
  var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  return new Promise(function (resolve) {
    img.onload = function () {
      try {
        ctx.drawImage(img, 0, 0, w, h);
      } catch (_err) {
        drawFallbackLabel(ctx, w, h);
      }
      resolve(new THREE.CanvasTexture(canvas));
    };
    img.onerror = function () {
      drawFallbackLabel(ctx, w, h);
      resolve(new THREE.CanvasTexture(canvas));
    };
    img.src = url;
  });
}

function drawFallbackLabel(ctx, w, h) {
  ctx.fillStyle = '#f6f2ea';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1916';
  ctx.font = '600 18px IBM Plex Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SCROLL RECEIPT', w * 0.5, 48);
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
    cfg.set_viterations(10);
    cfg.set_piterations(10);
    cfg.set_kDP(0.02);
    cfg.set_kPR(0.02);

    softBody.setTotalMass(0.3, false);
    AmmoLib.castObject(softBody, AmmoLib.btCollisionObject).getCollisionShape().setMargin(MARGIN * 3);
    physicsWorld.addSoftBody(softBody, 1, -1);
    softBody.setActivationState(4);

    cloth.userData.resX = resX;
    cloth.userData.resY = resY;
    syncClothMesh();
  }

  function applyTearImpulse() {
    if (!softBody) return;
    var nodes = softBody.get_m_nodes();
    var count = nodes.size();

    for (var i = 0; i < count; i++) {
      var node = nodes.at(i);
      var pos = node.get_m_x();
      var vel = node.get_m_v();

      vel.setY(vel.y() + 1.2);
      vel.setX(vel.x() + (Math.random() - 0.5) * 0.4);
    }
  }

  function applyWindAndSpring() {
    windPhase += 0.016;
    var wind = Math.sin(windPhase * 1.2) * 0.5;

    var nodes = softBody.get_m_nodes();
    var count = nodes.size();

    for (var i = 0; i < count; i++) {
      var node = nodes.at(i);
      var pos = node.get_m_x();
      var force = node.get_m_f();

      force.setX(force.x() + wind * 0.2);
      force.setY(force.y() + Math.sin(windPhase + i * 0.05) * 0.04);
      force.setX(force.x() + (0 - pos.x()) * 0.0006);
      force.setY(force.y() + (0 - pos.y()) * 0.0008);
    }
  }

  function syncClothMesh() {
    if (!cloth || !softBody) return false;

    var positions = cloth.geometry.attributes.position.array;
    var nodes = softBody.get_m_nodes();
    var resX = cloth.userData.resX;
    var resY = cloth.userData.resY;

    for (var j = 0; j < resY; j++) {
      for (var i = 0; i < resX; i++) {
        var node = nodes.at(i + j * resX);
        var p = node.get_m_x();
        var x = p.x();
        var y = p.y();
        var z = p.z();

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          return false;
        }

        var vertIdx = i + (resY - 1 - j) * resX;
        positions[vertIdx * 3] = x;
        positions[vertIdx * 3 + 1] = y;
        positions[vertIdx * 3 + 2] = z;
      }
    }

    cloth.geometry.attributes.position.needsUpdate = true;
    return true;
  }

  function stepPhysics(dt) {
    applyWindAndSpring();
    physicsWorld.stepSimulation(dt, 10, 1 / 120);
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
    if (!positions.length) return false;

    var mid = Math.floor(positions.length / 6) * 3;
    return (
      Number.isFinite(positions[0]) &&
      Number.isFinite(positions[1]) &&
      Number.isFinite(positions[mid]) &&
      Number.isFinite(positions[mid + 1])
    );
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

        var texture = await captureTextureFromDom(scrollEl);
        createCloth(rect, texture);

        if (!syncClothMesh() || !isClothMeshValid()) {
          clearCloth();
          return false;
        }

        renderer.render(scene, camera);

        canvas.classList.add('is-active');
        scrollEl.style.visibility = 'hidden';
        scrollEl.setAttribute('aria-hidden', 'true');

        applyTearImpulse();

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
