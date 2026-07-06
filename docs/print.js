(function () {
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

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('motion-off');
    slot.style.height = receiptHeight + 'px';
    return;
  }

  requestAnimationFrame(function () {
    document.documentElement.classList.add('printing');
  });
})();
