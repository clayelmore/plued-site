/* Site language: English at the root, Spanish twins under /es/ (W4, 2026-09-30).
   Loaded synchronously in <head> so a redirect happens before first paint.
   Plain ES5, no build step (the site's convention).

   1. The EN / ES pill in the header links to the twin page. A click
      remembers the choice (localStorage "plued_lang") and carries the query
      and hash across, so /store/s/#<token> stays on the same store.
   2. A remembered choice always wins: a page in the other language goes to
      its twin.
   3. First visit, nothing remembered: an English page goes to its Spanish
      twin when the browser's first English-or-Spanish language is Spanish.
      A Spanish page is never sent to English without a remembered choice
      (someone shared that link on purpose). The automatic choice is NOT
      stored; only the pill stores.
   Only on ARRIVAL: a click from one plued.app page to another never
   redirects (the visitor chose that link, e.g. the Spanish privacy page's
   "the English text governs" link). Never for crawlers or automation,
   never without a declared twin, and at most one automatic hop per few
   seconds, so a loop cannot happen. */
(function () {
  'use strict';
  var KEY = 'plued_lang';
  var HOP = 'plued_lang_hop';
  var html = document.documentElement;
  var current = (html.getAttribute('lang') || 'en').slice(0, 2) === 'es' ? 'es' : 'en';

  function read(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function write(store, key, value) { try { window[store].setItem(key, value); } catch (e) { /* private mode */ } }

  function twinPath() {
    var other = current === 'es' ? 'en' : 'es';
    var link = document.querySelector('link[rel="alternate"][hreflang="' + other + '"]');
    if (!link) return null;
    var href = link.getAttribute('href') || '';
    var m = /^https?:\/\/[^/]+(\/.*)$/.exec(href);
    var path = m ? m[1] : href;
    return path && path.charAt(0) === '/' && path !== location.pathname ? path : null;
  }

  function prefersSpanish() {
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      var primary = String(langs[i] || '').toLowerCase().split('-')[0];
      if (primary === 'es') return true;
      if (primary === 'en') return false;
    }
    return false;
  }

  function looksLikeBot() {
    if (navigator.webdriver) return true;
    return /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|whatsapp|telegram|discord|linkedin|slack|pinterest|vkshare|quora|google-inspectiontool|chrome-lighthouse|pingdom|uptime/i
      .test(navigator.userAgent || '');
  }

  function cameFromThisSite() {
    try { return !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { return false; }
  }

  // 1. Pill clicks: remember, and keep the query + hash.
  document.addEventListener('click', function (ev) {
    var el = ev.target;
    while (el && el.nodeType === 1 && !el.hasAttribute('data-lang-switch')) el = el.parentNode;
    if (!el || el.nodeType !== 1) return;
    var lang = el.getAttribute('data-lang-switch');
    if (lang !== 'en' && lang !== 'es') return;
    write('localStorage', KEY, lang);
    var base = (el.getAttribute('href') || '/').split(/[?#]/)[0];
    el.setAttribute('href', base + location.search + location.hash);
  }, true);

  // 2 + 3. Decide whether this page should be the other language.
  var stored = read('localStorage', KEY);
  var want = null;
  if (stored === 'en' || stored === 'es') want = stored;
  else if (current === 'en' && prefersSpanish()) want = 'es';
  if (!want || want === current || looksLikeBot() || cameFromThisSite()) return;
  var target = twinPath();
  if (!target) return;
  var last = Number(read('sessionStorage', HOP)) || 0;
  if (Date.now() - last < 4000) return; // a hop just happened: never bounce back
  write('sessionStorage', HOP, String(Date.now()));
  location.replace(target + location.search + location.hash);
})();
