/* Shared helpers for the Store Plan pages (/store/ and /store/s/).
   Plain ES5 on purpose (the admin page's convention): no build step, and
   it runs on whatever browser a store manager has. Exposes window.PluedStore.
   Depends on /assets/qr.js (qrcode-generator, MIT) for the poster. */
(function () {
  'use strict';

  var API = '/api';
  var GET_URL = 'https://plued.app/get';
  var TIERS = { 25: 149, 50: 249, 100: 399 }; // Yearly prices as set in Stripe (owner, 2026-09-02); Stripe holds the truth.
  var TIER_ORDER = [25, 50, 100];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(tier) {
    var n = TIERS[tier];
    return n ? '$' + n : '';
  }

  function nextTier(tier) {
    var i = TIER_ORDER.indexOf(Number(tier));
    return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    // UTC on purpose: Stripe period timestamps are midnight UTC, and a local
    // render in the Americas would show the day before.
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function statusUrl(token) { return 'https://plued.app/store/s/#' + token; }
  function codeUrl(word) { return GET_URL + '/?code=' + encodeURIComponent(word); }

  /* The three-line break-room note. Same wording as the welcome email. */
  function breakroomNote(word) {
    return 'PLUed is free for our store.\n' +
      'Install PLUed from plued.app/get, tap "Did your store give you a code?"\n' +
      'and enter ' + word + '.';
  }

  /* The forward-to-cashiers text: note plus the download link. */
  function inviteText(word) {
    return breakroomNote(word) + '\n\nGet the app: ' + GET_URL;
  }

  function copyText(text, onDone) {
    var done = function (ok) { if (onDone) onDone(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
  }

  /* Poster: 1200x1600 PNG. Cream ground, the store code, a QR that opens
     plued.app/get with the store code prefilled, the three-line note. */
  function drawPoster(store, word) {
    var W = 1200, H = 1600;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#faf6ee'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e5d9c3'; g.lineWidth = 6;
    g.strokeRect(40, 40, W - 80, H - 80);
    g.fillStyle = '#1e3b2f';
    g.textAlign = 'center';
    g.font = '700 44px Fraunces, Georgia, serif';
    g.fillText('PLUed', W / 2, 150);
    g.font = '400 30px "Albert Sans", Arial, sans-serif';
    g.fillStyle = '#5c6b60';
    fitText(g, store, W / 2, 210, W - 200, '700 46px Fraunces, Georgia, serif', '#1e3b2f');
    g.fillStyle = '#5c6b60';
    g.font = '400 30px "Albert Sans", Arial, sans-serif';
    g.fillText('PLUed is free for our store. Your store code:', W / 2, 300);
    fitText(g, word, W / 2, 420, W - 160, '700 120px Fraunces, Georgia, serif', '#1e3b2f', 0.06);
    // QR
    var size = 560, x = (W - size) / 2, y = 500;
    try {
      var qr = window.qrcode(0, 'M');
      qr.addData(codeUrl(word));
      qr.make();
      var n = qr.getModuleCount();
      var cell = Math.floor(size / n);
      var off = Math.floor((size - cell * n) / 2);
      g.fillStyle = '#ffffff'; g.fillRect(x - 24, y - 24, size + 48, size + 48);
      g.fillStyle = '#1e3b2f';
      for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) {
        if (qr.isDark(r, col)) g.fillRect(x + off + col * cell, y + off + r * cell, cell, cell);
      }
    } catch (e) {
      g.fillStyle = '#5c6b60'; g.font = '400 28px "Albert Sans", Arial, sans-serif';
      g.fillText('plued.app/get', W / 2, y + size / 2);
    }
    g.fillStyle = '#1e3b2f';
    g.font = '400 34px "Albert Sans", Arial, sans-serif';
    var lines = ['1. Scan the code, or install PLUed from plued.app/get.',
      '2. Tap "Did your store give you a code?"',
      '3. Enter ' + word + '.'];
    var ly = 1160;
    for (var i = 0; i < lines.length; i++) { g.fillText(lines[i], W / 2, ly); ly += 56; }
    g.fillStyle = '#5c6b60';
    g.font = '400 26px "Albert Sans", Arial, sans-serif';
    g.fillText('Every phone you unlock stays unlocked. Questions: support@plued.app', W / 2, H - 110);
    return c;
  }

  function fitText(g, text, x, y, maxW, font, color, spacing) {
    g.font = font; g.fillStyle = color;
    var t = String(text || '');
    var m = /(\d+)px/.exec(font);
    var px = m ? Number(m[1]) : 40;
    while (px > 24 && measure(g, t, spacing) > maxW) {
      px -= 4; g.font = font.replace(/\d+px/, px + 'px');
    }
    if (spacing) {
      // Manual letter spacing (canvas letterSpacing is not everywhere yet).
      var total = measure(g, t, spacing), cx = x - total / 2;
      g.textAlign = 'left';
      for (var i = 0; i < t.length; i++) {
        g.fillText(t[i], cx, y);
        cx += g.measureText(t[i]).width + px * spacing;
      }
      g.textAlign = 'center';
    } else {
      g.fillText(t, x, y);
    }
  }

  function measure(g, t, spacing) {
    if (!spacing) return g.measureText(t).width;
    var w = 0, m = /(\d+)px/.exec(g.font), px = m ? Number(m[1]) : 40;
    for (var i = 0; i < t.length; i++) w += g.measureText(t[i]).width + (i < t.length - 1 ? px * spacing : 0);
    return w;
  }

  /* Wires a "Print the poster" anchor to a PNG of the poster. Returns the
     data URL so the caller can also open it. */
  function attachPoster(anchor, store, word) {
    var url;
    try { url = drawPoster(store, word).toDataURL('image/png'); } catch (e) { url = null; }
    if (!url) { anchor.hidden = true; return null; }
    anchor.href = url;
    anchor.download = 'plued-' + String(word).toLowerCase() + '-poster.png';
    return url;
  }

  /* The four Next steps. `s` is the status payload; `opts` carries the
     callbacks and ids the page supplies. Renders into `list` (an <ol>). */
  function renderNextSteps(list, s, opts) {
    opts = opts || {};
    var steps = s.steps || {};
    var token = s.token || opts.token || '';
    var builderUrl = 'https://plued.app/pack/?store=' + encodeURIComponent(s.store || '') + '&store_token=' + encodeURIComponent(token);
    var reqUrl = function (type) { return '/store/s/?to=requests&type=' + type + '#' + token; };
    var onStatus = !!opts.onStatusPage;
    var html = '';
    html += step('word', 'Share your store code',
      '<p>Cashiers install PLUed, tap "Did your store give you a code?", and type this store code. Nothing else to set up.</p>' +
      '<p class="word" id="ns-word">' + esc(s.word) + '</p>' +
      '<div class="row"><button type="button" class="button kraft" id="ns-copy-word">Copy the store code</button>' +
      '<a class="button kraft" id="ns-poster" href="#">Print the poster</a>' +
      '<button type="button" class="button kraft" id="ns-copy-note">Copy the break-room note</button></div>' +
      '<pre class="breakroom" id="ns-note">' + esc(breakroomNote(s.word)) + '</pre>');
    html += step('pack', 'Build your pack',
      '<p>Your store\'s own codes, in every cashier\'s app. Open the Pack Builder with your store name filled in, or send us your spreadsheet and we build it for you.</p>' +
      '<div class="row"><a class="button" href="' + esc(builderUrl) + '">Open the Pack Builder</a>' +
      '<a class="button kraft" href="' + esc(onStatus ? '#requests' : reqUrl('spreadsheet')) + '" data-request="spreadsheet">Send us your spreadsheet</a></div>');
    html += step('logo', 'Add your logo',
      '<p>Upload a PNG, JPG, or SVG. We prepare the 512 px graphic and put it on your store\'s tile in every cashier\'s app.</p>' +
      '<div class="row"><a class="button kraft" href="' + esc(onStatus ? '#requests' : reqUrl('logo')) + '" data-request="logo">Upload your logo</a></div>');
    html += step('invite', 'Invite your cashiers',
      '<p>Forward the welcome email, post the break-room note, or copy the text below. This step checks itself off when the first cashier uses a seat.</p>' +
      '<div class="row"><button type="button" class="button kraft" id="ns-copy-invite">Copy the invite text</button>' +
      '<a class="button kraft" href="' + GET_URL + '/">Open plued.app/get</a></div>');
    list.innerHTML = html;

    function step(key, title, body) {
      var done = !!steps[key];
      return '<li class="next-step' + (done ? ' is-done' : '') + '" data-step="' + key + '">' +
        '<div><span class="state">' + (done ? 'Done' : 'To do') + '</span><h3>' + title + '</h3>' + body + '</div></li>';
    }

    var posterA = list.querySelector('#ns-poster');
    attachPoster(posterA, s.store, s.word);
    var markWord = function () { if (opts.onSelfMark && !steps.word) opts.onSelfMark('word'); };
    posterA.addEventListener('click', markWord);
    list.querySelector('#ns-copy-word').onclick = function () {
      var b = this;
      copyText(s.word, function (ok) { flash(b, ok ? 'Copied' : 'Select and copy it'); if (ok) markWord(); });
    };
    list.querySelector('#ns-copy-note').onclick = function () {
      var b = this;
      copyText(breakroomNote(s.word), function (ok) { flash(b, ok ? 'Copied' : 'Select and copy it'); if (ok) markWord(); });
    };
    list.querySelector('#ns-copy-invite').onclick = function () {
      var b = this;
      copyText(inviteText(s.word), function (ok) { flash(b, ok ? 'Copied' : 'Select and copy it'); });
    };
    if (opts.onRequestLink) {
      var links = list.querySelectorAll('[data-request]');
      for (var i = 0; i < links.length; i++) {
        (function (a) {
          a.addEventListener('click', function (ev) { ev.preventDefault(); opts.onRequestLink(a.getAttribute('data-request')); });
        })(links[i]);
      }
    }
  }

  function markStepDone(list, key) {
    var li = list.querySelector('[data-step="' + key + '"]');
    if (!li) return;
    li.classList.add('is-done');
    var st = li.querySelector('.state');
    if (st) st.textContent = 'Done';
  }

  function allDone(steps) {
    return !!(steps && steps.word && steps.pack && steps.logo && steps.invite);
  }

  function flash(button, text) {
    var old = button.getAttribute('data-label') || button.textContent;
    button.setAttribute('data-label', old);
    button.textContent = text;
    setTimeout(function () { button.textContent = old; }, 1600);
  }

  /* API helpers. Every failure resolves to {ok:false, status, body} so
     pages can write a plain sentence instead of throwing. */
  function api(method, path, body) {
    var init = { method: method, headers: {} };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(API + path, init).then(function (res) {
      return res.text().then(function (t) {
        var parsed = null;
        try { parsed = t ? JSON.parse(t) : null; } catch (e) { parsed = null; }
        return { ok: res.ok, status: res.status, body: parsed };
      });
    }, function () { return { ok: false, status: 0, body: null }; });
  }

  /* "Lost your link?" box: one input, one button, one honest sentence. */
  function wireRelink(box) {
    var input = box.querySelector('input');
    var button = box.querySelector('button');
    var out = box.querySelector('.form-status');
    button.onclick = function () {
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        out.className = 'form-status err'; out.textContent = 'Enter the email you bought with.';
        input.focus(); return;
      }
      button.disabled = true;
      out.className = 'form-status'; out.textContent = 'Sending...';
      api('POST', '/store/relink', { email: email }).then(function (r) {
        button.disabled = false;
        if (r.status === 0) { out.className = 'form-status err'; out.textContent = 'Could not reach PLUed. Try again in a moment.'; return; }
        out.className = 'form-status ok';
        out.textContent = 'If that email bought a Store Plan, the link is on its way. Check spam too.';
      });
    };
  }

  window.PluedStore = {
    API: API, TIERS: TIERS, TIER_ORDER: TIER_ORDER, GET_URL: GET_URL,
    esc: esc, money: money, nextTier: nextTier, fmtDate: fmtDate,
    statusUrl: statusUrl, codeUrl: codeUrl, breakroomNote: breakroomNote, inviteText: inviteText,
    copyText: copyText, drawPoster: drawPoster, attachPoster: attachPoster,
    renderNextSteps: renderNextSteps, markStepDone: markStepDone, allDone: allDone, flash: flash,
    api: api, wireRelink: wireRelink,
  };
})();
