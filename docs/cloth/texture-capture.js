export function measureUvRegions(article) {
  var rect = article.getBoundingClientRect();
  var regions = {};

  var download = article.querySelector('.btn-primary');
  if (download) {
    var r = download.getBoundingClientRect();
    regions.download = {
      u0: (r.left - rect.left) / rect.width,
      v0: 1 - (r.bottom - rect.top) / rect.height,
      u1: (r.right - rect.left) / rect.width,
      v1: 1 - (r.top - rect.top) / rect.height,
      href: download.getAttribute('href'),
    };
  }

  var links = article.querySelectorAll('.fine a');
  regions.links = [];
  links.forEach(function (a) {
    var r = a.getBoundingClientRect();
    regions.links.push({
      u0: (r.left - rect.left) / rect.width,
      v0: 1 - (r.bottom - rect.top) / rect.height,
      u1: (r.right - rect.left) / rect.width,
      v1: 1 - (r.top - rect.top) / rect.height,
      href: a.getAttribute('href'),
      label: a.textContent.trim(),
    });
  });

  return regions;
}

export function hitUvRegion(regions, u, v) {
  if (!regions) return null;
  if (regions.download && u >= regions.download.u0 && u <= regions.download.u1 && v >= regions.download.v0 && v <= regions.download.v1) {
    return { type: 'download', href: regions.download.href };
  }
  for (var i = 0; i < regions.links.length; i++) {
    var L = regions.links[i];
    if (u >= L.u0 && u <= L.u1 && v >= L.v0 && v <= L.v1) {
      return { type: 'link', href: L.href, label: L.label };
    }
  }
  return null;
}

export async function captureReceiptTexture(article) {
  var w = Math.max(article.offsetWidth, 320);
  var h = Math.max(article.offsetHeight, 480);
  var dpr = Math.min(window.devicePixelRatio, 2);
  var canvas = document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var clone = article.cloneNode(true);
  clone.style.cssText = 'margin:0;box-shadow:none;width:' + w + 'px;background:#f6f2ea;color:#1a1916;font-family:IBM Plex Mono,monospace;';
  var wrap = document.createElement('div');
  wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrap.appendChild(clone);
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '"><foreignObject width="100%" height="100%">' +
    new XMLSerializer().serializeToString(wrap) +
    '</foreignObject></svg>';
  var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  await new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () {
      ctx.fillStyle = '#f6f2ea';
      ctx.fillRect(0, 0, w, h);
      try {
        ctx.drawImage(img, 0, 0, w, h);
      } catch (_e) {
        drawFallback(ctx, w, h);
      }
      resolve();
    };
    img.onerror = function () {
      drawFallback(ctx, w, h);
      resolve();
    };
    img.src = url;
  });

  return { canvas: canvas, width: w, height: h };
}

function drawFallback(ctx, w, h) {
  ctx.fillStyle = '#f6f2ea';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1916';
  ctx.font = '600 20px IBM Plex Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SCROLL RECEIPT', w * 0.5, 56);
}
