(function () {
  var FEED_MS = 2600;
  var floated = false;

  var dateEl = document.getElementById('receipt-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  var slot = document.querySelector('.receipt-slot');
  var scroll = document.querySelector('.receipt-scroll');
  if (!slot || !scroll) return;

  var receiptHeight = scroll.offsetHeight;
  document.documentElement.style.setProperty('--receipt-h', receiptHeight + 'px');
  slot.style.height = receiptHeight + 'px';

  function freezeTransform() {
    var computed = getComputedStyle(scroll);
    scroll.style.animation = 'none';
    scroll.style.transform = computed.transform;
    void scroll.offsetHeight;
  }

  function floatReceipt() {
    if (floated) return;
    floated = true;

    freezeTransform();

    var rect = scroll.getBoundingClientRect();
    var centerX = window.innerWidth / 2;
    var centerY = window.innerHeight / 2;
    var originX = rect.left + rect.width / 2;
    var originY = rect.top + rect.height / 2;

    document.documentElement.style.setProperty('--lift-x', centerX - originX + 'px');
    document.documentElement.style.setProperty('--lift-y', centerY - originY + 'px');

    document.body.appendChild(scroll);
    slot.style.height = '0';

    scroll.style.position = 'fixed';
    scroll.style.left = rect.left + 'px';
    scroll.style.top = rect.top + 'px';
    scroll.style.width = rect.width + 'px';
    scroll.style.margin = '0';
    scroll.style.zIndex = '20';

    scroll.classList.remove('is-feeding');
    document.documentElement.classList.remove('printing');

    requestAnimationFrame(function () {
      scroll.style.removeProperty('animation');
      scroll.style.transform = 'translate3d(0, 0, 0) rotate(-1deg)';
      scroll.classList.add('is-floating');
    });
  }

  function startSway(event) {
    if (event.animationName !== 'receipt-lift') return;
    scroll.removeEventListener('animationend', startSway);
    scroll.classList.remove('is-floating');
    scroll.classList.add('is-swaying');
    scroll.style.willChange = 'auto';
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('motion-off');
    scroll.classList.remove('is-feeding');
    return;
  }

  scroll.addEventListener('animationend', startSway);

  scroll.addEventListener('animationend', function onFeedEnd(event) {
    if (event.animationName !== 'paper-feed') return;
    scroll.removeEventListener('animationend', onFeedEnd);
    floatReceipt();
  });

  requestAnimationFrame(function () {
    scroll.classList.add('is-feeding');
    document.documentElement.classList.add('printing');
  });

  setTimeout(function () {
    floatReceipt();
  }, FEED_MS + 120);
})();
