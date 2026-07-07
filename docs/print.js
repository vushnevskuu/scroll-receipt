import { createReceiptCloth } from './cloth/receipt-cloth.js?v=62';
import { applyReceiptPerforation } from './cloth/receipt-perforation.js?v=63';
import { createReceiptSpring } from './receipt-spring.js?v=50';

var FEED_MS = 2600;
var REPRINT_DELAY_MS = 2200;
var DOWNLOAD_HREF = 'scroll-receipt-2.0.0-chrome.zip';
var scrollTemplate = '';
var isDetaching = false;
var motionEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var USE_CLOTH_PHYSICS = true;
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
  applyReceiptPerforation(getReceiptEl(scrollEl));

  var chassis = document.querySelector('.printer-chassis');
  var chassisHeight = chassis ? chassis.offsetHeight : 38;
  // Printer mouth sits above the receipt; center the receipt body on the viewport.
  var mouthTop = Math.round(window.innerHeight * 0.5 - height * 0.5 - chassisHeight);
  mouthTop = Math.max(12, Math.min(mouthTop, window.innerHeight - height - chassisHeight - 12));
  document.documentElement.style.setProperty('--mouth-top', mouthTop + 'px');
}

function getReceiptEl(scrollEl) {
  return scrollEl.querySelector('.receipt');
}

function triggerDownload(href) {
  var a = document.createElement('a');
  a.href = href || DOWNLOAD_HREF;
  a.download = '';
  a.click();
}

function canUseImmediateCloth() {
  return USE_CLOTH_PHYSICS && canvas && motionEnabled;
}

function measureFeedTargetRect(scrollEl) {
  var paper = getReceiptEl(scrollEl);
  if (!paper) return null;

  var rect = paper.getBoundingClientRect();
  var needsFeedOffset = !scrollEl.classList.contains('is-fed') && !scrollEl.classList.contains('is-feeding');
  var feedOffset = needsFeedOffset ? scrollEl.offsetHeight : 0;

  return {
    left: rect.left,
    top: rect.top + feedOffset,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom + feedOffset,
  };
}

function scheduleDomFeedComplete(scrollEl) {
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

function animateClothFeed(scrollEl) {
  var startedAt = performance.now();
  canvas.style.pointerEvents = 'none';

  function frame(now) {
    if (!clothInstance) return;
    var progress = Math.min(1, (now - startedAt) / FEED_MS);
    clothInstance.setRevealProgress(progress);

    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }

    clothInstance.setRevealProgress(1);
    canvas.style.pointerEvents = 'auto';
    scrollEl.classList.add('is-fed');
    document.documentElement.classList.remove('printing');
  }

  requestAnimationFrame(frame);
}

async function startClothFeed(scrollEl) {
  var targetRect = measureFeedTargetRect(scrollEl);
  if (!targetRect) {
    requestAnimationFrame(function () {
      scrollEl.classList.add('is-feeding');
      scheduleDomFeedComplete(scrollEl);
    });
    return;
  }

  clothInstance = createReceiptCloth({
    canvas: '#receipt-canvas',
    onTear: function (href) {
      void tearReceipt(scrollEl, href);
    },
  });

  var ok = await clothInstance.init(scrollEl, { rect: targetRect });
  if (!ok) {
    if (clothInstance) {
      clothInstance.destroy();
      clothInstance = null;
    }
    requestAnimationFrame(function () {
      scrollEl.classList.add('is-feeding');
      scheduleDomFeedComplete(scrollEl);
    });
    return;
  }

  clothInstance.hideDom(scrollEl);
  scrollEl.classList.add('is-cloth');
  clothInstance.setRevealProgress(0.015);
  clothInstance.start();
  animateClothFeed(scrollEl);
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
  canvas.style.removeProperty('pointer-events');

  var paper = getReceiptEl(scrollEl);
  if (paper) {
    paper.style.removeProperty('transform');
    paper.style.removeProperty('box-shadow');
    paper.style.removeProperty('visibility');
    paper.style.removeProperty('clip-path');
    paper.style.removeProperty('opacity');
    paper.classList.remove('receipt-remnant', 'is-removing');
  }

  document.documentElement.classList.add('printing');

  if (canUseImmediateCloth()) {
    void startClothFeed(scrollEl);
    return;
  }

  requestAnimationFrame(function () {
    scrollEl.classList.add('is-feeding');
    scheduleDomFeedComplete(scrollEl);
  });
}

async function onFeedComplete(scrollEl) {
  scrollEl.classList.remove('is-feeding');
  scrollEl.classList.add('is-fed');
  document.documentElement.classList.remove('printing');

  if (!motionEnabled) return;

  var useCloth = USE_CLOTH_PHYSICS && canvas && motionEnabled;

  if (useCloth) {
    clothInstance = createReceiptCloth({
      canvas: '#receipt-canvas',
      onTear: function (href) {
        void tearReceipt(scrollEl, href);
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

async function tearReceipt(scrollEl, href) {
  if (isDetaching || !scrollEl.classList.contains('is-fed')) return;
  isDetaching = true;
  var tearZone = scrollEl.querySelector('.receipt-tear-zone');
  var article = getReceiptEl(scrollEl);
  var downloadHref = href || (tearZone ? tearZone.getAttribute('data-download-href') : '') || DOWNLOAD_HREF;

  if (clothInstance) {
    // Keep the DOM receipt hidden after the cloth fall so it does not flash
    // back for a moment before the next print cycle starts.
    if (article) article.style.visibility = 'hidden';
    clothInstance.stop();
    clothInstance.destroy();
    clothInstance = null;
  }

  stopInteractions(scrollEl);
  triggerDownload(downloadHref);

  window.setTimeout(function () {
    scrollEl.remove();
    reprint();
  }, REPRINT_DELAY_MS);
}

function wireReceipt(scrollEl) {
  var tearZone = scrollEl.querySelector('.receipt-tear-zone');
  if (tearZone) {
    tearZone.addEventListener('click', function (e) {
      if (e.target.closest('.fine a')) return;
      if (scrollEl.classList.contains('is-cloth')) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      void tearReceipt(scrollEl, tearZone.getAttribute('data-download-href') || DOWNLOAD_HREF);
    });
  }
}

async function boot() {
  if (!slot || !scroll) return;

  await document.fonts.ready;

  updateDate(scroll);
  positionPrinter(scroll);
  scrollTemplate = scroll.innerHTML;

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
