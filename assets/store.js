/* Shared helpers for the Store Plan pages (/store/ and /store/s/).
   Plain ES5 on purpose (the admin page's convention): no build step, and
   it runs on whatever browser a store manager has. Exposes window.PluedStore.
   Depends on /assets/qr.js (qrcode-generator, MIT) for the poster. */
(function () {
  'use strict';

  var API = '/api';
  var GET_URL = 'https://plued.app/get';

  /* Page language (W4, 2026-09-30): the English pages live at /store/ and
     /store/s/, the Spanish twins at /es/store/ and /es/store/s/. Both load
     this file; <html lang> picks the strings. Every sentence a buyer or a
     store manager reads on either page comes from STRINGS, so the two
     languages cannot drift apart in logic. Prices, the store code, Stripe
     and support@plued.app never change with the language. */
  var LANG = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2) === 'es' ? 'es' : 'en';
  var PREFIX = LANG === 'es' ? '/es' : '';
  var STRINGS = {
    en: {
      done: 'Done', toDo: 'To do', copied: 'Copied', selectCopy: 'Select and copy it',
      noteLine1: 'PLUed is free for our store.',
      noteLine2: 'Install PLUed from plued.app/get, tap "Did your store give you a code?"',
      noteLine3: 'and enter {word}.',
      getTheApp: 'Get the app: ',
      posterIntro: 'PLUed is free for our store. Your store code:',
      posterStep1: '1. Scan the code, or install PLUed from plued.app/get.',
      posterStep2: '2. Tap "Did your store give you a code?"',
      posterStep3: '3. Enter {word}.',
      posterFoot: 'Every phone you unlock stays unlocked. Questions: support@plued.app',
      stepWordTitle: 'Share your store code',
      stepWordBody: 'Cashiers install PLUed, tap "Did your store give you a code?", and type this store code. Nothing else to set up.',
      copyWord: 'Copy the store code', printPoster: 'Print the poster', copyNote: 'Copy the break-room note',
      stepPackTitle: 'Build your pack',
      stepPackBody: 'Your store\'s own codes, in every cashier\'s app. Open the Pack Builder with your store name filled in, or send us your spreadsheet and we build it for you.',
      openBuilder: 'Open the Pack Builder', sendSpreadsheet: 'Send us your spreadsheet',
      stepLogoTitle: 'Add your logo',
      stepLogoBody: 'Upload a PNG, JPG, or SVG. We prepare the 512 px graphic and put it on your store\'s tile in every cashier\'s app.',
      uploadLogo: 'Upload your logo',
      stepInviteTitle: 'Invite your cashiers',
      stepInviteBody: 'Forward the welcome email, post the break-room note, or copy the text below. This step checks itself off when the first cashier uses a seat.',
      copyInvite: 'Copy the invite text', openGet: 'Open plued.app/get',
      relinkBadEmail: 'Enter the email you bought with.', sending: 'Sending...',
      relinkOffline: 'Could not reach PLUed. Try again in a moment.',
      relinkSent: 'If that email bought a Store Plan, the link is on its way. Check spam too.',
      // Buying page (/store/)
      upgradeNote: 'Adding seats for {store}: your current {seats}-seat plan closes when the new one starts. Phones already unlocked stay unlocked and do not count against the new seats.',
      openingCheckout: 'Opening secure checkout...', continueCheckout: 'Continue to secure checkout',
      checkoutUnavailable: 'Checkout is not available right now. Nothing was charged. Try again in a minute, or email support@plued.app.',
      badEmail: 'That email address did not go through. Check it and try again.',
      badStore: 'Enter your store\'s name.',
      sumTier: 'Store Plan, up to {tier} seats', perYear: '{price} per year',
      checkoutFailed: 'Secure checkout could not open. Nothing was charged. Go back and try again, or email support@plued.app.',
      waitingSlow: 'Your payment went through and your store is being set up. Your store code and your store page link are in your email within a few minutes. If they are not there by then, write support@plued.app and we sort it out.',
      waitingNoStatus: 'Your store is set up. Open the link in your welcome email to see your store code and next steps, or use "send my link again" below.',
      leadChain: 'Enter your chain or company name.', leadStores: 'How many stores?', leadName: 'Enter your name.',
      leadEmail: 'Enter a working email address.',
      leadSent: 'Sent. We reply to {email}, usually the same business day.', sent: 'Sent',
      leadFlagged: 'That note could not be sent. Please reword it, or email support@plued.app directly.',
      leadFailed: 'Could not send right now. Email support@plued.app and we take it from there.',
      // Status page (/store/s/)
      notOurs: 'That link is not one of ours.', notOursText: 'Open the link from your welcome email, or ask for it again below.',
      unreachable: 'Could not reach PLUed.', unreachableText: 'Check your connection and reload this page.',
      pageTitle: '{store} on PLUed',
      seatsPlan: 'up to {seats} this plan year', seatsJoining: '({count} joining now)',
      seatsAria: '{used} of {seats} seats used', addSeats: 'Add seats: move up to {next} seats →',
      packPublished: 'published', codeOne: '{count} code', codeMany: '{count} codes',
      planTier: 'Up to {seats} seats, {price} per year', ranTo: 'Ran to', renews: 'Renews',
      applePending: 'Still being set up on our side; your cashiers can start now.', appleInactive: 'Closed to new cashiers.',
      closedSince: 'Closed to new cashiers since {date}. Phones already unlocked keep their unlock. Renew from Manage billing to reopen the store code.',
      reqSpreadsheet: 'Spreadsheet', reqLogo: 'Logo', reqGraphic: 'Graphic', reqOther: 'Other',
      stateOpen: 'Open', stateInProgress: 'In progress', stateDone: 'Done', fileAttached: '(file attached)',
      resendSent: 'Sent. The welcome email is on its way to the address you bought with.',
      tryAgainLater: 'Could not send right now. Try again in a minute, or email support@plued.app.',
      noteSpreadsheet: 'CSV or XLSX, up to 2 MB.', noteLogo: 'PNG, JPG, or SVG, up to 2 MB. Square or wide works best.',
      noteGraphic: 'A photo of the item helps. PNG or JPG, up to 2 MB.', noteOther: 'PNG, JPG, CSV, or XLSX, up to 2 MB.',
      onlySpreadsheet: 'CSV or XLSX only for this request.', onlyLogo: 'PNG, JPG, or SVG only for this request.',
      onlyGraphic: 'A photo of the item helps. PNG or JPG only for this request.', onlyOther: 'PNG, JPG, CSV, or XLSX only for this request.',
      reqEmpty: 'Add a few store codes or attach a file.', reqConsent: 'Please confirm your store may use this mark.',
      reqTooBig: 'That file is {mb} MB. Files up to 2 MB, please. A smaller export or a PNG under 2 MB works.',
      uploading: 'Uploading...', reqSent: 'Sent. We reply by email; the request shows here until it is done.',
      reqFlagged: 'That text could not be sent. Please reword it, or email support@plued.app.',
      reqOver: 'That file is over 2 MB.', reqBadType: 'That file type is not accepted for this request.',
      reqUnreadable: 'Could not read that file.',
      openingStripe: 'Opening Stripe...', billingUnavailable: 'Billing is not available right now. Email support@plued.app and we handle it.'
    },
    es: {
      done: 'Listo', toDo: 'Pendiente', copied: 'Copiado', selectCopy: 'Selecciónalo y cópialo',
      noteLine1: 'PLUed es gratis para nuestra tienda.',
      noteLine2: 'Instala PLUed desde plued.app/get, toca "¿Tu tienda te dio un código?"',
      noteLine3: 'y escribe {word}.',
      getTheApp: 'Descarga la app: ',
      posterIntro: 'PLUed es gratis para nuestra tienda. El código de tienda:',
      posterStep1: '1. Escanea el código, o instala PLUed desde plued.app/get.',
      posterStep2: '2. Toca "¿Tu tienda te dio un código?"',
      posterStep3: '3. Escribe {word}.',
      posterFoot: 'Cada teléfono que desbloqueas sigue desbloqueado. Preguntas: support@plued.app',
      stepWordTitle: 'Comparte tu código de tienda',
      stepWordBody: 'Los cajeros instalan PLUed, tocan "¿Tu tienda te dio un código?" y escriben este código de tienda. No hay nada más que configurar.',
      copyWord: 'Copiar el código de tienda', printPoster: 'Imprimir el cartel', copyNote: 'Copiar la nota para la sala de descanso',
      stepPackTitle: 'Crea tu paquete',
      stepPackBody: 'Los códigos propios de tu tienda, en la app de cada cajero. Abre el Constructor de Paquetes con el nombre de tu tienda ya escrito, o envíanos tu hoja de cálculo y lo armamos por ti.',
      openBuilder: 'Abrir el Constructor de Paquetes', sendSpreadsheet: 'Enviarnos tu hoja de cálculo',
      stepLogoTitle: 'Agrega tu logotipo',
      stepLogoBody: 'Sube un PNG, JPG o SVG. Preparamos el gráfico de 512 px y lo ponemos en el mosaico de tu tienda en la app de cada cajero.',
      uploadLogo: 'Subir tu logotipo',
      stepInviteTitle: 'Invita a tus cajeros',
      stepInviteBody: 'Reenvía el correo de bienvenida, pon la nota en la sala de descanso o copia el texto de abajo. Este paso se marca solo cuando el primer cajero usa un puesto.',
      copyInvite: 'Copiar el texto de invitación', openGet: 'Abrir plued.app/get',
      relinkBadEmail: 'Escribe el correo con el que compraste.', sending: 'Enviando...',
      relinkOffline: 'No pudimos conectar con PLUed. Inténtalo de nuevo en un momento.',
      relinkSent: 'Si ese correo compró un Plan de Tienda, el enlace va en camino. Revisa también la carpeta de spam.',
      upgradeNote: 'Agregando puestos para {store}: tu plan actual de {seats} puestos se cierra cuando empiece el nuevo. Los teléfonos ya desbloqueados siguen desbloqueados y no cuentan para los puestos nuevos.',
      openingCheckout: 'Abriendo el pago seguro...', continueCheckout: 'Continuar al pago seguro',
      checkoutUnavailable: 'El pago no está disponible en este momento. No se cobró nada. Inténtalo de nuevo en un minuto o escribe a support@plued.app.',
      badEmail: 'Ese correo no funcionó. Revísalo e inténtalo de nuevo.',
      badStore: 'Escribe el nombre de tu tienda.',
      sumTier: 'Plan de Tienda, hasta {tier} puestos', perYear: '{price} al año',
      checkoutFailed: 'No se pudo abrir el pago seguro. No se cobró nada. Regresa e inténtalo de nuevo, o escribe a support@plued.app.',
      waitingSlow: 'Tu pago se procesó y estamos preparando tu tienda. Tu código de tienda y el enlace de la página de tu tienda llegan a tu correo en unos minutos. Si para entonces no están, escribe a support@plued.app y lo resolvemos.',
      waitingNoStatus: 'Tu tienda está lista. Abre el enlace de tu correo de bienvenida para ver tu código de tienda y los siguientes pasos, o usa "enviarme el enlace otra vez" abajo.',
      leadChain: 'Escribe el nombre de tu cadena o empresa.', leadStores: '¿Cuántas tiendas?', leadName: 'Escribe tu nombre.',
      leadEmail: 'Escribe un correo que funcione.',
      leadSent: 'Enviado. Te respondemos a {email}, normalmente el mismo día hábil.', sent: 'Enviado',
      leadFlagged: 'No se pudo enviar esa nota. Por favor, escríbela de otra forma o escribe directamente a support@plued.app.',
      leadFailed: 'No se pudo enviar en este momento. Escribe a support@plued.app y nosotros nos encargamos.',
      notOurs: 'Ese enlace no es nuestro.', notOursText: 'Abre el enlace de tu correo de bienvenida, o pídelo otra vez abajo.',
      unreachable: 'No pudimos conectar con PLUed.', unreachableText: 'Revisa tu conexión y vuelve a cargar esta página.',
      pageTitle: '{store} en PLUed',
      seatsPlan: 'hasta {seats} en este año del plan', seatsJoining: '({count} entrando ahora)',
      seatsAria: '{used} de {seats} puestos usados', addSeats: 'Agregar puestos: sube a {next} puestos →',
      packPublished: 'publicado', codeOne: '{count} código', codeMany: '{count} códigos',
      planTier: 'Hasta {seats} puestos, {price} al año', ranTo: 'Duró hasta', renews: 'Se renueva',
      applePending: 'Todavía lo estamos preparando de nuestro lado; tus cajeros ya pueden empezar.', appleInactive: 'Cerrado a cajeros nuevos.',
      closedSince: 'Cerrado a cajeros nuevos desde el {date}. Los teléfonos ya desbloqueados siguen desbloqueados. Renueva desde Administrar facturación para reabrir el código de tienda.',
      reqSpreadsheet: 'Hoja de cálculo', reqLogo: 'Logotipo', reqGraphic: 'Gráfico', reqOther: 'Otro',
      stateOpen: 'Abierta', stateInProgress: 'En curso', stateDone: 'Lista', fileAttached: '(archivo adjunto)',
      resendSent: 'Enviado. El correo de bienvenida va en camino a la dirección con la que compraste.',
      tryAgainLater: 'No se pudo enviar en este momento. Inténtalo de nuevo en un minuto o escribe a support@plued.app.',
      noteSpreadsheet: 'CSV o XLSX, hasta 2 MB.', noteLogo: 'PNG, JPG o SVG, hasta 2 MB. Cuadrado o ancho funciona mejor.',
      noteGraphic: 'Una foto del producto ayuda. PNG o JPG, hasta 2 MB.', noteOther: 'PNG, JPG, CSV o XLSX, hasta 2 MB.',
      onlySpreadsheet: 'Solo CSV o XLSX para esta solicitud.', onlyLogo: 'Solo PNG, JPG o SVG para esta solicitud.',
      onlyGraphic: 'Una foto del producto ayuda. Solo PNG o JPG para esta solicitud.', onlyOther: 'Solo PNG, JPG, CSV o XLSX para esta solicitud.',
      reqEmpty: 'Agrega algunos códigos de tienda o adjunta un archivo.', reqConsent: 'Confirma que tu tienda puede usar esta marca.',
      reqTooBig: 'Ese archivo pesa {mb} MB. Archivos de hasta 2 MB, por favor. Sirve una exportación más pequeña o un PNG de menos de 2 MB.',
      uploading: 'Subiendo...', reqSent: 'Enviado. Te respondemos por correo; la solicitud aparece aquí hasta que esté lista.',
      reqFlagged: 'No se pudo enviar ese texto. Por favor, escríbelo de otra forma o escribe a support@plued.app.',
      reqOver: 'Ese archivo pesa más de 2 MB.', reqBadType: 'Ese tipo de archivo no se acepta para esta solicitud.',
      reqUnreadable: 'No se pudo leer ese archivo.',
      openingStripe: 'Abriendo Stripe...', billingUnavailable: 'La facturación no está disponible en este momento. Escribe a support@plued.app y nosotros nos encargamos.'
    }
  };

  /* t('key', {name: value}) -> the page language's sentence, English when a
     key is missing so a gap can never show a raw key to a buyer. */
  function t(key, vars) {
    var table = STRINGS[LANG] || STRINGS.en;
    var s = table.hasOwnProperty(key) ? table[key] : STRINGS.en[key];
    if (s == null) return key;
    return String(s).replace(/\{(\w+)\}/g, function (m, name) {
      return vars && vars.hasOwnProperty(name) ? String(vars[name]) : m;
    });
  }
  var TIERS = { 10: 49, 25: 99, 50: 179, 100: 299 }; // Yearly prices as set in Stripe (owner, 2026-10-05); Stripe holds the truth.
  var TIER_ORDER = [10, 25, 50, 100];

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
    return d.toLocaleDateString(LANG === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function statusUrl(token) { return 'https://plued.app' + PREFIX + '/store/s/#' + token; }
  function codeUrl(word) { return GET_URL + '/?code=' + encodeURIComponent(word); }

  /* The three-line break-room note. Same wording as the welcome email. */
  function breakroomNote(word) {
    return t('noteLine1') + '\n' + t('noteLine2') + '\n' + t('noteLine3', { word: word });
  }

  /* The forward-to-cashiers text: note plus the download link. */
  function inviteText(word) {
    return breakroomNote(word) + '\n\n' + t('getTheApp') + GET_URL;
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
    g.fillText(t('posterIntro'), W / 2, 300);
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
    var lines = [t('posterStep1'), t('posterStep2'), t('posterStep3', { word: word })];
    var ly = 1160;
    for (var i = 0; i < lines.length; i++) { g.fillText(lines[i], W / 2, ly); ly += 56; }
    g.fillStyle = '#5c6b60';
    g.font = '400 26px "Albert Sans", Arial, sans-serif';
    g.fillText(t('posterFoot'), W / 2, H - 110);
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
    var reqUrl = function (type) { return PREFIX + '/store/s/?to=requests&type=' + type + '#' + token; };
    var onStatus = !!opts.onStatusPage;
    var html = '';
    html += step('word', t('stepWordTitle'),
      '<p>' + esc(t('stepWordBody')) + '</p>' +
      '<p class="word" id="ns-word">' + esc(s.word) + '</p>' +
      '<div class="row"><button type="button" class="button kraft" id="ns-copy-word">' + esc(t('copyWord')) + '</button>' +
      '<a class="button kraft" id="ns-poster" href="#">' + esc(t('printPoster')) + '</a>' +
      '<button type="button" class="button kraft" id="ns-copy-note">' + esc(t('copyNote')) + '</button></div>' +
      '<pre class="breakroom" id="ns-note">' + esc(breakroomNote(s.word)) + '</pre>');
    html += step('pack', t('stepPackTitle'),
      '<p>' + esc(t('stepPackBody')) + '</p>' +
      '<div class="row"><a class="button" href="' + esc(builderUrl) + '">' + esc(t('openBuilder')) + '</a>' +
      '<a class="button kraft" href="' + esc(onStatus ? '#requests' : reqUrl('spreadsheet')) + '" data-request="spreadsheet">' + esc(t('sendSpreadsheet')) + '</a></div>');
    html += step('logo', t('stepLogoTitle'),
      '<p>' + esc(t('stepLogoBody')) + '</p>' +
      '<div class="row"><a class="button kraft" href="' + esc(onStatus ? '#requests' : reqUrl('logo')) + '" data-request="logo">' + esc(t('uploadLogo')) + '</a></div>');
    html += step('invite', t('stepInviteTitle'),
      '<p>' + esc(t('stepInviteBody')) + '</p>' +
      '<div class="row"><button type="button" class="button kraft" id="ns-copy-invite">' + esc(t('copyInvite')) + '</button>' +
      '<a class="button kraft" href="' + PREFIX + '/get/">' + esc(t('openGet')) + '</a></div>');
    list.innerHTML = html;

    function step(key, title, body) {
      var done = !!steps[key];
      return '<li class="next-step' + (done ? ' is-done' : '') + '" data-step="' + key + '">' +
        '<div><span class="state">' + esc(done ? t('done') : t('toDo')) + '</span><h3>' + esc(title) + '</h3>' + body + '</div></li>';
    }

    var posterA = list.querySelector('#ns-poster');
    attachPoster(posterA, s.store, s.word);
    var markWord = function () { if (opts.onSelfMark && !steps.word) opts.onSelfMark('word'); };
    posterA.addEventListener('click', markWord);
    list.querySelector('#ns-copy-word').onclick = function () {
      var b = this;
      copyText(s.word, function (ok) { flash(b, ok ? t('copied') : t('selectCopy')); if (ok) markWord(); });
    };
    list.querySelector('#ns-copy-note').onclick = function () {
      var b = this;
      copyText(breakroomNote(s.word), function (ok) { flash(b, ok ? t('copied') : t('selectCopy')); if (ok) markWord(); });
    };
    list.querySelector('#ns-copy-invite').onclick = function () {
      var b = this;
      copyText(inviteText(s.word), function (ok) { flash(b, ok ? t('copied') : t('selectCopy')); });
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
    if (st) st.textContent = t('done');
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
        out.className = 'form-status err'; out.textContent = t('relinkBadEmail');
        input.focus(); return;
      }
      button.disabled = true;
      out.className = 'form-status'; out.textContent = t('sending');
      api('POST', '/store/relink', { email: email }).then(function (r) {
        button.disabled = false;
        if (r.status === 0) { out.className = 'form-status err'; out.textContent = t('relinkOffline'); return; }
        out.className = 'form-status ok';
        out.textContent = t('relinkSent');
      });
    };
  }

  window.PluedStore = {
    API: API, TIERS: TIERS, TIER_ORDER: TIER_ORDER, GET_URL: GET_URL, LANG: LANG, PREFIX: PREFIX, t: t,
    esc: esc, money: money, nextTier: nextTier, fmtDate: fmtDate,
    statusUrl: statusUrl, codeUrl: codeUrl, breakroomNote: breakroomNote, inviteText: inviteText,
    copyText: copyText, drawPoster: drawPoster, attachPoster: attachPoster,
    renderNextSteps: renderNextSteps, markStepDone: markStepDone, allDone: allDone, flash: flash,
    api: api, wireRelink: wireRelink,
  };
})();
