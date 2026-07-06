import { createReceiptPhysics } from './receipt-physics.js';

var FEED_MS = 2600;
var scrollTemplate = '';
var isFloating = false;
var physics = null;
var physicsReady = false;
var usePhysics =
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  new URLSearchParams(window.location.search).get('physics') !== '0';

var slot = document.querySelector('.receipt-slot');
var scroll = document.querySelector('.receipt-scroll');
if (!slot || !scroll) {
  // module must not throw on missing DOM
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function updateDate(root) {
  var dateEl = root.querySelector('#receipt-date');
  if (dateEl) dateEl.textContent = formatDate();
}

function positionPrinter(scrollEl) {
  var height = scrollEl.offsetHeight;
  document.documentElement.style.setProperty('--receipt-h', height + 'px');
  slot.style.height = height + 'px';
}

function freezeTransform(scrollEl) {
  var computed = getComputedStyle(scrollEl);
  scrollEl.style.animation = 'none';
  scrollEl.style.transform = computed.transform;
  void scrollEl.offsetHeight;
}

function startFeed(scrollEl) {
  scrollEl.classList.remove('is-fed', 'is-floating', 'is-swaying');
  scrollEl.style.removeProperty('transform');
  scrollEl.style.removeProperty('animation');
  scrollEl.style.removeProperty('will-change');
  scrollEl.style.removeProperty('visibility');

  document.documentElement.classList.add('printing');

  requestAnimationFrame(function () {
    scrollEl.classList.add('is-feeding');
  });
}

function onFeedComplete(scrollEl) {
  scrollEl.classList.remove('is-feeding');
  scrollEl.classList.add('is-fed');
  document.documentElement.classList.remove('printing');
}

function startSway(scrollEl, event) {
  if (event.animationName !== 'receipt-lift') return;
  scrollEl.removeEventListener('animationend', scrollEl._onSway);
  scrollEl.classList.remove('is-floating');
  scrollEl.classList.add('is-swaying');
  scrollEl.style.willChange = 'auto';
}

function cssFloatReceipt(scrollEl) {
  freezeTransform(scrollEl);

  var rect = scrollEl.getBoundingClientRect();
  var centerX = window.innerWidth / 2;
  var centerY = window.innerHeight / 2;
  var originX = rect.left + rect.width / 2;
  var originY = rect.top + rect.height / 2;

  scrollEl.style.setProperty('--lift-x', centerX - originX + 'px');
  scrollEl.style.setProperty('--lift-y', centerY - originY + 'px');

  document.body.appendChild(scrollEl);
  slot.style.height = '0';

  scrollEl.style.position = 'fixed';
  scrollEl.style.left = rect.left + 'px';
  scrollEl.style.top = rect.top + 'px';
  scrollEl.style.width = rect.width + 'px';
  scrollEl.style.margin = '0';
  scrollEl.style.zIndex = '20';

  scrollEl._onSway = function (event) {
    startSway(scrollEl, event);
  };
  scrollEl.addEventListener('animationend', scrollEl._onSway);

  requestAnimationFrame(function () {
    scrollEl.style.removeProperty('animation');
    scrollEl.style.removeProperty('transform');
    scrollEl.classList.add('is-floating');
    scrollEl.classList.remove('is-fed');
  });
}

function reprint() {
  var newScroll = document.createElement('div');
  newScroll.className = 'receipt-scroll';
  newScroll.innerHTML = scrollTemplate;
  slot.appendChild(newScroll);

  updateDate(newScroll);
  positionPrinter(newScroll);
  wireReceipt(newScroll);
  startFeed(newScroll);
  isFloating = false;
}

async function detachReceipt(scrollEl) {
  if (isFloating || !scrollEl.classList.contains('is-fed')) return;
  isFloating = true;

  var handoffRect = scrollEl.getBoundingClientRect();

  if (usePhysics && physicsReady && physics) {
    try {
      var ok = await physics.handoff(scrollEl, handoffRect);
      if (ok) {
        scrollEl.remove();
        slot.style.height = '0';
        reprint();
        return;
      }
    } catch (_err) {
      scrollEl.style.removeProperty('visibility');
      scrollEl.removeAttribute('aria-hidden');
    }
  }

  cssFloatReceipt(scrollEl);
  reprint();
}

function wireReceipt(scrollEl) {
  var downloadBtn = scrollEl.querySelector('.btn-primary');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
      void detachReceipt(scrollEl);
    });
  }

  scrollEl.addEventListener('animationend', function onFeedEnd(event) {
    if (event.animationName !== 'paper-feed') return;
    scrollEl.removeEventListener('animationend', onFeedEnd);
    onFeedComplete(scrollEl);
  });
}

async function boot() {
  if (!slot || !scroll) return;

  await document.fonts.ready;

  updateDate(scroll);
  scrollTemplate = scroll.innerHTML;
  positionPrinter(scroll);

  if (usePhysics) {
    physics = createReceiptPhysics({ canvas: '#receipt-canvas' });
    if (physics) {
      physicsReady = await physics.init();
    }
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('motion-off');
    scroll.classList.add('is-fed');
    wireReceipt(scroll);
    return;
  }

  wireReceipt(scroll);
  startFeed(scroll);
}

boot();
