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

  document.documentElement.classList.add('printing');
})();
