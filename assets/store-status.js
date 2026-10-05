/* The Store Plan status page (/store/s/ and /es/store/s/), moved out of
   the page on 2026-09-30 so the English and Spanish pages share one script.
   The token rides the fragment only. Every sentence comes from
   PluedStore.t (store.js). Plain ES5, like store.js. */
  (function () {
    'use strict';
    var S = window.PluedStore;
    var $ = function (id) { return document.getElementById(id); };
    var token = (location.hash || '').slice(1);
    var params = new URLSearchParams(location.search);
    var s = null; // status payload

    S.wireRelink($('relink-a'));
    S.wireRelink($('relink-b'));

    function setStatus(el, msg, cls) { el.textContent = msg || ''; el.className = 'form-status' + (cls ? ' ' + cls : ''); }
    function noToken(title, text) {
      $('loading').hidden = true;
      $('page').hidden = true;
      if (title) $('no-token-title').textContent = title;
      if (text) $('no-token-text').textContent = text;
      $('no-token').hidden = false;
    }

    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { noToken(); return; }

    function load() {
      return S.api('GET', '/store/' + token).then(function (r) {
        if (r.status === 404) { noToken(S.t('notOurs'), S.t('notOursText')); return null; }
        if (!r.ok || !r.body) { noToken(S.t('unreachable'), S.t('unreachableText')); return null; }
        s = r.body; s.token = token;
        render();
        return s;
      });
    }

    function render() {
      $('loading').hidden = true;
      $('no-token').hidden = true;
      $('page').hidden = false;
      document.title = S.t('pageTitle', { store: s.store });
      $('h-store').textContent = s.store;

      // Next steps
      var list = $('steps');
      S.renderNextSteps(list, s, {
        token: token, onStatusPage: true,
        onSelfMark: function (key) { s.steps[key] = true; S.markStepDone(list, key); S.api('POST', '/store/' + token + '/step', { step: key, done: true }); },
        onRequestLink: goToRequests
      });
      var done = S.allDone(s.steps);
      list.hidden = done;
      $('all-set').hidden = !done;

      // Seats
      var used = Number(s.used) || 0, seats = Number(s.seats) || 0, reserved = Number(s.reserved) || 0;
      var pct = seats ? Math.min(100, Math.round(used / seats * 100)) : 0;
      $('seats-used').textContent = used;
      $('seats-total').textContent = seats;
      $('seats-plan').textContent = S.t('seatsPlan', { seats: seats });
      $('seats-reserved').textContent = reserved ? S.t('seatsJoining', { count: reserved }) : '';
      var bar = $('seats-bar');
      bar.querySelector('span').style.width = pct + '%';
      bar.classList.toggle('is-high', pct >= 80);
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', S.t('seatsAria', { used: used, seats: seats }));
      var next = S.nextTier(s.tier);
      var add = $('add-seats');
      if (pct >= 80 && next && !s.closed_at) {
        add.textContent = S.t('addSeats', { next: next });
        add.href = S.PREFIX + '/store/?upgrade=' + next + '#' + token;
        add.hidden = false;
      } else { add.hidden = true; }

      // Your store code
      $('word').textContent = s.word;
      $('note').textContent = S.breakroomNote(s.word);
      S.attachPoster($('poster'), s.store, s.word);

      // Your pack
      var builder = 'https://plued.app/pack/?store=' + encodeURIComponent(s.store) + '&store_token=' + encodeURIComponent(token);
      if (s.pack_id) {
        $('pack-none').hidden = true; $('pack-some').hidden = false;
        $('pack-name').textContent = s.store;
        $('pack-codes').textContent = '...';
        $('pack-updated').textContent = '...';
        $('pack-open').href = 'https://plued.app/pack/?open=' + encodeURIComponent(s.pack_id) + '&store_token=' + encodeURIComponent(token);
        S.api('GET', '/packs/' + encodeURIComponent(s.pack_id) + '/meta').then(function (r) {
          if (!r.ok || !r.body) { $('pack-codes').textContent = S.t('packPublished'); $('pack-updated').textContent = ''; return; }
          $('pack-codes').textContent = S.t(r.body.codes_count === 1 ? 'codeOne' : 'codeMany', { count: r.body.codes_count || 0 });
          $('pack-updated').textContent = r.body.received_at ? S.fmtDate(new Date(r.body.received_at).toISOString()) : '';
        });
      } else {
        $('pack-none').hidden = false; $('pack-some').hidden = true;
        $('pack-build').href = builder;
      }
      renderRequests();

      // Plan
      $('plan-tier').textContent = S.t('planTier', { seats: s.seats, price: S.money(s.tier) });
      $('plan-start').textContent = S.fmtDate(s.plan_start);
      $('plan-end').textContent = S.fmtDate(s.plan_end);
      $('plan-end-label').textContent = s.closed_at ? S.t('ranTo') : S.t('renews');
      var apple = { created: '', skipped: '', pending: S.t('applePending'), inactive: S.t('appleInactive') };
      (function (t) { $('plan-apple').textContent = t; $('plan-apple').hidden = !t; $('plan-apple-label').hidden = !t; })(apple[s.apple] || '');
      var closed = $('closed');
      if (s.closed_at) {
        closed.textContent = S.t('closedSince', { date: S.fmtDate(s.closed_at) });
        closed.hidden = false;
      } else { closed.hidden = true; }
      $('portal').hidden = !s.stripe_portal;
      renderRefund();

      // Deep entry from Welcome: ?to=requests&type=logo#<token>
      if (params.get('to') === 'requests') {
        var t = params.get('type');
        goToRequests(['spreadsheet', 'logo', 'graphic', 'other'].indexOf(t) >= 0 ? t : null);
      }
    }

    function goToRequests(type) {
      if (type) { $('req-type').value = type; typeChanged(); }
      $('requests').scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () { $('req-text').focus(); }, 400);
    }

    function renderRequests() {
      var ul = $('request-list');
      ul.innerHTML = '';
      var labels = { spreadsheet: S.t('reqSpreadsheet'), logo: S.t('reqLogo'), graphic: S.t('reqGraphic'), other: S.t('reqOther'), refund: S.t('reqRefund') };
      var states = { open: S.t('stateOpen'), in_progress: S.t('stateInProgress'), done: S.t('stateDone') };
      var reqs = (s.requests || []).slice().sort(function (a, b) { return String(b.created).localeCompare(String(a.created)); });
      for (var i = 0; i < reqs.length; i++) {
        var r = reqs[i];
        var li = document.createElement('li');
        li.className = 'request-item';
        li.innerHTML = '<div><span class="type">' + S.esc(labels[r.type] || r.type) + '</span>' +
          (r.has_file ? ' <span class="muted">' + S.esc(S.t('fileAttached')) + '</span>' : '') +
          '<div class="text">' + S.esc(r.text || '') + '</div>' +
          '<div class="muted" style="font-size:.82rem">' + S.esc(S.fmtDate(r.created)) + '</div></div>' +
          '<span class="chip ' + S.esc(r.state) + '">' + S.esc(states[r.state] || r.state) + '</span>';
        ul.appendChild(li);
      }
    }

    // ---- Word block buttons ------------------------------------------------
    var wordStatus = $('word-status');
    var markWord = function () {
      if (s.steps.word) return;
      s.steps.word = true; S.markStepDone($('steps'), 'word');
      S.api('POST', '/store/' + token + '/step', { step: 'word', done: true });
    };
    $('copy-word').onclick = function () { var b = this; S.copyText(s.word, function (ok) { S.flash(b, ok ? S.t('copied') : S.t('selectCopy')); if (ok) markWord(); }); };
    $('copy-note').onclick = function () { var b = this; S.copyText(S.breakroomNote(s.word), function (ok) { S.flash(b, ok ? S.t('copied') : S.t('selectCopy')); if (ok) markWord(); }); };
    $('poster').addEventListener('click', markWord);
    $('resend').onclick = function () {
      var b = this; b.disabled = true;
      setStatus(wordStatus, S.t('sending'));
      S.api('POST', '/store/' + token + '/resend', {}).then(function (r) {
        b.disabled = false;
        if (r.ok) setStatus(wordStatus, S.t('resendSent'), 'ok');
        else setStatus(wordStatus, S.t('tryAgainLater'), 'err');
      });
    };
    $('show-steps').onclick = function () { $('steps').hidden = false; $('all-set').hidden = true; };

    // ---- Requests form -------------------------------------------------------
    var ACCEPT = {
      spreadsheet: { mimes: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], ext: /\.(csv|xlsx)$/i, accept: '.csv,.xlsx', note: S.t('noteSpreadsheet'), only: S.t('onlySpreadsheet') },
      logo: { mimes: ['image/png', 'image/jpeg', 'image/svg+xml'], ext: /\.(png|jpe?g|svg)$/i, accept: '.png,.jpg,.jpeg,.svg', note: S.t('noteLogo'), only: S.t('onlyLogo') },
      graphic: { mimes: ['image/png', 'image/jpeg'], ext: /\.(png|jpe?g)$/i, accept: '.png,.jpg,.jpeg', note: S.t('noteGraphic'), only: S.t('onlyGraphic') },
      other: { mimes: ['image/png', 'image/jpeg', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], ext: /\.(png|jpe?g|csv|xlsx)$/i, accept: '.png,.jpg,.jpeg,.csv,.xlsx', note: S.t('noteOther'), only: S.t('onlyOther') }
    };
    var MAX = 2 * 1024 * 1024;
    function typeChanged() {
      var t = $('req-type').value;
      $('req-file').setAttribute('accept', ACCEPT[t].accept);
      $('file-note').textContent = ACCEPT[t].note;
      $('logo-consent-wrap').hidden = t !== 'logo';
    }
    $('req-type').addEventListener('change', typeChanged);
    typeChanged();

    function mimeFor(file, type) {
      var name = file.name || '';
      if (/\.csv$/i.test(name)) return 'text/csv';
      if (/\.xlsx$/i.test(name)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (/\.png$/i.test(name)) return 'image/png';
      if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
      if (/\.svg$/i.test(name)) return 'image/svg+xml';
      return ACCEPT[type].mimes.indexOf(file.type) >= 0 ? file.type : '';
    }

    $('request-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var st = $('req-status');
      var type = $('req-type').value;
      var text = $('req-text').value.trim();
      var fileInput = $('req-file');
      var file = fileInput.files && fileInput.files[0];
      if (!text && !file) { setStatus(st, S.t('reqEmpty'), 'err'); $('req-text').focus(); return; }
      if (type === 'logo' && file && !$('logo-consent').checked) { setStatus(st, S.t('reqConsent'), 'err'); $('logo-consent').focus(); return; }
      if (file) {
        if (file.size > MAX) { setStatus(st, S.t('reqTooBig', { mb: (file.size / 1024 / 1024).toFixed(1) }), 'err'); return; }
        var mime = mimeFor(file, type);
        if (!mime || ACCEPT[type].mimes.indexOf(mime) < 0 || !ACCEPT[type].ext.test(file.name || '')) { setStatus(st, ACCEPT[type].only, 'err'); return; }
      }
      var btn = $('req-send'); btn.disabled = true;
      setStatus(st, file ? S.t('uploading') : S.t('sending'));
      var body = { type: type, text: text };
      var send = function () {
        S.api('POST', '/store/' + token + '/request', body).then(function (r) {
          btn.disabled = false;
          if (r.status === 201) {
            setStatus(st, S.t('reqSent'), 'ok');
            $('req-text').value = ''; fileInput.value = ''; $('logo-consent').checked = false;
            load();
            return;
          }
          var why = r.body && r.body.error;
          if (why === 'text_flagged') setStatus(st, S.t('reqFlagged'), 'err');
          else if (why === 'file_too_large') setStatus(st, S.t('reqOver'), 'err');
          else if (why === 'bad_file' || why === 'bad_file_type') setStatus(st, S.t('reqBadType'), 'err');
          else setStatus(st, S.t('tryAgainLater'), 'err');
        });
      };
      if (!file) { send(); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var b64 = String(reader.result).split(',')[1] || '';
        body.file = { name: file.name, mime: mime, b64: b64 };
        send();
      };
      reader.onerror = function () { btn.disabled = false; setStatus(st, S.t('reqUnreadable'), 'err'); };
      reader.readAsDataURL(file);
    });

    // ---- Changed your mind? (money-back rule, 2026-10-05) -----------------
    // Lives in the Plan card under Manage billing. Built here, not in the
    // HTML, so the English and Spanish pages share it. The worker computes
    // every number; the button only asks (refunds are made by hand in
    // Stripe, and the refund closes the store code).
    function refundBox() {
      var box = $('refund');
      if (box) return box;
      box = document.createElement('div');
      box.className = 'refund-box';
      box.id = 'refund';
      box.hidden = true;
      var anchor = $('plan-status');
      anchor.parentNode.insertBefore(box, anchor.nextSibling);
      return box;
    }

    function renderRefund(message) {
      var box = refundBox();
      var rf = s.refund;
      if (!rf || s.closed_at) { box.hidden = true; box.innerHTML = ''; return; }
      var html = '<h3 id="refund-heading">' + S.esc(S.t('refundHeading')) + '</h3>';
      if (rf.request) {
        html += '<p class="refund-done" role="status">' + S.esc(s.email
          ? S.t('refundRequested', { date: S.fmtDate(rf.request.created), email: s.email })
          : S.t('refundRequestedNoEmail', { date: S.fmtDate(rf.request.created) })) + '</p>';
      } else if (rf.within_window && rf.suggested_usd === 0) {
        // The phones already unlocked cover the price: the rule gives $0.00,
        // so there is nothing to ask for (owner, 2026-10-05).
        html += '<p>' + S.esc(S.t(s.stripe_portal ? 'refundUsed' : 'refundUsedNoBilling')) + '</p>';
      } else if (rf.within_window) {
        var n = Number(rf.phones) || 0;
        var phones = n === 0 ? S.t('refundPhonesNone') : n === 1 ? S.t('refundPhonesOne') : S.t('refundPhonesMany', { count: n });
        html += '<p>' + S.esc(S.t('refundBought', { date: S.fmtDate(rf.purchased) })) + ' ' + S.esc(phones) + ' ' +
          S.esc(S.t('refundRule', { amount: S.usd(rf.suggested_usd) })) + '</p>' +
          '<div class="row"><button type="button" class="button kraft" id="refund-request">' + S.esc(S.t('refundButton')) + '</button></div>' +
          '<p class="refund-closes">' + S.esc(S.t('refundCloses', { date: S.fmtDate(rf.window_end) })) + '</p>' +
          '<p class="form-status" id="refund-status" aria-live="polite"></p>';
      } else {
        html += '<p>' + S.esc(S.t(s.stripe_portal ? 'refundEnded' : 'refundEndedNoBilling', { date: S.fmtDate(rf.window_end) })) + '</p>';
      }
      box.innerHTML = html;
      box.setAttribute('aria-labelledby', 'refund-heading');
      box.hidden = false;
      var btn = $('refund-request');
      if (btn) btn.onclick = requestRefund;
      if (message) setStatus($('refund-status'), message, 'err');
    }

    function requestRefund() {
      var btn = this;
      if (!window.confirm(S.t('refundConfirm', { amount: S.usd(s.refund.suggested_usd) }))) return;
      btn.disabled = true;
      setStatus($('refund-status'), S.t('sending'));
      S.api('POST', '/store/' + token + '/request', { type: 'refund' }).then(function (r) {
        var why = r.body && r.body.error;
        if ((r.status === 201 || why === 'refund_already_requested') && r.body && r.body.request) {
          s.refund.request = r.body.request;
          renderRefund();
          load(); // the request list and every number, fresh from the worker
          return;
        }
        if (why === 'refund_window_closed' || why === 'store_closed' || why === 'refund_rule_zero') { load(); return; }
        btn.disabled = false;
        setStatus($('refund-status'), S.t('tryAgainLater'), 'err');
      });
    }

    // ---- Billing portal ---------------------------------------------------
    $('portal').onclick = function () {
      var b = this; b.disabled = true;
      setStatus($('plan-status'), S.t('openingStripe'));
      S.api('POST', '/store/' + token + '/portal', {}).then(function (r) {
        b.disabled = false;
        if (r.ok && r.body && r.body.url) { setStatus($('plan-status'), ''); location.href = r.body.url; return; }
        setStatus($('plan-status'), S.t('billingUnavailable'), 'err');
      });
    };

    load();
  })();
