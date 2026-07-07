export function measureUvRegions(article) {
  var rect = article.getBoundingClientRect();
  var regions = {};

  var tearZone = article.querySelector('.receipt-tear-zone');
  if (tearZone) {
    var tz = tearZone.getBoundingClientRect();
    regions.tear = {
      u0: 0,
      v0: (tz.top - rect.top) / rect.height,
      u1: 1,
      v1: (tz.bottom - rect.top) / rect.height,
      href: tearZone.getAttribute('data-download-href') || '',
    };
  }

  var links = article.querySelectorAll('.fine a');
  regions.links = [];
  links.forEach(function (a) {
    var r = a.getBoundingClientRect();
    regions.links.push({
      u0: (r.left - rect.left) / rect.width,
      v0: (r.top - rect.top) / rect.height,
      u1: (r.right - rect.left) / rect.width,
      v1: (r.bottom - rect.top) / rect.height,
      href: a.getAttribute('href'),
      label: a.textContent.trim(),
    });
  });

  return regions;
}

export function hitUvRegion(regions, u, v) {
  if (!regions) return null;
  for (var i = 0; i < regions.links.length; i++) {
    var L = regions.links[i];
    if (u >= L.u0 && u <= L.u1 && v >= L.v0 && v <= L.v1) {
      return { type: 'link', href: L.href, label: L.label };
    }
  }
  if (regions.tear && u >= regions.tear.u0 && u <= regions.tear.u1 && v >= regions.tear.v0 && v <= regions.tear.v1) {
    return { type: 'tear', href: regions.tear.href, v0: regions.tear.v0 };
  }
  return null;
}

var html2canvasLoader = null;

async function loadHtml2Canvas() {
  if (!html2canvasLoader) {
    html2canvasLoader = import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm').then(function (mod) {
      return mod.default || mod;
    });
  }
  return html2canvasLoader;
}

function copyComputedStyles(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) return;
  if (sourceNode.nodeType !== Node.ELEMENT_NODE || targetNode.nodeType !== Node.ELEMENT_NODE) return;

  var computed = window.getComputedStyle(sourceNode);
  var cssText = '';

  for (var i = 0; i < computed.length; i++) {
    var prop = computed[i];
    cssText += prop + ':' + computed.getPropertyValue(prop) + ';';
  }

  targetNode.style.cssText = cssText;

  var sourceChildren = sourceNode.children;
  var targetChildren = targetNode.children;
  var count = Math.min(sourceChildren.length, targetChildren.length);

  for (var j = 0; j < count; j++) {
    copyComputedStyles(sourceChildren[j], targetChildren[j]);
  }
}

function sanitizeCapturePerforation(root) {
  if (!root) return;
}

function mountCaptureClone(article, width, height) {
  var clone = article.cloneNode(true);
  copyComputedStyles(article, clone);
  clone.style.margin = '0';
  clone.style.width = width + 'px';
  clone.style.height = height + 'px';
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.filter = 'none';
  sanitizeCapturePerforation(clone);

  var mount = document.createElement('div');
  mount.style.position = 'fixed';
  mount.style.left = '-200vw';
  mount.style.top = '0';
  mount.style.width = width + 'px';
  mount.style.height = height + 'px';
  mount.style.overflow = 'visible';
  mount.style.pointerEvents = 'none';
  mount.style.opacity = '1';
  mount.style.zIndex = '-1';
  mount.appendChild(clone);
  document.body.appendChild(mount);

  return { mount: mount, clone: clone };
}

function punchPerforationHoles(targetCanvas, article, width, height) {
  if (!targetCanvas || !article || !width || !height) return;
}

export async function captureReceiptTexture(article) {
  var w = Math.max(article.offsetWidth, 320);
  var h = Math.max(article.offsetHeight, 480);
  var dpr = Math.min(window.devicePixelRatio, 2);
  var paperColor = window.getComputedStyle(article).backgroundColor || '#f6f2ea';
  var captureNodes = mountCaptureClone(article, w, h);
  var captureRoot = captureNodes.clone;

  try {
    var html2canvas = await loadHtml2Canvas();
    var rendered = await html2canvas(captureRoot, {
      backgroundColor: paperColor,
      foreignObjectRendering: false,
      imageTimeout: 0,
      logging: false,
      removeContainer: true,
      scale: dpr,
      useCORS: true,
      width: w,
      height: h,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });

    captureNodes.mount.remove();
    return { canvas: rendered, width: w, height: h };
  } catch (_err) {
    /* fall back to inline-svg capture below */
  }

  var canvas = document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var clone = captureRoot.cloneNode(true);
  var wrap = document.createElement('div');
  wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrap.style.width = w + 'px';
  wrap.style.height = h + 'px';
  wrap.style.background = paperColor;
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
      ctx.fillStyle = paperColor;
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

  captureNodes.mount.remove();
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
