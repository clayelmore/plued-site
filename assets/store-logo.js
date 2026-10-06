/* Automatic store logos (owner, 2026-10-05: "Is there any way to make it
   automatic?"). The "Your logo" panel on the Store Plan status page
   (/store/s/ and /es/store/s/). Loaded on demand by store-status.js.

   The manager picks a PNG, JPG or SVG. Everything below happens in this
   browser, before anything is sent:
     1. draw it on a working canvas (longest side up to 1024 px);
     2. an opaque image on a solid background loses the background, by the
        Pack Builder's knockout rule (web_admin/lib/knockout.dart, same
        numbers): the four corners agree within 30, a flood fill from the
        border at tolerance 48, kept only when 10-90% of the pixels go, then
        one defringe pass at 1.8x. Corners that disagree keep the background
        (the preview shows it, so nothing is a surprise);
     3. a WIDE logo (aspect over 1.6 or under 0.625) gets two choices:
        "Crop to your symbol" (a square the manager drags, or moves with the
        arrow keys, + and - to resize) or "Use a monogram" (1-2 initials of
        the store name in the logo's main color, darkened until it reads on
        the app's cream badge). Square-ish logos just fit;
     4. the result is a 512x512 PNG with the mark inside the centered
        448 px safe box, previewed in the app's own badge (cream rounded
        square, kraft 1 px border, radius 28%, image at 80%) at 36 px beside
        the store name (the My Store shelf) and at 72 px (the import welcome);
     5. "Use this logo" (after the consent box) posts it to the worker, which
        checks it, screens it, stores it and puts it on the store's pack.
   Every sentence comes from PluedStore.t (store.js). Plain ES5. */
