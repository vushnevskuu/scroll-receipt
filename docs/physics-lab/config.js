/** Fixed lab parameters — local mesh units only, never screen pixels or DPR. */
export var LAB_CONFIG = {
  segW: 10,
  segH: 20,
  sheetWidth: 4,
  sheetHeight: 8,
  fixedDt: 0.0083333333,
  maxFrameDt: 0.0333333333,
  maxSubsteps: 4,
  structuralCompliance: 0.001,
  shearCompliance: 0.01,
  bendCompliance: 0.01,
  grabRadius: 2,
  grabStiffness: 0.14,
  maxGrabStep: 0.04,
  maxVertexSpeed: 0.06,
  damping: 0.06,
  gravityPhase2: -0.4,
  positionBoundMultiplier: 10,
  epsilon: 1e-8,
  speedHighlight: 0.025,
  iterations: 8,
};

export function labPhaseFromUrl() {
  var p = 5;
  try {
    p = parseInt(new URLSearchParams(window.location.search).get('phase') || '5', 10);
  } catch (_e) {
    /* ignore */
  }
  if (!Number.isFinite(p) || p < 1) p = 1;
  if (p > 5) p = 5;
  return p;
}

export function debugPhysicsEnabled() {
  try {
    var params = new URLSearchParams(window.location.search);
    var explicit = params.get('debugPhysics');
    if (explicit === '0') return false;
    if (explicit === '1') return true;
    return window.location.pathname.indexOf('physics-lab') !== -1;
  } catch (_e) {
    return true;
  }
}

export function isClothTune() {
  try {
    return new URLSearchParams(window.location.search).get('clothTune') === '1';
  } catch (_e) {
    return false;
  }
}
