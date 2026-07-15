export var PAPER_PRESET = {
  segW: 18,
  segH: 36,
  segWMobile: 12,
  segHMobile: 24,
  fixedDt: 1 / 120,
  maxFrameDt: 0.05,
  maxSubsteps: 5,
  iterations: 12,
  // Stiff thermal paper: hangs, barely flutters.
  gravity: -22,
  damping: 0.085,
  structuralCompliance: 0.000005,
  shearCompliance: 0.00002,
  bendCompliance: 0.00055,
  softPinCompliance: 0.00001,
  shapeMemory: 0.006,
  curlLift: 26,
  curlEdgeBoost: 0.35,
  curlDrop: 0.12,
  flutterForce: 22,
  flutterSpeed: 0.32,
  flutterDetail: 0.12,
  windStrength: 0.05,
  printerCurlLift: 8,
  grabLift: 14,
  grabRadius: 2.1,
  grabStiffness: 0.55,
  maxGrabStep: 7,
  sleepThreshold: 0.035,
  maxVertexSpeed: 48,
  printerBarY: -1e9,
};

export function gridForViewport() {
  var mobile = window.innerWidth < 640;
  return {
    segW: mobile ? PAPER_PRESET.segWMobile : PAPER_PRESET.segW,
    segH: mobile ? PAPER_PRESET.segHMobile : PAPER_PRESET.segH,
  };
}

export function isDebugPhysics() {
  try {
    return new URLSearchParams(window.location.search).get('debugPhysics') === '1';
  } catch (_e) {
    return false;
  }
}

export function isClothTune() {
  try {
    return new URLSearchParams(window.location.search).get('clothTune') === '1';
  } catch (_e) {
    return false;
  }
}
