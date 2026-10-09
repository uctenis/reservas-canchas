/**
 * UCTenis · Navegación y animaciones comunes a todas las páginas.
 *
 * Inserta la barra superior (y la barra inferior en móvil), el pie común y
 * las apariciones al hacer scroll. No toca ids ni clases que use el resto
 * del JavaScript: si este archivo falla, cada página sigue funcionando con
 * su cabecera original.
 */
(function () {
  'use strict';

  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
    court: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="m9 15 2 2 4-4"/></svg>',
    ranking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21V10H3v11zM15 21V3H9v18zM21 21v-7h-5v7z"/></svg>',
    league: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M5.2 6.2c3.4 2.6 3.4 9 0 11.6M18.8 6.2c-3.4 2.6-3.4 9 0 11.6"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6"/></svg>',
    rules: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>'
  };

  var LINKS = [
    { key: 'inicio', href: 'index.html', label: 'Inicio', icon: 'home', tab: true },
    { key: 'reservas', href: 'reservas.html', label: 'Reservar', icon: 'court', tab: true },
    { key: 'ranking', href: 'ranking.html', label: 'Ranking', icon: 'ranking', tab: true },
    { key: 'liga', href: 'liga.html', label: 'Liga', icon: 'league', tab: true },
    { key: 'campeonato', href: 'campeonato.html', label: 'Campeonatos', short: 'Torneos', icon: 'trophy', tab: true },
    { key: 'normas', href: 'normas.html', label: 'Normas', icon: 'rules', tab: false }
  ];

  function currentKey() {
    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (file === '' || file === 'index.html') return 'inicio';
    if (file.indexOf('reservas') === 0 || file === 'admin-horarios.html') return 'reservas';
    if (file.indexOf('ranking') === 0 || file === 'admin.html' || file === 'admin-funcionarios.html') return 'ranking';
    if (file.indexOf('liga') === 0) return 'liga';
    if (file.indexOf('campeonato') === 0 || file === 'admin-campeonatos.html') return 'campeonato';
    if (file.indexOf('normas') === 0) return 'normas';
    return '';
  }

  function buildNav(active) {
    var nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', 'Navegación principal');
    nav.innerHTML =
      '<div class="site-nav-inner">' +
        '<a class="site-brand" href="index.html" aria-label="UCTenis, ir al inicio">' +
          '<img src="logo_uctenis_v03.png" alt="" width="38" height="38">' +
          '<span class="site-brand-text"><strong>UC<em>TENIS</em></strong><small>Club · UC Temuco</small></span>' +
        '</a>' +
        '<div class="site-links">' +
          LINKS.map(function (l) {
            return '<a class="site-link' + (l.key === active ? ' is-active' : '') + '" href="' + l.href + '"' +
              (l.key === active ? ' aria-current="page"' : '') + '>' + ICONS[l.icon] + l.label + '</a>';
          }).join('') +
        '</div>' +
        '<div class="site-nav-slot" id="siteNavSlot"></div>' +
      '</div>';
    return nav;
  }

  function buildTabbar(active) {
    var bar = document.createElement('nav');
    bar.className = 'site-tabbar';
    bar.setAttribute('aria-label', 'Navegación rápida');
    bar.innerHTML = LINKS.filter(function (l) { return l.tab; }).map(function (l) {
      return '<a class="site-tab' + (l.key === active ? ' is-active' : '') + '" href="' + l.href + '"' +
        (l.key === active ? ' aria-current="page"' : '') + '>' + ICONS[l.icon] + '<span>' + (l.short || l.label) + '</span></a>';
    }).join('');
    return bar;
  }

  function buildFooter() {
    var footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML =
      '<span class="site-footer-brand"><img src="logo_uctenis_v03.png" alt="" width="30" height="30">UCTenis Club · Universidad Católica de Temuco</span>' +
      '<span class="site-footer-links">' +
        '<a href="reservas.html">Reservar</a><a href="ranking.html">Ranking</a><a href="liga.html">Liga</a>' +
        '<a href="normas.html">Normas</a><a href="https://www.instagram.com/uct.tenis" target="_blank" rel="noopener">Instagram</a>' +
      '</span>';
    return footer;
  }

  function setupReveal() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var selector = '.hero-card, .glass-card, .league-panel, .rule-card, .club-sport-launch, .home-tournament-spotlight';
    var pending = [];
    var timer = null;

    function show(el, delay) {
      el.style.setProperty('--reveal-delay', delay + 'ms');
      el.classList.add('is-in');
      // Al terminar se quitan las clases: una transformación residual
      // desubicaría cualquier elemento fijo que la tarjeta lleve dentro.
      setTimeout(function () { el.classList.remove('uct-reveal', 'is-in'); el.style.removeProperty('--reveal-delay'); }, 1100 + delay);
    }

    // Se mide la posición directamente (en vez de depender de un observador)
    // para que ninguna tarjeta pueda quedar invisible: también cubre las
    // secciones que parten ocultas y se muestran cuando llegan los datos.
    function check() {
      var limit = window.innerHeight * 0.94;
      var shown = 0;
      pending = pending.filter(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return true; // sigue oculto
        if (rect.top > limit) return true;                      // aún bajo el pliegue
        show(el, (shown++ % 4) * 70);
        return false;
      });
      if (!pending.length && timer) { clearInterval(timer); timer = null; }
    }

    Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
      // Solo se anima lo que aún no está a la vista; lo ya visible no parpadea.
      var rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.top < window.innerHeight * 0.9) return;
      el.classList.add('uct-reveal');
      pending.push(el);
    });
    if (!pending.length) return;

    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    timer = setInterval(check, 350);
  }

  function init() {
    var body = document.body;
    if (!body || body.classList.contains('has-site-nav')) return;
    var active = currentKey();

    body.insertBefore(buildNav(active), body.firstChild);
    body.appendChild(buildTabbar(active));
    body.classList.add('has-site-nav');
    if (active) body.classList.add('page-' + active);
    if (/^admin/i.test(location.pathname.split('/').pop() || '')) body.classList.add('page-admin');

    // En el inicio, el acceso de usuario se muestra dentro de la barra.
    var slot = document.getElementById('siteNavSlot');
    var homeUserBar = document.getElementById('userBarIndex');
    if (slot && homeUserBar) slot.appendChild(homeUserBar);

    if (!document.querySelector('footer')) body.appendChild(buildFooter());

    var nav = document.querySelector('.site-nav');
    var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    setupReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
