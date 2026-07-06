(function () {
  var FEED_MS = 3200;

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

  function floatReceipt() {
    var rect = scroll.getBoundingClientRect();
    var centerX = window.innerWidth / 2;
    var centerY = window.innerHeight / 2;
    var originX = rect.left + rect.width / 2;
    var originY = rect.top + rect.height / 2;

    document.documentElement.style.setProperty('--lift-x', centerX - originX + 'px');
    document.documentElement.style.setProperty('--lift-y', centerY - originY + 'px');

    slot.style.height = '0';
    slot.style.visibility = 'hidden';

    scroll.style.position = 'fixed';
    scroll.style.left = rect.left + 'px';
    scroll.style.top = rect.top + 'px';
    scroll.style.width = rect.width + 'px';
    scroll.style.transform = 'translate3d(0, 0, 0) rotate(-1deg)';

    document.documentElement.classList.remove('printing');
    document.documentElement.classList.add('receipt-floating');
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('motion-off');
    slot.style.height = receiptHeight + 'px';
    return;
  }

  requestAnimationFrame(function () {
    document.documentElement.classList.add('printing');
  });

  scroll.addEventListener('animationend', function onFeedEnd(event) {
    if (event.animationName !== 'paper-feed') return;
    scroll.removeEventListener('animationend', onFeedEnd);
    floatReceipt();
  });

  setTimeout(function () {
    if (!document.documentElement.classList.contains('receipt-floating')) {
      floatReceipt();
    }
  }, FEED_MS + 120);
})();
