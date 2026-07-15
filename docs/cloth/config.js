export var PAPER_PRESET = {
  segW: 18,
  segH: 36,
  segWMobile: 12,
  segHMobile: 24,
  fixedDt: 1 / 120,
  maxFrameDt: 0.05,
  maxSubsteps: 6,
  iterations: 12,
  gravity: -24,
  damping: 0.045,
  // Thermal paper keeps its dimensions; motion comes from whole-sheet curl.
  structuralCompliance: 0.000004,
  shearCompliance: 0.000012,
  bendCompliance: 0.00045,
  softPinCompliance: 0.00001,
  shapeMemory: 0.0006,
  curlLift: 30,
  curlEdgeBoost: 0.38,
  curlDrop: 0.11,
  flutterForce: 38,
  flutterSpeed: 1.15,
  flutterDetail: 0.12,
  windStrength: 0.16,
  printerCurlLift: 10,
  grabLift: 16,
  grabRadius: 3.1,
  grabStiffness: 0.62,
  maxGrabStep: 8,
  sleepThreshold: 0.02,
  maxVertexSpeed: 52,
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
