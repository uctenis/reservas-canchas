(() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbzlzQPYAW_pz4IKdrZqNwjzkKSkvX5gJ6-2_MNteGWW_fDPNPPkkyFBVpy3gpRlV2TG/exec';
  const root = document.getElementById('tournamentRoot');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const formatDate = value => {
    if (!value) return 'Por confirmar';
    const parts = value.slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat('es-CL', { day:'numeric', month:'short', year:'numeric' }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  };
  const statusLabel = {draft:'Borrador',registration:'Inscripciones abiertas',draw:'Cuadro publicado',in_progress:'En juego',finished:'Finalizado',archived:'Archivado'};
  const courtLabel = {cec1:'CEC Cancha 1',cec2:'CEC Cancha 2',cjp1:'CJP Cancha 1',cjp2:'CJP Cancha 2'};

  function playerLine(player, match) {
    if (!player) return '<div class="match-player"><span>Por definir</span><span class="match-score">-</span></div>';
    const won = match.winner && match.winner.id === player.id;
    return `<div class="match-player ${won ? 'winner' : ''}"><span><span class="match-seed">${player.seed ? '#' + esc(player.seed) : ''}</span>${esc(player.name)}</span><span class="match-score">${won ? '&#10003;' : ''}</span></div>`;
  }

  // Panel de cabezas de serie (como la lista "SEEDED PLAYERS" de un cuadro
  // ATP): solo tiene sentido mostrar una fraccion de los inscritos como
  // sembrados, no la nomina completa (eso ya vive en "Inscritos").
  function renderSeededList(tournament) {
    const seedSlots = Math.max(2, Math.floor((tournament.size || 0) / 4));
    const seeded = (tournament.participants || [])
      .filter(player => player.seed && player.seed <= seedSlots)
      .sort((a, b) => a.seed - b.seed);
    if (!seeded.length) return '';
    return `<div class="tour-card seeded-list">
      <h3 class="round-title">Cabezas de serie</h3>
      ${seeded.map(player => `<div class="seeded-item"><span class="seeded-num">${esc(player.seed)}</span><span>${esc(player.name)}</span></div>`).join('')}
    </div>`;
  }

  function renderBracket(tournament) {
    if (!tournament.matches?.length) return '<div class="tour-card empty-state">El cuadro se publicar&aacute; cuando finalicen las inscripciones.</div>';
    const rounds = [...new Set(tournament.matches.map(match => match.round))];
    const finalMatch = tournament.matches.find(match => match.roundName === 'Final');
    const championBox = `<section class="bracket-round champion-round"><h3 class="round-title">Campe&oacute;n</h3><div class="round-matches"><article class="match-box champion-box" data-match-id="champion">
      ${tournament.champion
        ? `<div class="champion-name"><span class="champion-trophy">&#127942;</span>${esc(tournament.champion.name)}</div>`
        : `<div class="champion-name champion-pending">${finalMatch?.winner ? esc(finalMatch.winner.name) : 'Por definir'}</div>`}
    </article></div></section>`;
    return `<div class="seeded-and-bracket">
      ${renderSeededList(tournament)}
      <div class="bracket-scroll"><div class="bracket" id="tourBracket">${rounds.map(round => {
        const matches = tournament.matches.filter(match => match.round === round);
        return `<section class="bracket-round"><h3 class="round-title">${esc(matches[0]?.roundName || 'Ronda')}</h3><div class="round-matches">${matches.map(match => `
          <article class="match-box" data-match-id="${esc(match.id)}" data-next="${esc(match.roundName === 'Final' ? 'champion' : (match.nextMatchId || ''))}">
            ${playerLine(match.player1, match)}
            ${playerLine(match.player2, match)}
            <div class="match-meta">${esc(match.scoreLabel || (match.date ? formatDate(match.date) + ' &middot; ' + match.slot : 'Horario por confirmar'))}</div>
          </article>`).join('')}</div></section>`;
      }).join('')}${championBox}</div></div>
    </div>`;
  }

  // Las lineas que conectan cada partido con el siguiente se calculan a
  // partir de la posicion real ya renderizada (getBoundingClientRect), en
  // vez de intentar cuadrarlas a puro CSS: el cuadro puede tener 8, 16 o 32
  // jugadores (distinta cantidad de rondas y de huecos entre partidos), asi
  // que medir el DOM real es lo unico que funciona para cualquier tamano.
  function drawBracketConnectors() {
    const bracket = document.getElementById('tourBracket');
    if (!bracket) return;
    let svg = bracket.querySelector('.bracket-lines');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'bracket-lines');
      bracket.prepend(svg);
    }
    const boxRect = bracket.getBoundingClientRect();
    svg.setAttribute('width', bracket.scrollWidth);
    svg.setAttribute('height', bracket.scrollHeight);
    svg.innerHTML = '';
    bracket.querySelectorAll('.match-box[data-next]').forEach(box => {
      const nextId = box.dataset.next;
      if (!nextId) return;
      const target = bracket.querySelector(`.match-box[data-match-id="${CSS.escape(nextId)}"]`);
      if (!target) return;
      const from = box.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      // getBoundingClientRect ya viene en coordenadas de viewport, asi que
      // restar boxRect (medido en el mismo instante) cancela cualquier
      // scroll de los contenedores por los que pase (.bracket-scroll, la
      // pagina, etc.) sin necesitar sumarlo aparte.
      const x1 = from.right - boxRect.left;
      const y1 = from.top + from.height / 2 - boxRect.top;
      const x2 = to.left - boxRect.left;
      const y2 = to.top + to.height / 2 - boxRect.top;
      const midX = x1 + (x2 - x1) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`);
      path.setAttribute('class', 'bracket-line');
      svg.appendChild(path);
    });
  }

  let redrawScheduled = false;
  function scheduleDrawConnectors() {
    if (redrawScheduled) return;
    redrawScheduled = true;
    requestAnimationFrame(() => {
      redrawScheduled = false;
      drawBracketConnectors();
    });
  }
  window.addEventListener('resize', scheduleDrawConnectors);

  function render(t) {
    document.title = `${t.name} | UCTenis`;
    const scheduled = (t.matches || []).filter(match => match.date && match.status !== 'completed')
      .sort((a,b) => (a.date + a.slot).localeCompare(b.date + b.slot));
    const completed = (t.matches || []).filter(match => match.status === 'completed').length;
    const rules = esc(t.rules || 'Eliminaci&oacute;n directa. Partidos al mejor de tres sets; tercer set definido por la organizaci&oacute;n.');
    root.className = '';
    root.innerHTML = `
      <header class="tour-hero" style="--tour-accent:${esc(t.accent || '#d8ff3e')}">
        <span class="tour-kicker">${esc(statusLabel[t.status] || 'Campeonato oficial')}</span>
        <h1>${esc(t.name)}</h1>
        <p class="tour-lead">${esc(t.tagline || t.description || 'Competencia, comunidad y tenis universitario en un solo cuadro.')}</p>
        <div class="tour-hero-actions">
          <a class="tour-link primary" href="#cuadro">Ver cuadro oficial</a>
          <a class="tour-link" href="#agenda">Pr&oacute;ximos partidos</a>
        </div>
        <div class="tour-metrics">
          <div class="tour-metric"><strong>${formatDate(t.startDate)}</strong><span>Inicio</span></div>
          <div class="tour-metric"><strong>${esc(t.venue || 'UCTenis')}</strong><span>Sede</span></div>
          <div class="tour-metric"><strong>${t.participants?.length || 0} / ${t.size}</strong><span>Inscritos</span></div>
          <div class="tour-metric"><strong>${t.champion ? esc(t.champion.name) : completed + ' resultados'}</strong><span>${t.champion ? 'Campe&oacute;n/a' : 'Avance'}</span></div>
        </div>
      </header>

      <section class="tour-section" id="cuadro">
        <div class="tour-section-head"><div><h2>Cuadro oficial</h2><p class="tour-section-copy">Los ganadores avanzan autom&aacute;ticamente en cada ronda.</p></div><span class="status-pill">${t.size} jugadores</span></div>
        ${renderBracket(t)}
      </section>

      <div class="tour-grid">
        <section class="tour-section" id="agenda">
          <div class="tour-section-head"><div><h2>Agenda de cancha</h2><p class="tour-section-copy">Horarios confirmados por la organizaci&oacute;n.</p></div></div>
          <div class="tour-card schedule-list">${scheduled.length ? scheduled.map(match => `
            <article class="schedule-item"><div class="schedule-date">${formatDate(match.date).replace(/ de /g,' ')}</div><div><strong>${esc(match.player1?.name || 'Por definir')} vs ${esc(match.player2?.name || 'Por definir')}</strong><div class="schedule-meta">${esc(match.roundName)} &middot; ${esc(courtLabel[match.courtId] || match.courtId)}</div></div><strong>${esc(match.slot)}</strong></article>`).join('') : '<div class="empty-state">No hay partidos pendientes con horario confirmado.</div>'}</div>
        </section>
        <section class="tour-section">
          <div class="tour-section-head"><div><h2>Ficha del torneo</h2><p class="tour-section-copy">Informaci&oacute;n oficial.</p></div></div>
          <div class="tour-card">
            <p><strong>Categor&iacute;a:</strong> ${esc(t.category)}</p>
            <p><strong>Modalidad:</strong> ${esc(t.gender)} &middot; ${esc(t.surface)}</p>
            <p><strong>Premiaci&oacute;n:</strong> ${esc(t.prize || 'Por anunciar')}</p>
            <p><strong>Organiza:</strong> ${esc(t.organizer || 'UCTenis Club')}</p>
            <p><strong>Bases:</strong> ${rules}</p>
          </div>
        </section>
      </div>

      <div class="tour-grid">
        <section class="tour-section">
          <div class="tour-section-head"><div><h2>&Uacute;ltimas noticias</h2><p class="tour-section-copy">Resultados publicados desde la mesa de control.</p></div></div>
          <div class="news-list">${t.news?.length ? t.news.map(item => `<article class="news-item"><div class="news-time">${formatDate(item.publishedAt)}</div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p></article>`).join('') : '<div class="tour-card empty-state">Las noticias aparecer&aacute;n al registrar los primeros resultados.</div>'}</div>
        </section>
        <section class="tour-section">
          <div class="tour-section-head"><div><h2>Inscritos</h2><p class="tour-section-copy">N&oacute;mina oficial del campeonato.</p></div></div>
          <div class="tour-card roster-list">${t.participants?.length ? [...t.participants].sort((a,b)=>(a.seed||99)-(b.seed||99)).map(player => `<div class="roster-item"><span>${esc(player.name)}${player.clubMember ? ' <small>UCTenis</small>' : ''}</span><span class="seed-pill">#${esc(player.seed || '-')}</span></div>`).join('') : '<div class="empty-state">A&uacute;n no hay inscritos publicados.</div>'}</div>
        </section>
      </div>`;
    scheduleDrawConnectors();
  }

  async function load() {
    try {
      const id = new URLSearchParams(location.search).get('id');
      const query = id ? `action=get_tournament&id=${encodeURIComponent(id)}` : 'action=get_tournaments';
      const response = await fetch(`${API_URL}?${query}&v=${Date.now()}`);
      const data = await response.json();
      const tournament = id ? data.tournament : data.tournaments?.[0];
      if (!data.ok || !tournament) throw new Error(data.msg || 'No hay campeonatos publicados.');
      render(tournament);
    } catch (error) {
      root.className = '';
      root.innerHTML = `<div class="tour-card empty-state"><h1>Campeonato no disponible</h1><p>${esc(error.message)}</p><a class="tour-link" href="index.html">Volver al inicio</a></div>`;
    }
  }
  load();
})();