(function () {
  'use strict';
  var S = window.PluedStore;
  var SIDE = 512;
  var SAFE = 448;
  var WORK = 1024;
  var MAX_INPUT = 5 * 1024 * 1024;
  var MAX_PNG = 300 * 1024; // the worker's cap (the app's own is 400 KB)
  var CREAM = [250, 246, 238]; // the app badge, both themes
  var INK = [30, 59, 47];

  // ---- Pure image helpers (no DOM beyond canvas) ------------------------

  /* The Pack Builder's knockout (web_admin/lib/knockout.dart), ported.
     Mutates `d` (RGBA ImageData.data). Returns 'transparent' (already a
     cutout), 'kept' (busy or unsafe background: untouched) or 'removed'. */
  function knockout(d, w, h) {
    if (w < 8 || h < 8) return 'kept';
    var corners = [(1 * w + 1) * 4, (1 * w + (w - 2)) * 4, ((h - 2) * w + 1) * 4, ((h - 2) * w + (w - 2)) * 4];
    var i, c;
    for (i = 0; i < 4; i++) if (d[corners[i] + 3] < 10) return 'transparent';
    var avg = [0, 0, 0];
    for (c = 0; c < 3; c++) {
      var sum = 0;
      for (i = 0; i < 4; i++) sum += d[corners[i] + c];
      avg[c] = Math.floor(sum / 4);
    }
    for (i = 0; i < 4; i++) for (c = 0; c < 3; c++) if (Math.abs(d[corners[i] + c] - avg[c]) > 30) return 'kept';
    var tol = 48;
    var tolSq = tol * tol;
    var fringeTol = Math.floor(tol * 18 / 10);
    var fringeSq = fringeTol * fringeTol;
    function dist(p) {
      var j = p * 4, r = d[j] - avg[0], g = d[j + 1] - avg[1], b = d[j + 2] - avg[2];
      return r * r + g * g + b * b;
    }
    var n = w * h;
    var cleared = new Uint8Array(n);
    var seen = new Uint8Array(n);
    var queue = new Int32Array(n);
    var head = 0, tail = 0, x, y, p;
    function push(q) { if (!seen[q]) { seen[q] = 1; queue[tail++] = q; } }
    for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    var removed = 0;
    while (head < tail) {
      p = queue[head++];
      if (dist(p) > tolSq) continue;
      cleared[p] = 1;
      removed++;
      x = p % w; y = (p - x) / w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w);
      if (y < h - 1) push(p + w);
    }
    var frac = removed / n;
    if (frac < 0.10 || frac > 0.90) return 'kept';
    var fringe = [];
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        p = y * w + x;
        if (cleared[p]) continue;
        var touches = (x > 0 && cleared[p - 1]) || (x < w - 1 && cleared[p + 1]) ||
          (y > 0 && cleared[p - w]) || (y < h - 1 && cleared[p + w]);
        if (touches && dist(p) <= fringeSq) fringe.push(p);
      }
    }
    for (i = 0; i < fringe.length; i++) cleared[fringe[i]] = 1;
    for (p = 0; p < n; p++) {
      if (cleared[p]) { var k = p * 4; d[k] = 0; d[k + 1] = 0; d[k + 2] = 0; d[k + 3] = 0; }
    }
    return 'removed';
  }

  /* The box around every pixel with alpha over 10; the whole frame when
     nothing is transparent; null when nothing is visible at all. */
  function contentBox(d, w, h) {
    var minX = w, minY = h, maxX = -1, maxY = -1, x, y;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function isWide(w, h) {
    var a = w / h;
    return a > 1.6 || a < 0.625;
  }

  /* One or two initials: the first letter of the first two words, skipping
     "the", "and", "&" and the like ("The Hometown Market" -> "HM"). */
  function initialsFor(store) {
    var skip = { the: 1, and: 1, of: 1, el: 1, la: 1, los: 1, las: 1, y: 1, de: 1, del: 1 };
    var words = String(store || '').split(/[^A-Za-z0-9À-ɏ]+/);
    var out = '';
    for (var i = 0; i < words.length && out.length < 2; i++) {
      var word = words[i];
      if (!word || (skip[word.toLowerCase()] && words.length > 2)) continue;
      out += word.charAt(0).toUpperCase();
    }
    return out || 'P';
  }

  function luminance(rgb) {
    var v = [];
    for (var i = 0; i < 3; i++) {
      var s = rgb[i] / 255;
      v.push(s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4));
    }
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* Darker until it reads on the cream badge (WCAG 4.5:1, large text needs
     3:1, so this is generous). */
  function readableOnCream(rgb) {
    var c = [rgb[0], rgb[1], rgb[2]];
    for (var n = 0; n < 40 && contrast(c, CREAM) < 4.5; n++) {
      c = [Math.round(c[0] * 0.9), Math.round(c[1] * 0.9), Math.round(c[2] * 0.9)];
    }
    return c;
  }

  /* The logo's main color: the most common opaque color, leaving out the
     background (when it was kept) and near-white. Ink green when there is
     nothing to go on. */
  function dominantColor(d, w, h, bg) {
    var counts = {}, sums = {}, best = null, bestN = 0;
    for (var p = 0; p < w * h; p++) {
      var i = p * 4;
      if (d[i + 3] < 200) continue;
      var r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 235 && g > 235 && b > 235) continue;
      if (bg) {
        var dr = r - bg[0], dg = g - bg[1], db = b - bg[2];
        if (dr * dr + dg * dg + db * db < 60 * 60) continue;
      }
      var key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
      counts[key] = (counts[key] || 0) + 1;
      var s = sums[key] || (sums[key] = [0, 0, 0]);
      s[0] += r; s[1] += g; s[2] += b;
      if (counts[key] > bestN) { bestN = counts[key]; best = key; }
    }
    if (!best) return INK.slice();
    var t = sums[best];
    return [Math.round(t[0] / bestN), Math.round(t[1] / bestN), Math.round(t[2] / bestN)];
  }

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* Draws region (sx, sy, sw, sh) of `src` contained in the centered safe
     box of a fresh 512x512 transparent canvas. */
  function placeInSafeBox(src, sx, sy, sw, sh) {
    var out = canvas(SIDE, SIDE);
    var g = out.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    var scale = Math.min(SAFE / sw, SAFE / sh);
    var dw = sw * scale, dh = sh * scale;
    g.drawImage(src, sx, sy, sw, sh, (SIDE - dw) / 2, (SIDE - dh) / 2, dw, dh);
    return out;
  }

  var MONO_FONT = 'Fraunces, Georgia, "Times New Roman", serif';

  function drawMonogram(text, rgb) {
    var out = canvas(SIDE, SIDE);
    var g = out.getContext('2d');
    var px = 400;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    var m, tw, asc, desc;
    for (var n = 0; n < 40; n++) {
      g.font = '700 ' + px + 'px ' + MONO_FONT;
      m = g.measureText(text);
      tw = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width) || m.width;
      asc = m.actualBoundingBoxAscent || px * 0.72;
      desc = m.actualBoundingBoxDescent || 0;
      if (tw <= SAFE - 40 && asc + desc <= SAFE - 80) break;
      px -= 10;
    }
    g.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    var left = m.actualBoundingBoxLeft || tw / 2;
    var right = m.actualBoundingBoxRight || tw / 2;
    g.fillText(text, SIDE / 2 + (left - right) / 2, SIDE / 2 + (asc - desc) / 2);
    return out;
  }

  /* PNG for the worker, under its cap. A logo with photo-like detail can
     run over: then the colors are stepped down (32, 16, 8 levels) until it
     fits; null when even that is too big. */
  function encodePng(c) {
    var url = c.toDataURL('image/png');
    var levels = [32, 16, 8];
    for (var n = 0; ; n++) {
      var b64 = url.slice(url.indexOf(',') + 1);
      var bytes = Math.floor(b64.length * 3 / 4) - (b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0);
      if (bytes <= MAX_PNG) return { url: url, b64: b64, bytes: bytes };
      if (n >= levels.length) return null;
      var copy = canvas(c.width, c.height);
      var g = copy.getContext('2d');
      g.drawImage(c, 0, 0);
      var img = g.getImageData(0, 0, c.width, c.height);
      var d = img.data, step = 256 / levels[n];
      for (var i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, Math.round(d[i] / step) * step);
        d[i + 1] = Math.min(255, Math.round(d[i + 1] / step) * step);
        d[i + 2] = Math.min(255, Math.round(d[i + 2] / step) * step);
        d[i + 3] = d[i + 3] < 16 ? 0 : d[i + 3] > 240 ? 255 : d[i + 3];
      }
      g.putImageData(img, 0, 0);
      url = copy.toDataURL('image/png');
    }
  }

  function kindOf(file) {
    var name = String(file.name || '').toLowerCase();
    if (/\.png$/.test(name) || file.type === 'image/png') return 'png';
    if (/\.jpe?g$/.test(name) || file.type === 'image/jpeg') return 'jpg';
    if (/\.svg$/.test(name) || file.type === 'image/svg+xml') return 'svg';
    return null;
  }

  function readAs(file, how) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('read')); };
      if (how === 'text') r.readAsText(file); else r.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('decode')); };
      img.src = src;
    });
  }

  /* An SVG often has only a viewBox; give it a real size (longest side
     1024) so it draws sharp and the canvas knows its shape. */
  function sizedSvg(text) {
    var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    var root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new Error('svg');
    var vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    var w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height'));
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) { w = vb[2]; h = vb[3]; }
    if (!(w > 0 && h > 0)) { w = WORK; h = WORK; }
    var k = WORK / Math.max(w, h);
    root.setAttribute('width', String(Math.round(w * k)));
    root.setAttribute('height', String(Math.round(h * k)));
    if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(root);
  }

  /* file -> {work: canvas (background handled), bg, box, wide, color}. */
  function prepare(file) {
    var kind = kindOf(file);
    var source = kind === 'svg'
      ? readAs(file, 'text').then(function (text) {
        return URL.createObjectURL(new Blob([sizedSvg(text)], { type: 'image/svg+xml' }));
      })
      : Promise.resolve(URL.createObjectURL(file));
    return source.then(function (url) {
      return loadImage(url).then(function (img) {
        URL.revokeObjectURL(url);
        var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        if (!(iw > 0 && ih > 0)) throw new Error('size');
        var k = Math.min(1, WORK / Math.max(iw, ih));
        if (kind === 'svg') k = WORK / Math.max(iw, ih);
        var w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
        var work = canvas(w, h);
        var g = work.getContext('2d');
        g.drawImage(img, 0, 0, w, h);
        var data = g.getImageData(0, 0, w, h);
        var bgColor = [data.data[(w + 1) * 4], data.data[(w + 1) * 4 + 1], data.data[(w + 1) * 4 + 2]];
        var bg = knockout(data.data, w, h);
        if (bg === 'removed') g.putImageData(data, 0, 0);
        var box = bg === 'kept' ? { x: 0, y: 0, w: w, h: h } : contentBox(data.data, w, h);
        if (!box) throw new Error('empty');
        return {
          work: work, bg: bg, box: box, wide: isWide(box.w, box.h),
          color: readableOnCream(dominantColor(data.data, w, h, bg === 'kept' ? bgColor : null))
        };
      });
    });
  }

  // ---- The panel ----------------------------------------------------------

  var t = function (k, v) { return S.t(k, v); };
  var esc = function (v) { return S.esc(v); };

  function badgeHtml(size, url, alt) {
    return '<span class="logo-badge" style="width:' + size + 'px;height:' + size + 'px;border-radius:' + (size * 0.28).toFixed(1) + 'px">' +
      '<img src="' + esc(url) + '" alt="' + esc(alt) + '" width="' + Math.round(size * 0.8) + '" height="' + Math.round(size * 0.8) + '"></span>';
  }

  function previewHtml(url, store) {
    var alt = t('logoAlt', { store: store });
    return '<div class="logo-preview" role="group" aria-label="' + esc(t('logoPreview')) + '">' +
      '<div class="logo-preview-item"><span class="logo-shelf">' + badgeHtml(36, url, alt) + '<b>' + esc(store) + '</b></span>' +
      '<small>' + esc(t('logoPreviewShelf')) + '</small></div>' +
      '<div class="logo-preview-item">' + badgeHtml(72, url, '') + '<small>' + esc(t('logoPreviewWelcome')) + '</small></div></div>';
  }

  /* mount(section, ctx): ctx = {s, token, onSaved(body), onAskUs(), message} */
  function mount(section, ctx) {
    var s = ctx.s;
    var st = null; // the prepared image
    var mode = 'fit';
    var crop = null; // {x, y, size} in work-canvas pixels
    var initials = initialsFor(s.store);
    var result = null; // {canvas, png, source}
    var busy = false;

    var cur = s.logo;
    var html = '<h2 id="logo-heading">' + esc(t('logoHeading')) + '</h2>';
    if (cur && cur.url) {
      // Right after a save the status line below says it (and announces it);
      // the same sentence is not printed twice.
      html += '<div class="logo-current"><p class="logo-current-label">' + esc(t('logoCurrent')) + '</p>' + previewHtml(cur.url, s.store) +
        (ctx.message ? '' : '<p>' + esc(cur.pending ? t('logoPending') : t('logoCurrentSet')) + '</p>') + '</div>';
    }
    if (s.closed_at) {
      html += '<p>' + esc(t('logoClosed')) + '</p>';
      section.innerHTML = html;
      return;
    }
    html += '<p>' + esc(t('logoIntro')) + '</p>' +
      '<div class="row"><label class="button kraft logo-pick" for="logo-file">' + esc(cur ? t('logoChange') : t('logoChoose')) +
      '<input id="logo-file" class="visually-hidden" type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" aria-describedby="logo-file-note"></label>' +
      '<a class="text-button logo-ask" href="#requests" id="logo-ask">' + esc(t('logoAskUs')) + '</a></div>' +
      '<p class="file-note" id="logo-file-note">' + esc(t('logoFileNote')) + '</p>' +
      '<div id="logo-editor" hidden></div>' +
      '<p class="form-status" id="logo-status" aria-live="polite"></p>';
    section.innerHTML = html;
    var $ = function (id) { return section.querySelector('#' + id); };
    var status = $('logo-status');
    var editor = $('logo-editor');
    function setStatus(msg, cls) { status.textContent = msg || ''; status.className = 'form-status' + (cls ? ' ' + cls : ''); }
    if (ctx.message) setStatus(ctx.message.text, ctx.message.cls);

    $('logo-ask').addEventListener('click', function (ev) { ev.preventDefault(); if (ctx.onAskUs) ctx.onAskUs(); });

    $('logo-file').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      editor.hidden = true; editor.innerHTML = ''; result = null;
      if (!kindOf(file)) { setStatus(t('logoOnly'), 'err'); return; }
      if (file.size > MAX_INPUT) { setStatus(t('logoTooBigFile', { mb: (file.size / 1024 / 1024).toFixed(1) }), 'err'); return; }
      setStatus(t('logoWorking'));
      var fonts = document.fonts && document.fonts.load ? document.fonts.load('700 200px Fraunces').catch(function () {}) : Promise.resolve();
      Promise.all([prepare(file), fonts]).then(function (r) {
        st = r[0];
        mode = st.wide ? 'crop' : 'fit';
        var side = Math.min(st.box.w, st.box.h);
        crop = { x: st.box.x, y: st.box.y, size: side };
        setStatus('');
        buildEditor();
      }, function () { setStatus(t('logoUnreadable'), 'err'); });
    });

    function buildEditor() {
      var h = '';
      if (st.bg === 'removed') h += '<p class="logo-note">' + esc(t('logoBgRemoved')) + '</p>';
      else if (st.bg === 'kept') h += '<p class="logo-note">' + esc(t('logoBgKept')) + '</p>';
      if (st.wide) {
        h += '<p id="logo-wide-label">' + esc(t('logoWide')) + '</p>' +
          '<div class="row logo-modes" role="group" aria-labelledby="logo-wide-label">' +
          '<button type="button" class="button kraft" id="logo-mode-crop" aria-pressed="false">' + esc(t('logoWideCrop')) + '</button>' +
          '<button type="button" class="button kraft" id="logo-mode-monogram" aria-pressed="false">' + esc(t('logoWideMonogram')) + '</button></div>' +
          '<div id="logo-crop" class="logo-crop" hidden><p class="file-note" id="logo-crop-help">' + esc(t('logoCropHelp')) + '</p>' +
          '<div class="logo-crop-frame"><img id="logo-crop-img" alt="">' +
          '<div class="logo-crop-sel" id="logo-crop-sel" tabindex="0" role="group" aria-roledescription="' + esc(t('logoCropRole')) + '" aria-label="' + esc(t('logoCropAria')) + '" aria-describedby="logo-crop-help">' +
          '<span class="logo-crop-handle" id="logo-crop-handle" aria-hidden="true"></span></div></div></div>' +
          '<div id="logo-mono" class="logo-mono" hidden><label class="field" for="logo-initials"><span>' + esc(t('logoInitials')) + '</span>' +
          '<input id="logo-initials" maxlength="2" autocomplete="off" autocapitalize="characters" value="' + esc(initials) + '"></label></div>';
      }
      h += '<h3 class="logo-preview-title">' + esc(t('logoPreview')) + '</h3><div id="logo-preview"></div>' +
        '<p class="safe"><label class="logo-consent"><input type="checkbox" id="logo-consent2"> ' + esc(t('logoConsent')) + '</label></p>' +
        '<div class="row"><button type="button" class="button cta small" id="logo-use">' + esc(t('logoUse')) + '</button></div>';
      editor.innerHTML = h;
      editor.hidden = false;
      $('logo-use').addEventListener('click', submit);
      if (st.wide) {
        $('logo-crop-img').src = st.work.toDataURL('image/png');
        $('logo-mode-crop').addEventListener('click', function () { setMode('crop'); });
        $('logo-mode-monogram').addEventListener('click', function () { setMode('monogram'); });
        $('logo-initials').addEventListener('input', function () {
          var v = this.value.replace(/[^A-Za-z0-9À-ɏ]/g, '').slice(0, 2).toUpperCase();
          if (v !== this.value) this.value = v;
          initials = v || initialsFor(s.store);
          render();
        });
        wireCrop();
      }
      setMode(mode);
    }

    function setMode(m) {
      mode = m;
      if (st.wide) {
        $('logo-mode-crop').setAttribute('aria-pressed', String(m === 'crop'));
        $('logo-mode-monogram').setAttribute('aria-pressed', String(m === 'monogram'));
        $('logo-crop').hidden = m !== 'crop';
        $('logo-mono').hidden = m !== 'monogram';
        if (m === 'crop') placeSel();
      }
      render();
    }

    var frame = 0;
    function render() {
      if (frame) return;
      frame = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(function () {
        frame = 0;
        var c;
        if (mode === 'monogram') c = drawMonogram(initials, st.color);
        else if (mode === 'crop') c = placeInSafeBox(st.work, crop.x, crop.y, crop.size, crop.size);
        else c = placeInSafeBox(st.work, st.box.x, st.box.y, st.box.w, st.box.h);
        var png = encodePng(c);
        result = { png: png, source: mode === 'monogram' ? 'monogram' : mode === 'crop' ? 'crop' : 'upload' };
        var pv = $('logo-preview');
        if (!png) { pv.innerHTML = ''; setStatus(t('logoTooDetailed'), 'err'); return; }
        if (status.className.indexOf('err') >= 0 && status.textContent === t('logoTooDetailed')) setStatus('');
        pv.innerHTML = previewHtml(png.url, s.store);
      });
    }

    // Crop square: pointer drag to move, the corner handle to resize, and the
    // keyboard (arrows move, shift = bigger steps, + and - resize).
    function clampCrop() {
      var W = st.work.width, H = st.work.height;
      var min = Math.max(8, Math.round(Math.min(W, H) * 0.08));
      crop.size = Math.max(min, Math.min(crop.size, W, H));
      crop.x = Math.max(0, Math.min(crop.x, W - crop.size));
      crop.y = Math.max(0, Math.min(crop.y, H - crop.size));
    }
    function placeSel() {
      clampCrop();
      var W = st.work.width, H = st.work.height, sel = $('logo-crop-sel');
      sel.style.left = (crop.x / W * 100) + '%';
      sel.style.top = (crop.y / H * 100) + '%';
      sel.style.width = (crop.size / W * 100) + '%';
      sel.style.height = (crop.size / H * 100) + '%';
    }
    function wireCrop() {
      var sel = $('logo-crop-sel'), handle = $('logo-crop-handle'), img = $('logo-crop-img');
      var drag = null;
      function toWork(dx) { return dx * st.work.width / (img.clientWidth || st.work.width); }
      function start(ev, kind) {
        ev.preventDefault();
        ev.stopPropagation();
        drag = { kind: kind, x: ev.clientX, y: ev.clientY, crop: { x: crop.x, y: crop.y, size: crop.size } };
        if (sel.setPointerCapture && ev.pointerId !== undefined) { try { sel.setPointerCapture(ev.pointerId); } catch (e) {} }
        sel.focus({ preventScroll: true });
      }
      sel.addEventListener('pointerdown', function (ev) { start(ev, ev.target === handle ? 'size' : 'move'); });
      sel.addEventListener('pointermove', function (ev) {
        if (!drag) return;
        var dx = toWork(ev.clientX - drag.x), dy = toWork(ev.clientY - drag.y);
        if (drag.kind === 'move') { crop.x = drag.crop.x + dx; crop.y = drag.crop.y + dy; crop.size = drag.crop.size; }
        else { crop.x = drag.crop.x; crop.y = drag.crop.y; crop.size = drag.crop.size + Math.max(dx, dy); }
        placeSel(); render();
      });
      var stop = function () { drag = null; };
      sel.addEventListener('pointerup', stop);
      sel.addEventListener('pointercancel', stop);
      sel.addEventListener('keydown', function (ev) {
        var step = Math.max(1, Math.round(Math.max(st.work.width, st.work.height) * (ev.shiftKey ? 0.1 : 0.02)));
        var k = ev.key, grow = 0;
        if (k === 'ArrowLeft') crop.x -= step;
        else if (k === 'ArrowRight') crop.x += step;
        else if (k === 'ArrowUp') crop.y -= step;
        else if (k === 'ArrowDown') crop.y += step;
        else if (k === '+' || k === '=' || ev.code === 'Equal' || ev.code === 'NumpadAdd') grow = step;
        else if (k === '-' || k === '_' || ev.code === 'Minus' || ev.code === 'NumpadSubtract') grow = -step;
        else return;
        ev.preventDefault();
        if (grow) { crop.x -= grow / 2; crop.y -= grow / 2; crop.size += grow; }
        placeSel(); render();
      });
    }

    function submit() {
      if (busy) return;
      if (!result || !result.png) { setStatus(t('logoTooDetailed'), 'err'); return; }
      if (!$('logo-consent2').checked) { setStatus(t('reqConsent'), 'err'); $('logo-consent2').focus(); return; }
      busy = true;
      var btn = $('logo-use');
      btn.disabled = true;
      setStatus(t('logoSaving'));
      S.api('POST', '/store/' + ctx.token + '/logo', { png: result.png.b64, consent: true, source: result.source }).then(function (r) {
        busy = false;
        btn.disabled = false;
        var why = r.body && r.body.error;
        if (r.ok && r.body && r.body.ok) {
          if (ctx.onSaved) ctx.onSaved(r.body, { text: r.body.pending ? t('logoPending') : t('logoDone'), cls: 'ok' });
          return;
        }
        if (why === 'logo_flagged') setStatus(t('logoFlagged'), 'err');
        else if (why === 'store_closed') setStatus(t('logoClosed'), 'err');
        else if (why === 'logo_too_large') setStatus(t('logoTooDetailed'), 'err');
        else setStatus(t('logoFailed'), 'err');
      });
    }
  }

  window.PluedStoreLogo = {
    mount: mount,
    // Exposed for checks and the browser walk-through.
    knockout: knockout, contentBox: contentBox, isWide: isWide, initialsFor: initialsFor,
    contrast: contrast, readableOnCream: readableOnCream, dominantColor: dominantColor,
    placeInSafeBox: placeInSafeBox, drawMonogram: drawMonogram, encodePng: encodePng,
    SIDE: SIDE, SAFE: SAFE, MAX_PNG: MAX_PNG, CREAM: CREAM
  };
})();
