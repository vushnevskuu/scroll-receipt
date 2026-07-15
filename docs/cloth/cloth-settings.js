import { PAPER_PRESET } from './config.js';

var STORAGE_KEY = 'receipt-cloth-preset-v3';

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

  document.documentElement.classList.add('cloth-tune');

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

  var note = document.createElement('p');
  note.className = 'cloth-settings-note';
  note.textContent = 'Paper preset: stiff stretch, soft curl. Lower wind for a quieter hang; raise bend stiffness if it feels too floppy.';
  root.appendChild(note);

  var fields = [
    {
      key: 'structural',
      label: 'Structural stiffness',
      hint: 'How strongly the receipt resists stretching from top to bottom.',
      type: 'stiffness',
      presetKey: 'structuralCompliance',
    },
    {
      key: 'shear',
      label: 'Shear stiffness',
      hint: 'How much the sheet skews diagonally when you pull it sideways.',
      type: 'stiffness',
      presetKey: 'shearCompliance',
    },
    {
      key: 'bend',
      label: 'Bend stiffness',
      hint: 'How easily the paper folds, curls, and keeps a crisp crease.',
      type: 'stiffness',
      presetKey: 'bendCompliance',
    },
    {
      key: 'damping',
      label: 'Damping',
      hint: 'How quickly the wobble calms down after motion or tearing.',
      type: 'range',
      min: 0.001,
      max: 0.15,
      step: 0.001,
      presetKey: 'damping',
    },
    {
      key: 'windStrength',
      label: 'Wind sway',
      hint: 'Idle breeze strength while the receipt hangs from the printer.',
      type: 'range',
      min: 0,
      max: 1.5,
      step: 0.01,
      presetKey: 'windStrength',
    },
    {
      key: 'grabStiffness',
      label: 'Grab strength',
      hint: 'How firmly the paper follows the cursor once you pull it.',
      type: 'range',
      min: 0.05,
      max: 1,
      step: 0.01,
      presetKey: 'grabStiffness',
    },
    {
      key: 'grabRadius',
      label: 'Grab radius',
      hint: 'How much area around the cursor gets dragged with each pull.',
      type: 'range',
      min: 1,
      max: 5,
      step: 0.1,
      presetKey: 'grabRadius',
    },
    {
      key: 'gravity',
      label: 'Gravity pull',
      hint: 'How hard the torn receipt drops after you release it.',
      type: 'range',
      min: -500,
      max: 0,
      step: 1,
      presetKey: 'gravity',
    },
    {
      key: 'iterations',
      label: 'Solver iterations',
      hint: 'Physics accuracy. Higher values feel firmer and more stable.',
      type: 'range',
      min: 1,
      max: 12,
      step: 1,
      presetKey: 'iterations',
    },
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

    var hint = document.createElement('span');
    hint.className = 'cloth-settings-hint';
    hint.textContent = f.hint;

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
      valueEl.textContent = formatSliderValue(input);
    }

    input.addEventListener('input', function () {
      var patch = buildPatchFromUI();
      applyToSolver(patch);
      updateValueLabels();
      savePreset(patch);
      onChange(patch);
    });

    row.appendChild(name);
    row.appendChild(hint);
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
      structuralCompliance: 0.000008,
      shearCompliance: 0.000035,
      bendCompliance: 0.0014,
      damping: 0.065,
      windStrength: 0.2,
      grabStiffness: 0.58,
      grabRadius: 2.1,
      gravity: -28,
      iterations: 10,
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
      valEl.textContent = formatSliderValue(inp);
    }
  }

  function formatSliderValue(input) {
    if (input.dataset.fieldType === 'stiffness') return input.value;

    var value = parseFloat(input.value);
    var step = parseFloat(input.step || '1');

    if (step >= 1) return String(Math.round(value));
    if (step >= 0.1) return value.toFixed(1).replace(/\.0$/, '');
    return value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
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
