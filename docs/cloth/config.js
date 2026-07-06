export var PAPER_PRESET = {
  segW: 24,
  segH: 48,
  segWMobile: 16,
  segHMobile: 32,
  fixedDt: 1 / 120,
  maxFrameDt: 0.05,
  maxSubsteps: 6,
  iterations: 10,
  gravity: 0,
  damping: 0.012,
  structuralCompliance: 0,
  shearCompliance: 0.00002,
  bendCompliance: 0.0008,
  softPinCompliance: 0.00001,
  grabRadius: 3,
  grabStiffness: 0.85,
  sleepThreshold: 0.08,
  printerBarY: 0,
};

export function gridForViewport() {
  var mobile = window.innerWidth < 640;
  return {
    segW: mobile ? PAPER_PRESET.segWMobile : PAPER_PRESET.segW,
    segH: mobile ? PAPER_PRESET.segHMobile : PAPER_PRESET.segH,
  };
}
