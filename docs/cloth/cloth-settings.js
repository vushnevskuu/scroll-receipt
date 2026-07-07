import { PAPER_PRESET } from './config.js';

var STORAGE_KEY = 'receipt-cloth-preset';

export function stiffnessToCompliance(stiffness) {
  var k = Math.max(0, Math.min(100, stiffness));
  return Math.pow(10, -3 - k / 25);
}

export function complianceToStiffness(compliance) {
  if (!Number.isFinite(compliance) || compliance <= 0) return 50;
  var k = -25 * (Math.log10(compliance) + 3);
  return Math.max(0, Math.min(100, Math.round(k)));
}

function loadStoredPreset() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

function savePreset(preset) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preset));
  } catch (_e) {
    /* ignore */
  }
}

/**
 * @param {{ solver: object, visible?: boolean, onChange?: function }} options
 */
export function createClothSettingsPanel(options) {
  var solver = options.solver;
  var onChange = options.onChange || function () {};
  var startOpen = options.visible === true;

  var root = document.createElement('div');
  root.id = 'cloth-settings-panel';
  root.className = 'cloth-settings-panel';
  root.hidden = !startOpen;

  var toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'cloth-settings-toggle';
  toggleBtn.textContent = '⚙ Physics';
  toggleBtn.setAttribute('aria-label', 'Physics settings');
  document.body.appendChild(toggleBtn);

  var title = document.createElement('div');
  title.className = 'cloth-settings-title';
  title.textContent = 'Receipt physics';
  root.appendChild(title);

  var fields = [
    { key: 'structural', label: 'Structural stiffness', type: 'stiffness', presetKey: 'structuralCompliance' },
    { key: 'shear', label: 'Shear stiffness', type: 'stiffness', presetKey: 'shearCompliance' },
    { key: 'bend', label: 'Bend stiffness', type: 'stiffness', presetKey: 'bendCompliance' },
    { key: 'damping', label: 'Damping', type: 'range', min: 0.001, max: 0.15, step: 0.001, presetKey: 'damping' },
    { key: 'windStrength', label: 'Wind', type: 'range', min: 0, max: 1.5, step: 0.01, presetKey: 'windStrength' },
    { key: 'grabStiffness', label: 'Grab strength', type: 'range', min: 0.05, max: 1, step: 0.01, presetKey: 'grabStiffness' },
    { key: 'grabRadius', label: 'Grab radius', type: 'range', min: 1, max: 5, step: 0.1, presetKey: 'grabRadius' },
    { key: 'gravity', label: 'Gravity', type: 'range', min: -500, max: 0, step: 1, presetKey: 'gravity' },
    { key: 'iterations', label: 'Solver iterations', type: 'range', min: 1, max: 12, step: 1, presetKey: 'iterations' },
  ];

  var sliders = {};
  var current = solver.getPreset ? solver.getPreset() : {};

  var stored = loadStoredPreset();
  if (stored) {
    applyToSolver(stored);
    current = solver.getPreset ? solver.getPreset() : stored;
  }

  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var row = document.createElement('label');
    row.className = 'cloth-settings-row';

    var name = document.createElement('span');
    name.className = 'cloth-settings-label';
    name.textContent = f.label;

    var input = document.createElement('input');
    input.type = 'range';
    input.className = 'cloth-settings-range';
    input.dataset.presetKey = f.presetKey;
    input.dataset.fieldType = f.type;

    var valueEl = document.createElement('span');
    valueEl.className = 'cloth-settings-value';

    if (f.type === 'stiffness') {
      input.min = '0';
      input.max = '100';
      input.step = '1';
      var stiff = complianceToStiffness(current[f.presetKey] != null ? current[f.presetKey] : PAPER_PRESET[f.presetKey]);
      input.value = String(stiff);
      valueEl.textContent = String(stiff);
    } else {
      input.min = String(f.min);
      input.max = String(f.max);
      input.step = String(f.step);
      var val = current[f.presetKey] != null ? current[f.presetKey] : PAPER_PRESET[f.presetKey];
      input.value = String(val);
      valueEl.textContent = String(+val);
    }

    input.addEventListener('input', function () {
      var patch = buildPatchFromUI();
      applyToSolver(patch);
      updateValueLabels();
      savePreset(patch);
      onChange(patch);
    });

    row.appendChild(name);
    row.appendChild(input);
    row.appendChild(valueEl);
    root.appendChild(row);
    sliders[f.presetKey] = input;
  }

  var resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'cloth-settings-reset';
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', function () {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      /* ignore */
    }
    var defaults = {
      structuralCompliance: 0.0001,
      shearCompliance: 0.0005,
      bendCompliance: 0.001,
      damping: 0.02,
      windStrength: 0.35,
      grabStiffness: 0.35,
      grabRadius: 2.5,
      gravity: -12,
      iterations: 8,
    };
    syncUIFromPreset(defaults);
    onChange(defaults);
  });
  root.appendChild(resetBtn);

  document.body.appendChild(root);

  toggleBtn.addEventListener('click', function () {
    root.hidden = !root.hidden;
  });

  function buildPatchFromUI() {
    var patch = {};
    for (var key in sliders) {
      var el = sliders[key];
      var fieldType = el.dataset.fieldType;
      var presetKey = el.dataset.presetKey;
      if (fieldType === 'stiffness') {
        patch[presetKey] = stiffnessToCompliance(parseFloat(el.value));
      } else {
        patch[presetKey] = parseFloat(el.value);
      }
    }
    return patch;
  }

  function applyToSolver(patch) {
    if (solver.applyPreset) solver.applyPreset(patch);
    if (solver.syncConstraints) solver.syncConstraints();
  }

  function updateValueLabels() {
    var rows = root.querySelectorAll('.cloth-settings-row');
    for (var r = 0; r < rows.length; r++) {
      var inp = rows[r].querySelector('input');
      var valEl = rows[r].querySelector('.cloth-settings-value');
      if (!inp || !valEl) continue;
      if (inp.dataset.fieldType === 'stiffness') {
        valEl.textContent = inp.value;
      } else {
        valEl.textContent = String(+inp.value);
      }
    }
  }

  function syncUIFromPreset(preset) {
    for (var key in sliders) {
      var el = sliders[key];
      if (el.dataset.fieldType === 'stiffness') {
        el.value = String(complianceToStiffness(preset[key]));
      } else if (preset[key] != null) {
        el.value = String(preset[key]);
      }
    }
    updateValueLabels();
    applyToSolver(buildPatchFromUI());
  }

  return {
    element: root,
    toggle: toggleBtn,
    show: function () {
      root.hidden = false;
    },
    hide: function () {
      root.hidden = true;
    },
    destroy: function () {
      root.remove();
      toggleBtn.remove();
    },
  };
}
