export var PAPER_PRESET = {
  segW: 18,
  segH: 36,
  segWMobile: 12,
  segHMobile: 24,
  fixedDt: 1 / 120,
  maxFrameDt: 0.05,
  maxSubsteps: 5,
  iterations: 10,
  gravity: -20,
  damping: 0.045,
  // Stiff enough not to stretch, soft enough to hang and sway.
  structuralCompliance: 0.000012,
  shearCompliance: 0.00005,
  bendCompliance: 0.0009,
  softPinCompliance: 0.00001,
  shapeMemory: 0.0022,
  curlLift: 36,
  curlEdgeBoost: 0.48,
  curlDrop: 0.15,
  flutterForce: 70,
  flutterSpeed: 0.75,
  flutterDetail: 0.24,
  windStrength: 0.18,
  printerCurlLift: 12,
  grabLift: 18,
  grabRadius: 2.2,
  grabStiffness: 0.5,
  maxGrabStep: 9,
  sleepThreshold: 0.02,
  maxVertexSpeed: 64,
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
