/**
 * UCTenis · Cartelera de la portada.
 *
 * Muestra lo que se juega en el club para invitar a ir a ver: el partido
 * destacado (en vivo o el próximo, con cuenta regresiva), los demás
 * partidos confirmados y los últimos resultados con su marcador por set.
 * Lee los desafíos que la portada ya dejó en DB (ranking, liga, amistosos)
 * y se repinta sola cuando cambian o cuando un partido empieza o termina.
 */
(function () {
  'use strict';

  var MATCH_MS = 2 * 60 * 60 * 1000;      // un partido "está en juego" hasta 2 h después de empezar
  var UPCOMING_DAYS = 14;                  // horizonte de la cartelera
  var RESULTS_DAYS = 10;                   // resultados recientes
  var DONE = ['completado', 'wo_retador', 'wo_retado'];
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var SITE = 'https://uctenis.github.io/reservas-canchas/';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var lastSignature = '';
  var tickTimer = null;
  var railTimers = [];

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shortName(name) { return String(name || 'Jugador').split(/\s+/).slice(0, 2).join(' '); }
  function firstName(name) { return String(name || 'Jugador').split(/\s+/)[0]; }
  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase();
  }

  // ── Datos ───────────────────────────────────────────────────────────────
  function players() {
    try {
      var cloud = DB.getCachedPlayersSnapshot && DB.getCachedPlayersSnapshot();
      if (cloud && cloud.length) return cloud;
    } catch (e) {}
    try { return DB.getUsers() || []; } catch (e) { return []; }
  }

  function findPlayer(list, id, email, name) {
    var mail = String(email || '').toLowerCase();
    var key = String(name || '').toLowerCase().trim();
    return list.find(function (p) {
      return (id && (p.id === id || p.localId === id)) ||
        (mail && String(p.email || '').toLowerCase() === mail) ||
        (key && String(p.nombre || '').toLowerCase().trim() === key);
    }) || null;
  }

  function side(c, role, list) {
    var name = c[role + 'Nombre'] || 'Jugador';
    var p = findPlayer(list, c[role + 'Id'], c[role + 'Email'], name);
    var photo = (p && p.foto) || (typeof window.getPlayerPhoto === 'function' ? window.getPlayerPhoto(name) : '');
    var pos = p ? Number(p.posicion != null && p.posicion !== '' ? p.posicion : p.pos) : 0;
    return { name: name, photo: photo, pos: pos > 0 && p.activo !== false ? pos : 0, id: c[role + 'Id'] };
  }

  function startOf(c) {
    var date = String(c.fecha || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    var slot = /^\d{1,2}:\d{2}/.test(String(c.slot || '')) ? String(c.slot).slice(0, 5) : '';
    var d = new Date(date + 'T' + (slot || '00:00') + ':00');
    return isNaN(d) ? null : { at: d.getTime(), hasTime: Boolean(slot), date: date, slot: slot };
  }

  function isTestAccount(c) {
    var text = [c.retadorNombre, c.retadoNombre, c.retadorEmail, c.retadoEmail].join(' ').toLowerCase();
    return text.indexOf('rob roco') >= 0 || text.indexOf('dsilvaroco') >= 0;
  }

  function isAdmin() {
    try {
      var s = DB.getSession();
      var mail = String(s && s.email || '').toLowerCase();
      return Boolean(s && (s.isAdmin === true || ['uctenisclub@gmail.com', 'dsilva@uct.cl'].indexOf(mail) >= 0));
    } catch (e) { return false; }
  }

  // Fecha y grupo de un partido de liga, si la liga los conoce.
  function leagueInfo(c, list) {
    var L = window.UCTennisLeague;
    if (!L || c.tipo !== 'liga') return null;
    try {
      leagueInfo.cache = leagueInfo.cache || {};
      var gender = L.normalizeGender(c.genero) || 'M';
      var view = leagueInfo.cache[gender] || (leagueInfo.cache[gender] = L.buildSeasonView(list, DB.getChallenges(), { gender: gender }));
      for (var i = 0; i < view.rounds.length; i++) {
        var hit = view.rounds[i].partidos.find(function (p) { return p.match && p.match.id === c.id; });
        if (hit) return { fecha: view.rounds[i].numero, grupo: view.grouped ? hit.grupo : 0 };
      }
    } catch (e) {}
    return null;
  }

  function typeInfo(c, list) {
    if (c.tipo === 'liga') {
      var info = leagueInfo(c, list);
      var detail = info ? ' · Fecha ' + info.fecha + (info.grupo ? ' · G' + info.grupo : '') : '';
      return { cls: 'liga', label: '🏆 Liga' + detail, link: 'liga.html#fixture' };
    }
    if (c.tipo === 'amistoso') return { cls: 'amistoso', label: '🤝 Amistoso', link: 'ranking.html' };
    if (c.tipo === 'campeonato') return { cls: 'campeonato', label: '🏅 Campeonato', link: 'campeonato.html' };
    return { cls: 'ranking', label: '⚔️ Desafío del ranking', link: 'ranking.html' };
  }

  function collect() {
    var all = (typeof DB !== 'undefined' && DB.getChallenges) ? (DB.getChallenges() || []) : [];
    var admin = isAdmin();
    var now = Date.now();
    var list = players();
    leagueInfo.cache = {};
    var upcoming = [], live = [], results = [];

    all.forEach(function (c) {
      if (!c || isTestAccount(c) || (c.tipo === 'campeonato' && !admin)) return;
      if (!c.retadorNombre && !c.retadoNombre) return;
      var when = startOf(c);
      if (c.status === 'aceptado' && when) {
        var end = when.hasTime ? when.at + MATCH_MS : when.at + 24 * 60 * 60 * 1000;
        if (when.hasTime && now >= when.at && now < end) live.push(build(c, when, list));
        else if (when.at > now && when.at - now <= UPCOMING_DAYS * 86400000) upcoming.push(build(c, when, list));
        else if (!when.hasTime && now < end && now >= when.at) upcoming.push(build(c, when, list));
      } else if (DONE.indexOf(c.status) >= 0 && c.ganadorId) {
        var played = Date.parse(c.fechaConfirmacion || c.fechaResultado || c.actualizado || c.fecha) || (when && when.at) || 0;
        if (now - played <= RESULTS_DAYS * 86400000) results.push(buildResult(c, when, played, list));
      }
    });
    upcoming.sort(function (a, b) { return a.when.at - b.when.at; });
    live.sort(function (a, b) { return a.when.at - b.when.at; });
    results.sort(function (a, b) { return b.played - a.played; });
    return { upcoming: upcoming, live: live, results: results.slice(0, 12) };
  }

  function build(c, when, list) {
    return { c: c, when: when, a: side(c, 'retador', list), b: side(c, 'retado', list), type: typeInfo(c, list), court: (c.courtLabel || c.cancha || '').trim() };
  }

  function buildResult(c, when, played, list) {
    var item = build(c, when || { at: played }, list);
    item.played = played;
    var winnerIsA = String(c.ganadorId) === String(c.retadorId) || c.status === 'wo_retado';
    if (c.status === 'wo_retador') winnerIsA = false;
    item.winner = winnerIsA ? 'a' : 'b';
    item.wo = c.status !== 'completado' || /w\.?o/i.test(String(c.marcador || ''));
    item.sets = item.wo ? [] : String(c.marcador || '').split(',').map(function (s) {
      var m = s.trim().match(/^(\d+)\s*[-/]\s*(\d+)/);
      return m ? [Number(m[1]), Number(m[2])] : null;
    }).filter(Boolean);
    return item;
  }

  // ── Formatos ────────────────────────────────────────────────────────────
  function dayLabel(when) {
    var d = new Date(when.at);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today) / 86400000);
    var base = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : DAYS[d.getDay()].charAt(0).toUpperCase() + DAYS[d.getDay()].slice(1) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    return base + (when.hasTime ? ' · ' + when.slot : '');
  }

  function relativePast(ms) {
    var mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
    if (mins < 60) return 'hace ' + mins + ' min';
    var hours = Math.round(mins / 60);
    if (hours < 24) return 'hace ' + hours + ' h';
    var days = Math.round(hours / 24);
    return days === 1 ? 'ayer' : 'hace ' + days + ' días';
  }

  function countdownParts(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  }

  function soonLabel(ms) {
    var p = countdownParts(ms);
    if (p.d >= 1) return 'en ' + p.d + (p.d === 1 ? ' día' : ' días');
    if (p.h >= 1) return 'en ' + p.h + ' h ' + (p.m ? p.m + ' min' : '');
    return 'en ' + Math.max(1, p.m) + ' min';
  }

  function avatar(player, size) {
    var img = player.photo ? '<img src="' + esc(player.photo) + '" alt="" loading="lazy" onerror="this.remove()">' : '';
    return '<span class="ct-av' + (size ? ' ct-av-' + size : '') + '">' + img + '<b>' + esc(initials(player.name)) + '</b></span>';
  }

  function rank(player, item) {
    return item.c.tipo !== 'amistoso' && player.pos ? '<em class="ct-rank">#' + player.pos + '</em>' : '';
  }

  function calendarUrl(item) {
    var start = new Date(item.when.at);
    var end = new Date(item.when.at + 90 * 60000);
    function stamp(d) {
      return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
        'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
    }
    var title = '🎾 ' + shortName(item.a.name) + ' vs ' + shortName(item.b.name) + ' · UCTenis';
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) +
      '&dates=' + stamp(start) + '/' + stamp(end) + '&ctz=America/Santiago' +
      '&location=' + encodeURIComponent(item.court || 'UCTenis') +
      '&details=' + encodeURIComponent(item.type.label.replace(/^\S+\s/, '') + '. ¡Ven a alentar! ' + SITE);
  }

  function shareText(item) {
    var live = Date.now() >= item.when.at;
    return '🎾 ' + (live ? '¡Se está jugando ahora!' : dayLabel(item.when) + ':') + ' ' + shortName(item.a.name) + ' vs ' + shortName(item.b.name) +
      (item.court ? ' en ' + item.court : '') + ' (' + item.type.label.replace(/^\S+\s/, '') + '). ¡Ven a alentar! ' + SITE;
  }

  // ── Pintado ─────────────────────────────────────────────────────────────
  function featureMatch(item, isLive) {
    var key = esc(item.c.id);
    var timer = isLive
      ? '<div class="ct-live-now"><span class="ct-pulse"></span><div><strong>Se está jugando</strong><small data-ct-since="' + item.when.at + '">' + relativePast(item.when.at).replace('hace', 'empezó hace') + '</small></div></div>'
      : '<div class="ct-countdown" data-ct-countdown="' + item.when.at + '" aria-label="Cuenta regresiva">' +
          ['d', 'h', 'm', 's'].map(function (k) {
            return '<div><strong data-k="' + k + '">00</strong><span>' + { d: 'días', h: 'horas', m: 'min', s: 'seg' }[k] + '</span></div>';
          }).join('') + '</div>';
    return '<article class="ct-feature ' + (isLive ? 'is-live' : '') + ' t-' + item.type.cls + '">' +
      '<div class="ct-feature-top"><span class="ct-type">' + esc(item.type.label) + '</span>' +
        (isLive ? '<span class="ct-badge-live">● En vivo</span>' : '<span class="ct-badge-next">Próximo partido</span>') + '</div>' +
      '<div class="ct-duel">' +
        '<div class="ct-duel-side">' + avatar(item.a, 'xl') + rank(item.a, item) + '<strong>' + esc(shortName(item.a.name)) + '</strong></div>' +
        '<div class="ct-vs"><span class="ct-ball" aria-hidden="true"></span><b>VS</b></div>' +
        '<div class="ct-duel-side">' + avatar(item.b, 'xl') + rank(item.b, item) + '<strong>' + esc(shortName(item.b.name)) + '</strong></div>' +
      '</div>' +
      timer +
      '<p class="ct-where">📅 ' + esc(dayLabel(item.when)) + (item.court ? ' &nbsp;·&nbsp; 📍 ' + esc(item.court) : '') + '</p>' +
      '<div class="ct-actions">' +
        (isLive ? '' : '<a class="ct-btn" href="' + esc(calendarUrl(item)) + '" target="_blank" rel="noopener">＋ Agendar para ir a ver</a>') +
        '<button class="ct-btn ghost" type="button" data-ct-share="' + key + '">Invitar a alentar</button>' +
        '<a class="ct-link" href="' + item.type.link + '">Ver detalle →</a>' +
      '</div>' +
    '</article>';
  }

  function featureResult(item) {
    return '<article class="ct-feature is-result t-' + item.type.cls + '">' +
      '<div class="ct-feature-top"><span class="ct-type">' + esc(item.type.label) + '</span><span class="ct-badge-next">Último resultado · ' + esc(relativePast(item.played)) + '</span></div>' +
      scoreboard(item, true) +
      '<p class="ct-where">' + (item.winner === 'a' ? esc(firstName(item.a.name)) : esc(firstName(item.b.name))) + ' se quedó con el partido' + (item.court ? ' en ' + esc(item.court) : '') + '. ¿Quién será el próximo?</p>' +
      '<div class="ct-actions"><a class="ct-btn" href="ranking.html">Desafiar a alguien</a><a class="ct-link" href="liga.html">Ver la liga →</a></div>' +
    '</article>';
  }

  function scoreboard(item, big) {
    function row(player, key) {
      var mine = key === 'a' ? 0 : 1;
      var won = item.winner === key;
      var cells = item.wo
        ? (won ? '<span class="ct-set win">W.O.</span>' : '')
        : item.sets.map(function (set) {
          var me = set[mine], other = set[1 - mine];
          return '<span class="ct-set ' + (me > other ? 'win' : '') + '">' + me + '</span>';
        }).join('');
      return '<div class="ct-sb-row ' + (won ? 'is-win' : '') + '">' + avatar(player, big ? 'md' : 'sm') +
        '<span class="ct-sb-name">' + esc(shortName(player.name)) + (won ? ' <i aria-label="ganador">✓</i>' : '') + '</span>' +
        '<span class="ct-sets">' + cells + '</span></div>';
    }
    return '<div class="ct-sb ' + (big ? 'is-big' : '') + '">' + row(item.a, 'a') + row(item.b, 'b') + '</div>';
  }

  function miniMatch(item, isLive) {
    var ms = item.when.at - Date.now();
    var soon = isLive ? '<span class="ct-chip live">● En vivo</span>'
      : ms < 86400000 && item.when.hasTime ? '<span class="ct-chip hot" data-ct-soon="' + item.when.at + '">' + esc(soonLabel(ms)) + '</span>' : '';
    return '<article class="ct-card t-' + item.type.cls + '" role="listitem">' +
      '<div class="ct-card-top"><span class="ct-type sm">' + esc(item.type.label) + '</span>' + soon + '</div>' +
      '<div class="ct-mini-duel">' +
        '<div>' + avatar(item.a, 'md') + '<strong>' + esc(shortName(item.a.name)) + '</strong>' + rank(item.a, item) + '</div>' +
        '<b class="ct-mini-vs">vs</b>' +
        '<div>' + avatar(item.b, 'md') + '<strong>' + esc(shortName(item.b.name)) + '</strong>' + rank(item.b, item) + '</div>' +
      '</div>' +
      '<div class="ct-card-foot"><span>📅 ' + esc(dayLabel(item.when)) + '</span>' + (item.court ? '<span>📍 ' + esc(item.court) + '</span>' : '') + '</div>' +
    '</article>';
  }

  function miniResult(item) {
    return '<article class="ct-card is-result t-' + item.type.cls + '" role="listitem">' +
      '<div class="ct-card-top"><span class="ct-type sm">' + esc(item.type.label) + '</span><span class="ct-ago">' + esc(relativePast(item.played)) + '</span></div>' +
      scoreboard(item, false) +
      (item.court ? '<div class="ct-card-foot"><span>📍 ' + esc(item.court) + '</span></div>' : '') +
    '</article>';
  }

  function rail(title, hint, cards, id) {
    if (!cards.length) return '';
    return '<div class="ct-rail-head"><h3>' + title + '</h3>' + (cards.length > 1 ? '<span>' + hint + '</span>' : '') + '</div>' +
      '<div class="ct-rail" id="' + id + '" role="list">' + cards.join('') + '</div>';
  }

  function render(force) {
    var root = $('cartelera');
    if (!root || typeof DB === 'undefined') return;
    var data = collect();
    var signature = JSON.stringify([data.live.map(function (i) { return i.c.id; }), data.upcoming.map(function (i) { return i.c.id + i.c.status; }), data.results.map(function (i) { return i.c.id; }), players().length]);
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    var featured = data.live[0] || data.upcoming[0] || null;
    var restLive = data.live.slice(featured && data.live[0] === featured ? 1 : 0);
    var restUpcoming = data.upcoming.filter(function (i) { return i !== featured; });
    var hero = featured ? featureMatch(featured, data.live[0] === featured) : (data.results[0] ? featureResult(data.results[0]) : '');
    var results = featured ? data.results : data.results.slice(1);

    if (!hero) {
      root.hidden = false;
      root.innerHTML = head(0, 0) +
        '<div class="ct-empty"><span>🎾</span><div><strong>La cancha está esperando</strong><p>Todavía no hay partidos agendados. Desafía a alguien del ranking o agenda tu fecha de la liga y aparecerás aquí.</p></div>' +
        '<a class="ct-btn" href="ranking.html">Desafiar</a></div>';
      return;
    }

    root.hidden = false;
    root.innerHTML = head(data.live.length, data.upcoming.length) +
      '<div class="ct-grid">' + hero +
        '<div class="ct-side">' +
          rail('Próximos partidos', 'Desliza →', restLive.map(function (i) { return miniMatch(i, true); }).concat(restUpcoming.map(function (i) { return miniMatch(i, false); })), 'ctUpcoming') +
          rail('Últimos resultados', 'Desliza →', results.map(miniResult), 'ctResults') +
        '</div>' +
      '</div>';
    bindShare(data);
    tick();
    startRails();
  }

  function head(liveCount, upcomingCount) {
    var status = liveCount ? '<span class="ct-live-pill">● ' + liveCount + (liveCount === 1 ? ' partido en juego' : ' partidos en juego') + '</span>'
      : upcomingCount ? '<span class="ct-count-pill">' + upcomingCount + (upcomingCount === 1 ? ' partido agendado' : ' partidos agendados') + '</span>' : '';
    return '<div class="ct-head"><div><span class="ct-kicker"><i class="ct-dot"></i>Cartelera del club</span>' +
      '<h2>Se juega en UCTenis</h2><p>Partidos confirmados y resultados al día. ¡Date una vuelta y alienta!</p></div>' + status + '</div>';
  }

  function bindShare(data) {
    var all = data.live.concat(data.upcoming);
    document.querySelectorAll('[data-ct-share]').forEach(function (button) {
      button.addEventListener('click', function () {
        var item = all.find(function (i) { return String(i.c.id) === button.dataset.ctShare; });
        if (!item) return;
        var text = shareText(item);
        if (navigator.share) navigator.share({ text: text }).catch(function () {});
        else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      });
    });
  }

  // Cuenta regresiva y etiquetas "en X min" en vivo; al llegar a cero se
  // repinta para pasar el partido a "En vivo".
  function tick() {
    clearInterval(tickTimer);
    function update() {
      var now = Date.now();
      var flip = false;
      document.querySelectorAll('[data-ct-countdown]').forEach(function (el) {
        var ms = Number(el.dataset.ctCountdown) - now;
        if (ms <= 0) { flip = true; return; }
        var p = countdownParts(ms);
        el.querySelectorAll('[data-k]').forEach(function (cell) {
          var value = String(p[cell.dataset.k]).padStart(2, '0');
          if (cell.textContent !== value) {
            cell.textContent = value;
            if (!reduceMotion) { cell.classList.remove('is-flip'); void cell.offsetWidth; cell.classList.add('is-flip'); }
          }
        });
        el.classList.toggle('is-close', ms < 3600000);
      });
      document.querySelectorAll('[data-ct-soon]').forEach(function (el) {
        var ms = Number(el.dataset.ctSoon) - now;
        if (ms <= 0) flip = true; else el.textContent = soonLabel(ms);
      });
      document.querySelectorAll('[data-ct-since]').forEach(function (el) {
        var since = Number(el.dataset.ctSince);
        if (now - since >= MATCH_MS) flip = true;
        else el.textContent = relativePast(since).replace('hace', 'empezó hace');
      });
      if (flip) render(true);
    }
    update();
    tickTimer = setInterval(update, 1000);
  }

  // Los carruseles avanzan solos cada pocos segundos, salvo que la persona
  // los esté tocando o pase el mouse, o pida menos movimiento.
  function startRails() {
    railTimers.forEach(clearInterval);
    railTimers = [];
    if (reduceMotion) return;
    ['ctUpcoming', 'ctResults'].forEach(function (id, index) {
      var el = $(id);
      if (!el) return;
      var pausedUntil = 0;
      ['pointerdown', 'wheel', 'touchstart', 'focusin', 'mouseenter'].forEach(function (evt) {
        el.addEventListener(evt, function () { pausedUntil = Date.now() + 9000; }, { passive: true });
      });
      el.addEventListener('mouseleave', function () { pausedUntil = Date.now() + 2000; });
      railTimers.push(setInterval(function () {
        if (Date.now() < pausedUntil || document.hidden || el.scrollWidth <= el.clientWidth + 4) return;
        var card = el.querySelector('.ct-card');
        var step = card ? card.getBoundingClientRect().width + 12 : el.clientWidth * 0.8;
        var atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
        el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' });
      }, 5200 + index * 900));
    });
  }

  function init() {
    if (!$('cartelera') || typeof DB === 'undefined') return;
    render(true);
    if (DB.addEventListener) {
      DB.addEventListener('challenges-updated', function () { setTimeout(function () { render(false); }, 300); });
      DB.addEventListener('players-updated', function () { render(false); });
    }
    // La portada carga los desafíos de la nube después de pintar: se revisa
    // seguido al principio y luego cada minuto (partidos que empiezan, etc.).
    var checks = 0;
    var early = setInterval(function () { render(false); if (++checks > 20) clearInterval(early); }, 1500);
    setInterval(function () { render(false); }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
