(function () {
  var dateEl = document.getElementById('receipt-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('motion-off');
    return;
  }

  var lines = document.querySelectorAll('.print-line');
  var duration = 3200;
  var startDelay = 180;
  var step = (duration - startDelay) / Math.max(lines.length, 1);

  lines.forEach(function (line, index) {
    var reverseIndex = lines.length - 1 - index;
    line.style.setProperty('--print-delay', startDelay + reverseIndex * step + 'ms');
  });

  document.documentElement.classList.add('printing');
})();
