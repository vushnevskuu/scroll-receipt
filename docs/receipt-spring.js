var MAX_DT = 0.033;
var SLEEP_EPS = 0.02;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isFiniteState(n) {
  return Number.isFinite(n);
}

function neutralState() {
  return {
    x: 0,
    y: 0,
    rot: 0,
    tilt: 0,
    vx: 0,
    vy: 0,
    vRot: 0,
    vTilt: 0,
    targetX: 0,
    targetY: 0,
    targetRot: 0,
    targetTilt: 0,
    isDragging: false,
    mode: 'anchored',
    flyResolve: null,
    flyStarted: 0,
  };
}

export function createReceiptSpring(targetEl, options) {
  if (!targetEl) return null;

  var cfg = Object.assign(
    {
      stiffness: 0.11,
      damping: 0.86,
      maxX: 26,
      maxY: 16,
      maxRot: 5.5,
      maxTilt: 2.5,
      maxVel: 420,
      maxAngVel: 240,
      pointerForce: 0.1,
      idleAmp: 1.6,
      anchorY: 1,
      flyStiffness: 0.05,
      flyDamping: 0.9,
      flyMaxMs: 1500,
    },
    options || {}
  );

  var state = neutralState();
  var running = false;
  var rafId = 0;
  var lastTime = 0;
  var activePointer = null;
  var dragStart = { x: 0, y: 0, sx: 0, sy: 0 };
  var onVisibilityChange = null;
  var onResize = null;

  targetEl.style.transformOrigin = '50% ' + cfg.anchorY * 100 + '%';
  targetEl.style.willChange = 'transform';

  function sanitize() {
    if (
      !isFiniteState(state.x) ||
      !isFiniteState(state.y) ||
      !isFiniteState(state.rot) ||
      !isFiniteState(state.tilt)
    ) {
      state = neutralState();
    }
  }

  function applyTransform() {
    sanitize();
    targetEl.style.transform =
      'translate3d(' +
      state.x.toFixed(2) +
      'px,' +
      state.y.toFixed(2) +
      'px,0) rotate(' +
      state.rot.toFixed(3) +
      'deg) rotateX(' +
      state.tilt.toFixed(3) +
      'deg)';
    var shadowY = 24 + Math.abs(state.y) * 0.6;
    var shadowBlur = 64 + Math.abs(state.rot) * 2;
    targetEl.style.boxShadow =
      '0 1px 0 rgba(255,255,255,0.06) inset, 0 ' +
      shadowY.toFixed(0) +
      'px ' +
      shadowBlur.toFixed(0) +
      'px rgba(0,0,0,0.45)';
  }

  function limitsForMode() {
    if (state.mode === 'flyaway') {
      return { maxX: 2000, maxY: 2000, maxRot: 12, maxTilt: 5 };
    }
    return { maxX: cfg.maxX, maxY: cfg.maxY, maxRot: cfg.maxRot, maxTilt: cfg.maxTilt };
  }

  function integrate(dt) {
    if (state.mode === 'disabled') return;

    var limits = limitsForMode();
    var stiffness = state.mode === 'flyaway' ? cfg.flyStiffness : cfg.stiffness;
    var damping = state.mode === 'flyaway' ? cfg.flyDamping : cfg.damping;

    if (state.mode === 'anchored' && !state.isDragging) {
      var t = performance.now() * 0.001;
      state.targetX = Math.sin(t * 0.62) * cfg.idleAmp * 0.35;
      state.targetY = Math.cos(t * 0.48) * cfg.idleAmp * 0.22;
      state.targetRot = Math.sin(t * 0.55) * 0.45;
      state.targetTilt = Math.cos(t * 0.41) * 0.25;
    }

    var ax = -stiffness * (state.x - state.targetX) - damping * state.vx * 55;
    var ay = -stiffness * (state.y - state.targetY) - damping * state.vy * 55;
    var aRot = -stiffness * (state.rot - state.targetRot) - damping * state.vRot * 55;
    var aTilt = -stiffness * (state.tilt - state.targetTilt) - damping * state.vTilt * 55;

    state.vx += ax * dt;
    state.vy += ay * dt;
    state.vRot += aRot * dt;
    state.vTilt += aTilt * dt;

    state.vx = clamp(state.vx, -cfg.maxVel, cfg.maxVel);
    state.vy = clamp(state.vy, -cfg.maxVel, cfg.maxVel);
    state.vRot = clamp(state.vRot, -cfg.maxAngVel, cfg.maxAngVel);
    state.vTilt = clamp(state.vTilt, -cfg.maxAngVel, cfg.maxAngVel);

    state.x += state.vx * dt;
    state.y += state.vy * dt;
    state.rot += state.vRot * dt;
    state.tilt += state.vTilt * dt;

    state.x = clamp(state.x, -limits.maxX, limits.maxX);
    state.y = clamp(state.y, -limits.maxY, limits.maxY);
    state.rot = clamp(state.rot, -limits.maxRot, limits.maxRot);
    state.tilt = clamp(state.tilt, -limits.maxTilt, limits.maxTilt);

    if (state.mode === 'flyaway' && state.flyResolve) {
      var settled =
        Math.abs(state.x - state.targetX) < 5 &&
        Math.abs(state.y - state.targetY) < 5 &&
        Math.abs(state.vx) < 10 &&
        Math.abs(state.vy) < 10;
      var timedOut = performance.now() - state.flyStarted > cfg.flyMaxMs;
      if (settled || timedOut) {
        var done = state.flyResolve;
        state.flyResolve = null;
        done();
      }
    }

    if (
      state.mode === 'anchored' &&
      !state.isDragging &&
      Math.abs(state.x - state.targetX) < SLEEP_EPS &&
      Math.abs(state.y - state.targetY) < SLEEP_EPS &&
      Math.abs(state.rot - state.targetRot) < 0.05 &&
      Math.abs(state.vx) < SLEEP_EPS &&
      Math.abs(state.vy) < SLEEP_EPS &&
      Math.abs(state.vRot) < 0.05
    ) {
      state.x = state.targetX;
      state.y = state.targetY;
      state.rot = state.targetRot;
      state.tilt = state.targetTilt;
      state.vx = 0;
      state.vy = 0;
      state.vRot = 0;
      state.vTilt = 0;
    }

    applyTransform();
  }

  function tick(now) {
    if (!running) return;
    if (!lastTime) lastTime = now;
    var dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;

    if (!document.hidden) {
      integrate(dt);
    }

    rafId = requestAnimationFrame(tick);
  }

  function onPointerDown(event) {
    if (state.mode !== 'anchored') return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest('a, button')) return;

    state.isDragging = true;
    activePointer = event.pointerId;
    dragStart.x = event.clientX;
    dragStart.y = event.clientY;
    dragStart.sx = state.x;
    dragStart.sy = state.y;

    try {
      targetEl.setPointerCapture(event.pointerId);
    } catch (_err) {
      /* ignore */
    }
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!state.isDragging || event.pointerId !== activePointer) return;

    var dx = event.clientX - dragStart.x;
    var dy = event.clientY - dragStart.y;
    var limits = limitsForMode();

    state.x = clamp(dragStart.sx + dx * cfg.pointerForce, -limits.maxX, limits.maxX);
    state.y = clamp(dragStart.sy + dy * cfg.pointerForce, -limits.maxY, limits.maxY);
    state.rot = clamp(dx * 0.04, -limits.maxRot, limits.maxRot);
    state.tilt = clamp(-dy * 0.02, -limits.maxTilt, limits.maxTilt);

    state.vx = dx * 0.35;
    state.vy = dy * 0.35;
    state.vRot = dx * 0.08;
    state.vTilt = -dy * 0.05;

    applyTransform();
  }

  function endDrag(event) {
    if (!state.isDragging) return;
    if (event && event.pointerId !== activePointer) return;

    state.isDragging = false;
    activePointer = null;
    state.targetX = 0;
    state.targetY = 0;
    state.targetRot = 0;
    state.targetTilt = 0;

    if (event) {
      try {
        targetEl.releasePointerCapture(event.pointerId);
      } catch (_err) {
        /* ignore */
      }
    }
  }

  function onPointerProximity(event) {
    if (state.mode !== 'anchored' || state.isDragging) return;

    var rect = targetEl.getBoundingClientRect();
    var cx = rect.left + rect.width * 0.5;
    var cy = rect.top + rect.height * 0.65;
    var dx = event.clientX - cx;
    var dy = event.clientY - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 320) return;

    var influence = (1 - dist / 320) * 0.35;
    state.targetX = clamp(dx * 0.015 * influence, -cfg.maxX * 0.5, cfg.maxX * 0.5);
    state.targetY = clamp(dy * 0.01 * influence, -cfg.maxY * 0.5, cfg.maxY * 0.5);
    state.targetRot = clamp(dx * 0.006 * influence, -2, 2);
  }

  function attachListeners() {
    targetEl.addEventListener('pointerdown', onPointerDown);
    targetEl.addEventListener('pointermove', onPointerMove);
    targetEl.addEventListener('pointerup', endDrag);
    targetEl.addEventListener('pointercancel', endDrag);
    window.addEventListener('pointermove', onPointerProximity, { passive: true });

    onVisibilityChange = function () {
      if (document.hidden) lastTime = 0;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    onResize = function () {
      if (state.mode === 'anchored') {
        state.targetX = 0;
        state.targetY = 0;
        state.targetRot = 0;
        state.targetTilt = 0;
        state.x = clamp(state.x, -cfg.maxX, cfg.maxX);
        state.y = clamp(state.y, -cfg.maxY, cfg.maxY);
      }
    };
    window.addEventListener('resize', onResize, { passive: true });
  }

  function detachListeners() {
    targetEl.removeEventListener('pointerdown', onPointerDown);
    targetEl.removeEventListener('pointermove', onPointerMove);
    targetEl.removeEventListener('pointerup', endDrag);
    targetEl.removeEventListener('pointercancel', endDrag);
    window.removeEventListener('pointermove', onPointerProximity);
    if (onVisibilityChange) {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      onVisibilityChange = null;
    }
    if (onResize) {
      window.removeEventListener('resize', onResize);
      onResize = null;
    }
  }

  return {
    start: function () {
      if (running) return;
      state.mode = 'anchored';
      running = true;
      lastTime = 0;
      attachListeners();
      applyTransform();
      rafId = requestAnimationFrame(tick);
    },

    stop: function () {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      detachListeners();
      endDrag(null);
    },

    reset: function () {
      state = neutralState();
      state.mode = 'anchored';
      applyTransform();
    },

    flyToViewportCenter: function () {
      return new Promise(function (resolve) {
        state.mode = 'flyaway';
        state.isDragging = false;
        state.flyStarted = performance.now();
        state.flyResolve = resolve;

        var rect = targetEl.getBoundingClientRect();
        var cx = window.innerWidth * 0.5;
        var cy = window.innerHeight * 0.5;

        state.targetX = cx - (rect.left + rect.width * 0.5);
        state.targetY = cy - (rect.top + rect.height * 0.5);
        state.targetRot = -3.5;
        state.targetTilt = 0;
        state.vy -= 50;
        state.vx += (state.targetX - state.x) * 0.04;
      });
    },

    disable: function () {
      state.mode = 'disabled';
      endDrag(null);
      targetEl.style.willChange = 'auto';
    },
  };
}
