var ARC_SAMPLES = 10;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function collectRow(article, selector) {
  if (!article) return [];

  var articleRect = article.getBoundingClientRect();
  var nodes = article.querySelectorAll(selector);
  var circles = [];

  for (var i = 0; i < nodes.length; i++) {
    var rect = nodes[i].getBoundingClientRect();
    if (!rect.width || !rect.height) continue;

    circles.push({
      cx: rect.left - articleRect.left + rect.width * 0.5,
      cy: rect.top - articleRect.top + rect.height * 0.5,
      r: Math.min(rect.width, rect.height) * 0.5,
    });
  }

  circles.sort(function (a, b) {
    return a.cx - b.cx;
  });

  return circles;
}

function appendTopScallops(parts, circles, width) {
  var cursorX = 0;
  if (!circles.length) {
    parts.push('L ' + round(width) + ' 0');
    return;
  }

  for (var c = 0; c < circles.length; c++) {
    var circle = circles[c];
    var startX = clamp(circle.cx - circle.r, 0, width);
    if (startX > cursorX) {
      parts.push('L ' + round(startX) + ' 0');
    }

    for (var step = 0; step <= ARC_SAMPLES; step++) {
      var t = Math.PI - (step / ARC_SAMPLES) * Math.PI;
      var x = clamp(circle.cx + circle.r * Math.cos(t), 0, width);
      var y = Math.max(0, circle.cy + circle.r * Math.sin(t) - circle.r);
      parts.push('L ' + round(x) + ' ' + round(y));
    }

    cursorX = clamp(circle.cx + circle.r, 0, width);
  }

  if (cursorX < width) {
    parts.push('L ' + round(width) + ' 0');
  }
}

function appendBottomScallops(parts, circles, width, height) {
  var cursorX = width;
  if (!circles.length) {
    parts.push('L 0 ' + round(height));
    return;
  }

  for (var c = circles.length - 1; c >= 0; c--) {
    var circle = circles[c];
    var startX = clamp(circle.cx + circle.r, 0, width);
    if (startX < cursorX) {
      parts.push('L ' + round(startX) + ' ' + round(height));
    }

    for (var step = 0; step <= ARC_SAMPLES; step++) {
      var t = (step / ARC_SAMPLES) * Math.PI;
      var x = clamp(circle.cx + circle.r * Math.cos(t), 0, width);
      var y = Math.min(height, circle.cy - circle.r * Math.sin(t) + circle.r);
      parts.push('L ' + round(x) + ' ' + round(y));
    }

    cursorX = clamp(circle.cx - circle.r, 0, width);
  }

  if (cursorX > 0) {
    parts.push('L 0 ' + round(height));
  }
}

export function measureReceiptPerforation(article) {
  return {
    bottom: collectRow(article, '.receipt-bottom-perforation span'),
  };
}

export function buildReceiptPerforationPath(width, height, perforation) {
  if (!width || !height) return '';

  var bottom = (perforation && perforation.bottom) || [];
  var parts = ['M 0 0', 'L ' + round(width) + ' 0'];

  if (!bottom.length) {
    parts.push('L ' + round(width) + ' ' + round(height));
    parts.push('L 0 ' + round(height));
    parts.push('Z');
    return parts.join(' ');
  }

  parts.push('L ' + round(width) + ' ' + round(height));

  for (var c = bottom.length - 1; c >= 0; c--) {
    var circle = bottom[c];
    var radius = circle.r;
    var startX = clamp(circle.cx + radius, 0, width);
    var endX = clamp(circle.cx - radius, 0, width);

    parts.push('L ' + round(startX) + ' ' + round(height));

    for (var step = 0; step <= ARC_SAMPLES; step++) {
      var t = (step / ARC_SAMPLES) * Math.PI;
      var x = clamp(circle.cx + radius * Math.cos(t), 0, width);
      var y = clamp(height - radius * Math.sin(t), 0, height);
      parts.push('L ' + round(x) + ' ' + round(y));
    }

    parts.push('L ' + round(endX) + ' ' + round(height));
  }

  parts.push('L 0 ' + round(height));
  parts.push('Z');
  return parts.join(' ');
}

export function applyReceiptPerforation(article) {
  if (!article) return null;

  var width = article.offsetWidth;
  var height = article.offsetHeight;
  if (!width || !height) return null;

  var perforation = measureReceiptPerforation(article);
  if (!perforation.bottom.length) {
    article.classList.remove('has-real-perforation');
    article.style.removeProperty('clip-path');
    article.style.removeProperty('-webkit-clip-path');
    return null;
  }

  var path = buildReceiptPerforationPath(width, height, perforation);
  article.classList.add('has-real-perforation');
  article.style.clipPath = 'path("' + path + '")';
  article.style.setProperty('-webkit-clip-path', 'path("' + path + '")');
  return perforation;
}

export function buildReceiptAlphaMask(width, height, perforation) {
  var canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  var ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var path = buildReceiptPerforationPath(width, height, perforation);
  ctx.fillStyle = '#fff';

  if (path && typeof Path2D !== 'undefined') {
    ctx.fill(new Path2D(path));
  } else {
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  return canvas;
}
