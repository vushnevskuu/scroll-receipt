import { createReceiptCloth } from './cloth/receipt-cloth.js';
import { createReceiptSpring } from './receipt-spring.js';

var FEED_MS = 2600;
var scrollTemplate = '';
var isDetaching = false;
var motionEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var clothInstance = null;

var slot = document.querySelector('.receipt-slot');
var scroll = document.querySelector('.receipt-scroll');
var canvas = document.querySelector('#receipt-canvas');

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

  var mouthTop = window.innerHeight * 0.5 + height;
  mouthTop = Math.min(mouthTop, window.innerHeight - 40);
  mouthTop = Math.max(mouthTop, height + 32);
  document.documentElement.style.setProperty('--mouth-top', mouthTop + 'px');
}

function getReceiptEl(scrollEl) {
  return scrollEl.querySelector('.receipt');
}

function stopInteractions(scrollEl) {
  if (scrollEl._spring) {
    scrollEl._spring.stop();
    scrollEl._spring = null;
  }
}

function startFeed(scrollEl) {
  stopInteractions(scrollEl);
  if (clothInstance) {
    clothInstance.destroy();
    clothInstance = null;
  }

  scrollEl.classList.remove('is-fed', 'is-detached', 'is-cloth');
  scrollEl.style.removeProperty('transform');
  scrollEl.style.removeProperty('animation');
  scrollEl.style.removeProperty('will-change');
  scrollEl.style.removeProperty('position');
  scrollEl.style.removeProperty('left');
  scrollEl.style.removeProperty('top');
  scrollEl.style.removeProperty('width');
  scrollEl.style.removeProperty('z-index');

  var paper = getReceiptEl(scrollEl);
  if (paper) {
    paper.style.removeProperty('transform');
    paper.style.removeProperty('box-shadow');
    paper.style.removeProperty('visibility');
  }

  document.documentElement.classList.add('printing');

  requestAnimationFrame(function () {
    scrollEl.classList.add('is-feeding');
  });
}

async function onFeedComplete(scrollEl) {
  scrollEl.classList.remove('is-feeding');
  scrollEl.classList.add('is-fed');
  document.documentElement.classList.remove('printing');

  if (!motionEnabled) return;

  var useCloth = canvas && motionEnabled;

  if (useCloth) {
    clothInstance = createReceiptCloth({
      canvas: '#receipt-canvas',
      onDownload: function () {
        void detachReceipt(scrollEl);
      },
    });
    var ok = await clothInstance.init(scrollEl);
    if (ok) {
      clothInstance.hideDom(scrollEl);
      scrollEl.classList.add('is-cloth');
      clothInstance.start();
      return;
    }
    if (clothInstance) {
      clothInstance.destroy();
      clothInstance = null;
    }
  }

  var paper = getReceiptEl(scrollEl);
  if (!paper) return;
  var spring = createReceiptSpring(paper);
  scrollEl._spring = spring;
  spring.start();
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
  isDetaching = false;
}

async function detachReceipt(scrollEl) {
  if (isDetaching || !scrollEl.classList.contains('is-fed')) return;
  isDetaching = true;

  if (clothInstance) {
    clothInstance.stop();
    clothInstance.destroy();
    clothInstance = null;
    var paper = getReceiptEl(scrollEl);
    if (paper) paper.style.visibility = '';
  }

  stopInteractions(scrollEl);

  var rect = scrollEl.getBoundingClientRect();
  var paper = getReceiptEl(scrollEl);

  document.body.appendChild(scrollEl);
  slot.style.height = '0';

  scrollEl.style.position = 'fixed';
  scrollEl.style.left = rect.left + 'px';
  scrollEl.style.top = rect.top + 'px';
  scrollEl.style.width = rect.width + 'px';
  scrollEl.style.margin = '0';
  scrollEl.style.zIndex = '20';
  scrollEl.classList.add('is-detached');
  scrollEl.classList.remove('is-fed', 'is-cloth');

  if (motionEnabled && paper) {
    var flySpring = createReceiptSpring(paper, {
      maxX: 1200,
      maxY: 1200,
      maxRot: 10,
      idleAmp: 0,
    });
    flySpring.start();
    await flySpring.flyToViewportCenter();
    flySpring.stop();
  }

  scrollEl.remove();
  reprint();
}

function wireReceipt(scrollEl) {
  var downloadBtn = scrollEl.querySelector('.btn-primary');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function (e) {
      if (scrollEl.classList.contains('is-cloth')) {
        e.preventDefault();
      }
      void detachReceipt(scrollEl);
    });
  }

  function finishFeed() {
    if (scrollEl.classList.contains('is-fed')) return;
    void onFeedComplete(scrollEl);
  }

  scrollEl.addEventListener('animationend', function onFeedEnd(event) {
    if (event.animationName !== 'paper-feed') return;
    scrollEl.removeEventListener('animationend', onFeedEnd);
    finishFeed();
  });

  setTimeout(finishFeed, FEED_MS + 200);
}

async function boot() {
  if (!slot || !scroll) return;

  await document.fonts.ready;

  updateDate(scroll);
  scrollTemplate = scroll.innerHTML;
  positionPrinter(scroll);

  if (!motionEnabled) {
    document.documentElement.classList.add('motion-off');
    scroll.classList.add('is-fed');
    wireReceipt(scroll);
    return;
  }

  wireReceipt(scroll);
  startFeed(scroll);

  window.addEventListener(
    'resize',
    function () {
      var active = slot.querySelector('.receipt-scroll.is-fed, .receipt-scroll.is-feeding');
      if (active) positionPrinter(active);
    },
    { passive: true }
  );
}

boot();
