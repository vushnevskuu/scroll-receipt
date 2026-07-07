export var PAPER_PRESET = {
  segW: 18,
  segH: 36,
  segWMobile: 12,
  segHMobile: 24,
  fixedDt: 1 / 120,
  maxFrameDt: 0.05,
  maxSubsteps: 5,
  iterations: 8,
  gravity: -12,
  damping: 0.03,
  structuralCompliance: 0.00003,
  shearCompliance: 0.00012,
  bendCompliance: 0.00032,
  softPinCompliance: 0.00001,
  shapeMemory: 0.008,
  curlLift: 38,
  curlEdgeBoost: 0.45,
  curlDrop: 0.14,
  flutterForce: 160,
  flutterSpeed: 1.35,
  flutterDetail: 0.45,
  windStrength: 0.24,
  printerCurlLift: 10,
  grabLift: 34,
  grabRadius: 2.5,
  grabStiffness: 0.42,
  maxGrabStep: 12,
  sleepThreshold: 0.06,
  maxVertexSpeed: 80,
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
