export var PAPER_PRESET = {
  segW: 18,
  segH: 36,
  segWMobile: 12,
  segHMobile: 24,
  fixedDt: 1 / 120,
  maxFrameDt: 0.05,
  maxSubsteps: 5,
  iterations: 10,
  // Heavier hang + quicker settle = thermal receipt paper, not silk.
  gravity: -28,
  damping: 0.065,
  // Stretch almost never; bend/curl is allowed.
  structuralCompliance: 0.000008,
  shearCompliance: 0.000035,
  bendCompliance: 0.0014,
  softPinCompliance: 0.00001,
  shapeMemory: 0.0028,
  curlLift: 52,
  curlEdgeBoost: 0.62,
  curlDrop: 0.2,
  flutterForce: 90,
  flutterSpeed: 0.9,
  flutterDetail: 0.32,
  windStrength: 0.2,
  printerCurlLift: 16,
  grabLift: 18,
  grabRadius: 2.1,
  grabStiffness: 0.58,
  maxGrabStep: 8,
  sleepThreshold: 0.04,
  maxVertexSpeed: 70,
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
