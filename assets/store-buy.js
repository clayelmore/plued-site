/* The Store Plan buying page (/store/ and /es/store/), moved out of the
   page on 2026-09-30 so the English and Spanish pages share one script.
   Every sentence comes from PluedStore.t (store.js); the markup ids are the
   same on both pages. Plain ES5, like store.js. */
  (function () {
    'use strict';
    var S = window.PluedStore;
    var $ = function (id) { return document.getElementById(id); };
    var state = { tier: 50, config: null, clientSecret: null, checkout: null, token: null, upgradeFrom: null };
    var params = new URLSearchParams(location.search);

    // ---- Tiers -----------------------------------------------------------
    var tierButtons = document.querySelectorAll('#tiers .tier');
    function selectTier(tier) {
      state.tier = Number(tier);
      for (var i = 0; i < tierButtons.length; i++) {
        var b = tierButtons[i];
        b.setAttribute('aria-checked', Number(b.getAttribute('data-tier')) === state.tier ? 'true' : 'false');
      }
    }
    for (var i = 0; i < tierButtons.length; i++) {
      tierButtons[i].addEventListener('click', function () { selectTier(this.getAttribute('data-tier')); });
    }
    var upgrade = Number(params.get('upgrade'));
    if (S.TIERS[upgrade]) selectTier(upgrade);

    // Upgrade from the status page: the tier rides the query, the store's
    // token rides the fragment (never a query string), and both go in the
    // checkout body so the worker can close the old plan after minting.
    var frag = (location.hash || '').slice(1);
    if (S.TIERS[upgrade] && /^[A-Za-z0-9_-]{43}$/.test(frag)) {
      state.upgradeFrom = frag;
      S.api('GET', '/store/' + frag).then(function (r) {
        if (!r.ok || !r.body) return;
        $('store').value = r.body.store || '';
        var note = $('upgrade-note');
        note.textContent = S.t('upgradeNote', { store: r.body.store, seats: r.body.seats });
        note.hidden = false;
      });
    }

    // ---- Config (publishable key) ----------------------------------------
    function loadConfig() {
      return S.api('GET', '/store/config').then(function (r) {
        if (r.ok && r.body && r.body.publishable_key) { state.config = r.body; offerConfiguredTiers(r.body.tiers); return true; }
        return false;
      });
    }
    // Only offer a plan the worker can sell: a tier missing from the config
    // (its Stripe price is not set yet) hides its card instead of failing
    // at checkout. If the hidden card was chosen, fall back to the next one.
    function offerConfiguredTiers(tiers) {
      if (!tiers || !tiers.length) return;
      var sold = {};
      for (var i = 0; i < tiers.length; i++) sold[Number(tiers[i].tier)] = true;
      var fallback = null;
      for (var j = 0; j < tierButtons.length; j++) {
        var t = Number(tierButtons[j].getAttribute('data-tier'));
        tierButtons[j].hidden = !sold[t];
        if (sold[t] && (fallback === null || t === 50)) fallback = t;
      }
      if (!sold[state.tier] && fallback !== null) selectTier(fallback);
    }
    var configReady = loadConfig();

    // ---- Order form -------------------------------------------------------
    var form = $('order');
    var status = $('order-status');
    function setStatus(el, msg, cls) { el.textContent = msg || ''; el.className = 'form-status' + (cls ? ' ' + cls : ''); }
    function fieldError(input, errId, on) {
      input.setAttribute('aria-invalid', on ? 'true' : 'false');
      $(errId).classList.toggle('is-on', !!on);
    }
    function validStore() {
      var v = $('store').value.trim();
      var ok = v.length >= 2;
      fieldError($('store'), 'store-error', !ok);
      return ok ? v : null;
    }
    function validEmail(input, errId) {
      var v = input.value.trim().toLowerCase();
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      fieldError(input, errId, !ok);
      return ok ? v : null;
    }
    $('store').addEventListener('input', function () { if (this.getAttribute('aria-invalid') === 'true') validStore(); });
    $('email').addEventListener('input', function () { if (this.getAttribute('aria-invalid') === 'true') validEmail(this, 'email-error'); });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var store = validStore();
      var email = validEmail($('email'), 'email-error');
      if (!store) { $('store').focus(); return; }
      if (!email) { $('email').focus(); return; }
      var pay = $('pay');
      pay.disabled = true; pay.textContent = S.t('openingCheckout');
      setStatus(status, '');
      configReady.then(function (ok) {
        if (!ok) { fail(S.t('checkoutUnavailable')); return; }
        var body = { tier: state.tier, store: store, email: email };
        if (state.upgradeFrom) body.upgrade_from = state.upgradeFrom;
        return S.api('POST', '/store/checkout', body).then(function (r) {
          if (!r.ok || !r.body || !r.body.client_secret) {
            var why = r.body && r.body.error;
            if (why === 'bad_email') fail(S.t('badEmail'));
            else if (why === 'bad_store') fail(S.t('badStore'));
            else fail(S.t('checkoutUnavailable'));
            return;
          }
          state.clientSecret = r.body.client_secret;
          openCheckout(store, email);
        });
      });
      function fail(msg) {
        pay.disabled = false; pay.textContent = S.t('continueCheckout');
        setStatus(status, msg, 'err');
      }
    });

    // ---- Checkout panel ---------------------------------------------------
    function openCheckout(store, email) {
      $('sum-store').textContent = store;
      $('sum-tier').textContent = S.t('sumTier', { tier: state.tier });
      $('sum-price').textContent = S.t('perYear', { price: S.money(state.tier) });
      var renews = new Date(); renews.setFullYear(renews.getFullYear() + 1);
      $('sum-renews').textContent = S.fmtDate(renews.toISOString());
      $('buy').hidden = true;
      $('checkout-panel').hidden = false;
      window.scrollTo(0, 0);
      var loading = $('checkout-loading');
      try {
        var stripe = Stripe(state.config.publishable_key);
        var secret = state.clientSecret;
        stripe.initEmbeddedCheckout({ fetchClientSecret: function () { return Promise.resolve(secret); } })
          .then(function (checkout) {
            state.checkout = checkout;
            if (loading) loading.remove();
            checkout.mount('#checkout');
          }, function () { checkoutFailed(); });
      } catch (e) { checkoutFailed(); }
      function checkoutFailed() {
        loading.className = 'loading err';
        loading.textContent = S.t('checkoutFailed');
      }
    }
    $('checkout-back').addEventListener('click', function (ev) {
      ev.preventDefault();
      if (state.checkout) { try { state.checkout.destroy(); } catch (e) {} state.checkout = null; }
      $('checkout').innerHTML = '<p class="loading" id="checkout-loading">' + S.esc(S.t('openingCheckout')) + '</p>';
      $('checkout-panel').hidden = true;
      $('buy').hidden = false;
      var pay = $('pay'); pay.disabled = false; pay.textContent = S.t('continueCheckout');
      window.scrollTo(0, 0);
    });

    // ---- Return from Stripe: ?session_id= -> token -> Welcome -------------
    var sessionId = params.get('session_id');
    if (sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      $('buy').hidden = true;
      $('waiting').hidden = false;
      var tries = 0;
      (function poll() {
        S.api('GET', '/store/by-session/' + encodeURIComponent(sessionId)).then(function (r) {
          if (r.ok && r.body && r.body.token) { showWelcome(r.body.token); return; }
          tries += 1;
          // The new store's record can take up to about a minute to reach
          // every Cloudflare location (owner's live purchase, 2026-10-05), so
          // keep asking for about 3 minutes: every 2 s for 30 s, then every
          // 5 s, saying "almost done" after ~15 s so the page never looks stuck.
          if (tries === 8) $('waiting-text').textContent = S.t('waitingAlmost');
          if (tries < 45) { setTimeout(poll, tries < 15 ? 2000 : 5000); return; }
          $('waiting-text').textContent = S.t('waitingSlow');
        });
      })();
    }

    function showWelcome(token) {
      S.api('GET', '/store/' + token).then(function (r) {
        if (!r.ok || !r.body) {
          $('waiting-text').textContent = S.t('waitingNoStatus');
          return;
        }
        var s = r.body; s.token = token;
        state.token = token;
        $('waiting').hidden = true;
        $('w-store').textContent = s.store;
        var link = $('w-link'); link.href = S.statusUrl(token); link.textContent = S.statusUrl(token);
        var list = $('w-steps');
        S.renderNextSteps(list, s, {
          token: token,
          onSelfMark: function (key) {
            s.steps[key] = true;
            S.markStepDone(list, key);
            S.api('POST', '/store/' + token + '/step', { step: key, done: true });
          }
        });
        $('welcome').hidden = false;
        window.scrollTo(0, 0);
      });
    }

    // ---- Lead form ---------------------------------------------------------
    var lead = $('lead');
    $('lead-toggle').addEventListener('click', function (ev) {
      ev.preventDefault();
      lead.hidden = !lead.hidden;
      if (!lead.hidden) { lead.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('lead-chain').focus(); }
    });
    if (location.hash === '#lead') { lead.hidden = false; }
    lead.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var st = $('lead-status');
      var chain = $('lead-chain').value.trim();
      var contact = $('lead-contact').value.trim();
      var email = $('lead-email').value.trim().toLowerCase();
      var stores = Number($('lead-stores').value);
      if (chain.length < 2) { setStatus(st, S.t('leadChain'), 'err'); $('lead-chain').focus(); return; }
      if (!(stores >= 1)) { setStatus(st, S.t('leadStores'), 'err'); $('lead-stores').focus(); return; }
      if (contact.length < 2) { setStatus(st, S.t('leadName'), 'err'); $('lead-contact').focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus(st, S.t('leadEmail'), 'err'); $('lead-email').focus(); return; }
      var btn = $('lead-send'); btn.disabled = true;
      setStatus(st, S.t('sending'));
      S.api('POST', '/store/lead', { chain: chain, contact: contact, email: email, phone: $('lead-phone').value.trim(), stores: stores, note: $('lead-note').value.trim() })
        .then(function (r) {
          if (r.ok) {
            setStatus(st, S.t('leadSent', { email: email }), 'ok');
            btn.textContent = S.t('sent');
            return;
          }
          btn.disabled = false;
          if (r.body && r.body.error === 'text_flagged') setStatus(st, S.t('leadFlagged'), 'err');
          else setStatus(st, S.t('leadFailed'), 'err');
        });
    });

    // ---- Relink ------------------------------------------------------------
    var relink = $('relink');
    $('relink-toggle').addEventListener('click', function (ev) {
      ev.preventDefault();
      relink.hidden = !relink.hidden;
      if (!relink.hidden) $('relink-email').focus();
    });
    if (location.hash === '#relink') relink.hidden = false;
    S.wireRelink(relink);
  })();
