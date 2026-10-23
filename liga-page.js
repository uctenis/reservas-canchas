/* UCTenis · Página del Campeonato de Liga (liga.html).
 * El cálculo (fixture, puntajes, plazos) vive en liga.js; aquí solo se pinta
 * y se manejan la inscripción y las acciones de la comisión organizadora. */
(function () {
  'use strict';

  const L = window.UCTennisLeague;
  const season = L.getSeason();
  const ADMIN_EMAILS = ['uctenisclub@gmail.com', 'dsilva@uct.cl'];
  const PURE_ADMIN_EMAILS = ['uctenisclub@gmail.com'];
  const FINAL_STATES = ['jugado', 'wo', 'wo_doble'];
  const GENDER_LABEL = { M: 'Varones', F: 'Damas' };

  const state = {
    gender: 'M',
    tab: '',
    round: null,
    players: [],
    staff: [],
    matches: [],
    session: null,
    me: null,
    isAdmin: false,
    loaded: false,
    busy: false
  };

  // ── Utilidades ────────────────────────────────────────────────────────
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  // Chile escribe las fechas día-mes-año, nunca ISO.
  function fmt(iso, opts = { day: 'numeric', month: 'short' }) {
    const date = new Date(`${iso}T00:00:00Z`);
    return isNaN(date) ? iso : date.toLocaleDateString('es-CL', { ...opts, timeZone: 'UTC' }).replace('.', '');
  }
  function fmtLong(iso) { return fmt(iso, { day: 'numeric', month: 'long' }); }
  function fmtRange(window) {
    const sameMonth = window.start.slice(0, 7) === window.end.slice(0, 7);
    return sameMonth
      ? `${Number(window.start.slice(8))}–${fmt(window.end)}`
      : `${fmt(window.start)} – ${fmt(window.end)}`;
  }
  function daysLabel(days) { return days === 1 ? '1 día' : `${days} días`; }

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
  function avatar(entrant, size = '') {
    const photo = entrant && entrant.foto;
    const cls = `lg-avatar${size ? ` lg-avatar-${size}` : ''}`;
    if (photo) return `<span class="${cls}"><img src="${esc(photo)}" alt="" loading="lazy" onerror="this.remove()"><b>${esc(initials(entrant.nombre))}</b></span>`;
    return `<span class="${cls}"><b>${esc(initials(entrant && entrant.nombre))}</b></span>`;
  }

  const CATEGORY_LABELS = { primera: 'Primera', '1ra': 'Primera', 1: 'Primera', segunda: 'Segunda', '2da': 'Segunda', 2: 'Segunda', tercera: 'Tercera', '3ra': 'Tercera', 3: 'Tercera', cuarta: 'Cuarta', '4ta': 'Cuarta', 4: 'Cuarta', quinta: 'Quinta', '5ta': 'Quinta', 5: 'Quinta', abierta: 'Quinta', principiante: 'Quinta' };
  function category(value) {
    const raw = String(value || '').trim();
    const key = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return CATEGORY_LABELS[key] || raw;
  }

  function toast(message, kind = 'ok') {
    const el = document.getElementById('lgToast');
    el.textContent = message;
    el.className = `lg-toast show ${kind}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.className = 'lg-toast'; }, 4200);
  }

  // La liga está abierta a socios y no socios (funcionarios, socios fuera
  // de la escalerilla): basta con estar inscrito. Solo queda fuera la
  // cuenta administradora del club.
  function isLeagueEligible(player) {
    const email = String(player?.email || '').trim().toLowerCase();
    return Boolean(player) && !PURE_ADMIN_EMAILS.includes(email);
  }

  function findMe() {
    const session = state.session;
    if (!session) return null;
    const email = String(session.email || '').trim().toLowerCase();
    return state.players.find(player => (email && String(player.email || '').toLowerCase() === email) || (session.id && player.id === session.id)) || null;
  }

  function view(gender = state.gender) {
    return L.buildSeasonView(state.players, state.matches, { season, gender, today: L.todayIso() });
  }

  const STATE_CHIP = {
    proximo: ['Próxima', 'muted'],
    por_agendar: ['Por agendar', 'warn'],
    invitado: ['Invitación enviada', 'info'],
    agendado: ['Agendado', 'info'],
    por_confirmar: ['Por confirmar', 'info'],
    jugado: ['Jugado', 'ok'],
    wo: ['W.O.', 'ok'],
    wo_doble: ['W.O. doble', 'bad']
  };
  function chip(stateKey, extra = '') {
    const [label, tone] = STATE_CHIP[stateKey] || [stateKey, 'muted'];
    return `<span class="lg-chip ${tone}">${esc(extra || label)}</span>`;
  }

  function scheduleLink(rival) {
    return `ranking.html?liga=1&rival=${encodeURIComponent(rival.id || rival.email)}`;
  }

  // ── Estado de la temporada (tarjeta del hero) ────────────────────────
  function renderStatus(v) {
    const el = document.getElementById('lgStatus');
    const today = v.today;
    if (v.phase === 'inscripcion') {
      const days = L.daysBetween(today, season.inicio);
      const open = today <= season.cierreInscripcion;
      el.innerHTML = `
        <span class="lg-status-label">${open ? 'Inscripciones abiertas' : 'Inscripción cerrada'}</span>
        <div class="lg-status-big"><strong>${days}</strong><span>${days === 1 ? 'día' : 'días'} para la 1ª fecha</span></div>
        <div class="lg-status-sub">Cierre de inscripción: ${fmtLong(season.cierreInscripcion)} · Inicio: ${fmtLong(season.inicio)}</div>
        <div class="lg-status-sub">${v.entrants.length} ${v.entrants.length === 1 ? 'inscrito' : 'inscritos'} en ${GENDER_LABEL[v.gender]}</div>`;
      return;
    }
    if (v.phase === 'maestros') {
      el.innerHTML = `
        <span class="lg-status-label">Fase regular terminada</span>
        <div class="lg-status-big"><strong>🏆</strong><span>Torneo de Maestros</span></div>
        <div class="lg-status-sub">Clasifican los ${v.maestros} mejores de ${GENDER_LABEL[v.gender]}.</div>`;
      return;
    }
    const round = v.currentRound;
    const daysLeft = round ? L.daysBetween(today, round.window.end) : 0;
    el.innerHTML = `
      <span class="lg-status-label">Fecha ${round ? round.numero : '–'} de ${v.rounds.length} · ${GENDER_LABEL[v.gender]}</span>
      <div class="lg-status-big"><strong>${Math.max(0, daysLeft)}</strong><span>${daysLeft === 0 ? 'último día de la fecha' : `${daysLeft === 1 ? 'día' : 'días'} para cerrar la fecha`}</span></div>
      <div class="lg-status-sub">${round ? `Del ${fmtLong(round.window.start)} al ${fmtLong(round.window.end)}` : ''}</div>
      <div class="lg-meter" aria-label="Avance de la temporada"><span style="width:${v.progress.pct}%"></span></div>
      <div class="lg-status-sub">${v.progress.resueltos} de ${v.progress.total} partidos resueltos · ${v.progress.pct}%</div>`;
  }

  // ── Mi liga ───────────────────────────────────────────────────────────
  function renderMine() {
    const el = document.getElementById('lgMine');
    const today = L.todayIso();
    const enrollmentOpen = today <= season.cierreInscripcion;

    if (!state.session) {
      el.innerHTML = `
        <div class="lg-mine-card lg-mine-cta">
          <div>
            <h2>¿Juegas esta temporada?</h2>
            <p>Ingresa con tu cuenta del club para ${enrollmentOpen ? 'inscribirte y ' : ''}ver tu rival de cada fecha.</p>
          </div>
          <a class="lg-btn" href="ranking.html?volver=liga">Ingresar</a>
        </div>`;
      return;
    }
    const session = state.session;
    const sessionEmail = String(session.email || '').toLowerCase();
    if (PURE_ADMIN_EMAILS.includes(sessionEmail)) { el.innerHTML = ''; return; }
    // Sin ficha de jugador (ej. funcionarios): se inscribe igual y la
    // inscripción le crea una ficha "solo liga". Un correo @uct.cl que el
    // club aún no registró (solo lectura) lo inscribe la comisión.
    if (!state.me && (session.readOnly || session.userType === 'invitado')) {
      el.innerHTML = `
        <div class="lg-mine-card"><p class="lg-muted">Tu correo aún no está registrado en el club. Pídele a la comisión organizadora que te inscriba en la liga.</p></div>`;
      return;
    }
    const me = state.me || { email: sessionEmail, nombre: session.nombre, genero: session.genero || session.gender || '' };
    const enrollment = state.me ? L.getEnrollment(me, season) : null;
    const gender = L.entrantGender(me, enrollment);

    if (!enrollment) {
      // La categoría (damas o varones) sale de la ficha; solo si la ficha no
      // la tiene se le pide elegirla.
      const buttons = gender
        ? `<button class="lg-btn" type="button" data-action="enroll-self" data-rama="${gender}">Inscribirme en ${GENDER_LABEL[gender]}</button>`
        : ['F', 'M'].map(g => `<button class="lg-btn ${g === 'F' ? 'ghost' : ''}" type="button" data-action="enroll-self" data-rama="${g}">Inscribirme en ${GENDER_LABEL[g]}</button>`).join('');
      el.innerHTML = enrollmentOpen ? `
        <div class="lg-mine-card lg-mine-cta lg-enroll">
          <div>
            <span class="lg-eyebrow">Inscripción abierta hasta el ${fmtLong(season.cierreInscripcion)}</span>
            <h2>Súmate al Campeonato de Liga ${esc(season.id)}</h2>
            <p>Participación voluntaria y gratuita, abierta a socios y no socios del club. Hay categoría damas y varones: ${gender ? `según tu ficha, compites en <strong>${GENDER_LABEL[gender]}</strong> y jugarás una vez contra cada inscrito de esa categoría` : 'elige en cuál compites'}.</p>
          </div>
          <div class="lg-inline">${buttons}</div>
        </div>` : `
        <div class="lg-mine-card"><p class="lg-muted">La inscripción cerró el ${fmtLong(season.cierreInscripcion)}. Si quieres sumarte, habla con la comisión organizadora.</p></div>`;
      return;
    }

    const v = view(gender);
    const entrant = L.findEntrant(v, me);
    if (!entrant) { el.innerHTML = ''; return; }
    const row = v.standings.find(r => r.key === entrant.key);
    const fixture = L.getPlayerFixture(v, entrant);
    const next = fixture.find(item => item.partido && !FINAL_STATES.includes(item.partido.state));
    const started = v.phase !== 'inscripcion';

    const head = `
      <div class="lg-mine-head">
        ${avatar(entrant, 'lg')}
        <div>
          <span class="lg-eyebrow">${entrant.retirado ? 'Retirado de la liga' : `Inscrito · N° ${entrant.numero} en el fixture de ${GENDER_LABEL[gender]}`}</span>
          <h2>${esc(entrant.nombre)}</h2>
        </div>
        <div class="lg-mine-stats">
          ${started ? `<div><strong>${row ? `${row.pos}°` : '–'}</strong><span>Lugar</span></div>
          <div><strong>${row ? row.pts : 0}</strong><span>Puntos</span></div>
          <div><strong>${row ? `${row.pg}-${row.pp}` : '0-0'}</strong><span>G-P</span></div>`
          : `<div><strong>${v.rounds.length}</strong><span>Fechas</span></div><div><strong>${v.entrants.length - 1}</strong><span>Rivales</span></div>`}
        </div>
      </div>`;

    let nextHtml = '';
    if (next && !entrant.retirado) {
      const p = next.partido;
      const r = next.round;
      const rival = next.rival;
      const opensIn = L.daysBetween(v.today, r.window.start);
      const closesIn = L.daysBetween(v.today, p.deadline);
      const canSchedule = ['por_agendar', 'proximo'].includes(p.state) && r.window.start <= L.addDays(v.today, 10);
      let detail = '';
      let action = '';
      if (p.state === 'por_agendar' || p.state === 'proximo') {
        detail = p.state === 'proximo' ? `La fecha abre el ${fmtLong(r.window.start)}${opensIn > 0 ? ` (en ${daysLabel(opensIn)})` : ''}.` : `Tienes ${daysLabel(closesIn + 1)} para jugarlo (hasta el ${fmtLong(p.deadline)}).`;
        action = canSchedule
          ? `<a class="lg-btn" href="${scheduleLink(rival)}">Agendar con ${esc(rival.nombre.split(' ')[0])}</a>`
          : `<span class="lg-muted">Podrás agendarlo desde el ${fmtLong(L.addDays(r.window.start, -10))}.</span>`;
      } else if (p.state === 'invitado') {
        const mine = p.invitedBy && p.invitedBy.key === entrant.key;
        detail = `${mine ? `Esperando que ${esc(rival.nombre)} acepte` : `${esc(rival.nombre)} te invitó`} para el ${fmtLong(p.date)}${p.slot ? ` a las ${esc(p.slot)}` : ''}.`;
        action = `<a class="lg-btn ${mine ? 'ghost' : ''}" href="ranking.html">${mine ? 'Ver invitación' : 'Responder invitación'}</a>`;
      } else if (p.state === 'agendado') {
        detail = `Juegan el ${fmtLong(p.date)}${p.slot ? ` a las ${esc(p.slot)}` : ''}${p.cancha ? ` · ${esc(p.cancha)}` : ''}. Al terminar, registra el resultado.`;
        action = `<a class="lg-btn" href="ranking.html">Registrar resultado</a>`;
      } else if (p.state === 'por_confirmar') {
        detail = 'Hay un resultado registrado esperando confirmación (se confirma solo a las 48 horas).';
        action = `<a class="lg-btn ghost" href="ranking.html">Revisar resultado</a>`;
      }
      nextHtml = `
        <div class="lg-next">
          <div class="lg-next-meta">
            <span class="lg-eyebrow">Tu partido · Fecha ${r.numero} · ${esc(fmtRange(r.window))}</span>
            ${chip(p.state)}${p.exception ? '<span class="lg-chip info">Plazo extendido</span>' : ''}
          </div>
          <div class="lg-next-body">
            <div class="lg-versus">
              ${avatar(entrant)}<span class="lg-vs">vs</span>${avatar(rival)}
              <div><strong>${esc(rival.nombre)}</strong><small>${esc(category(rival.categoria) || 'Jugador')} · N° ${rival.numero}</small></div>
            </div>
            <p>${detail}</p>
            ${action}
          </div>
        </div>`;
    } else if (started && !entrant.retirado) {
      nextHtml = `<div class="lg-next"><p class="lg-muted">No te quedan partidos pendientes. ${row && row.maestros ? '¡Vas en zona de Maestros!' : ''}</p></div>`;
    }

    const strip = fixture.length ? `
      <ol class="lg-myfixture" aria-label="Mis fechas">
        ${fixture.map(item => {
          const r = item.round;
          if (item.libre) return `<li class="is-free"><span>F${r.numero}</span><em>Libre</em></li>`;
          if (!item.partido) return '';
          const p = item.partido;
          let result = '';
          let tone = '';
          if (p.state === 'jugado' || p.state === 'wo') {
            const won = p.winner.key === entrant.key;
            tone = won ? 'win' : 'loss';
            result = `${won ? 'G' : 'P'} ${p.state === 'wo' ? 'W.O.' : esc(won ? p.winnerScore : reverseScore(p.winnerScore))}`;
          } else if (p.state === 'wo_doble') { tone = 'void'; result = 'W.O. doble'; }
          else result = STATE_CHIP[p.state][0];
          return `<li class="${tone} ${next && next.round === r ? 'is-next' : ''}"><span>F${r.numero}</span><b>${esc(item.rival.nombre)}</b><em>${result}</em></li>`;
        }).join('')}
      </ol>` : '';

    const leave = v.phase === 'inscripcion' && enrollmentOpen
      ? `<button class="lg-link" type="button" data-action="unenroll-self">Darme de baja</button>` : '';

    el.innerHTML = `<div class="lg-mine-card">${head}${nextHtml}${strip}${leave}</div>`;
  }

  function reverseScore(score) {
    return String(score || '').split(',').map(set => set.trim().split('-').reverse().join('-')).join(', ');
  }

  // ── Posiciones ────────────────────────────────────────────────────────
  function formChips(forma) {
    const labels = { G: ['G', 'win', 'Ganó'], P: ['P', 'loss', 'Perdió'], WG: ['W', 'win', 'Ganó por W.O.'], WP: ['W', 'loss', 'Perdió por W.O.'], WD: ['–', 'void', 'W.O. doble'] };
    return `<span class="lg-form">${forma.map(item => {
      const [text, tone, title] = labels[item.r] || ['?', 'void', ''];
      return `<i class="${tone}" title="Fecha ${item.fecha}: ${title}">${text}</i>`;
    }).join('') || '<em>—</em>'}</span>`;
  }

  function renderStandings(v) {
    if (!v.entrants.length) return emptyCategory(v);
    const meKey = state.me ? (L.findEntrant(v, state.me) || {}).key : '';
    const pre = v.phase === 'inscripcion'
      ? `<div class="lg-note">La tabla empieza a moverse el ${fmtLong(season.inicio)}. Por ahora todos parten en cero.</div>` : '';
    const rows = v.standings.map((row, index) => {
      const cut = index === v.maestros - 1 && v.standings.length > v.maestros
        ? `<tr class="lg-cut"><td colspan="10"><span>Clasifican al Torneo de Maestros ↑</span></td></tr>` : '';
      return `
        <tr class="${row.maestros ? 'is-masters' : ''} ${row.key === meKey ? 'is-me' : ''} ${row.retirado ? 'is-out' : ''}">
          <td class="lg-pos">${row.pos}</td>
          <td><span class="lg-player">${avatar(row, 'sm')}<span><strong>${esc(row.nombre)}</strong><small>${esc(category(row.categoria) || 'Jugador')}${row.retirado ? ' · Retirado' : ''}${row.desempate ? ` · ${esc(row.desempate)}` : ''}</small></span></span></td>
          <td class="lg-pts">${row.pts}</td>
          <td>${row.pj}</td>
          <td>${row.pg}</td>
          <td>${row.pp}</td>
          <td class="lg-hide-sm">${row.setsFor}-${row.setsAgainst}</td>
          <td class="lg-hide-sm">${row.diffGames > 0 ? '+' : ''}${row.diffGames}</td>
          <td class="lg-hide-sm">${row.woPerdidos + row.woDobles || ''}</td>
          <td class="lg-hide-xs">${formChips(row.forma)}</td>
        </tr>${cut}`;
    }).join('');
    return `
      ${pre}
      <div class="lg-table-wrap">
        <table class="lg-table">
          <thead><tr>
            <th>#</th><th>Jugador</th><th title="Puntos">Pts</th><th title="Partidos jugados">PJ</th><th title="Ganados">PG</th><th title="Perdidos">PP</th>
            <th class="lg-hide-sm" title="Sets a favor y en contra">Sets</th><th class="lg-hide-sm" title="Diferencia de games">±G</th><th class="lg-hide-sm" title="W.O. en contra (simples y dobles)">WO</th><th class="lg-hide-xs">Últimos</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="lg-legend">Desempate: puntos → enfrentamiento directo (si empatan dos) → partidos ganados → diferencia de sets → diferencia de games. Clasifican ${v.maestros} al Torneo de Maestros.</p>`;
  }

  // ── Fixture ───────────────────────────────────────────────────────────
  function renderFixture(v) {
    if (v.entrants.length < 2) return emptyCategory(v);
    if (!state.round || state.round > v.rounds.length) state.round = v.currentRound ? v.currentRound.numero : 1;
    const strip = v.rounds.map(r => {
      const status = r.done ? 'done' : r.open ? 'open' : r.closed ? 'closed' : 'next';
      return `<button type="button" class="lg-round ${status} ${r.numero === state.round ? 'active' : ''}" data-round="${r.numero}">
        <strong>Fecha ${r.numero}</strong><small>${esc(fmtRange(r.window))}</small></button>`;
    }).join('');
    const round = v.rounds[state.round - 1];
    const days = L.daysBetween(v.today, round.window.end);
    const statusLine = round.open ? `En curso · ${days === 0 ? 'último día' : `quedan ${daysLabel(days)}`}`
      : round.closed ? 'Fecha cerrada' : `Abre el ${fmtLong(round.window.start)}`;
    const played = round.partidos.filter(p => FINAL_STATES.includes(p.state)).length;
    const meKey = state.me ? (L.findEntrant(v, state.me) || {}).key : '';

    const cards = round.partidos.map(p => {
      const final = p.state === 'jugado' || p.state === 'wo';
      const sideHtml = (entrant, isWinner) => {
        const sets = p.state === 'jugado' ? (p.setsBy[entrant.key] || []) : [];
        return `<div class="lg-side ${final ? (isWinner ? 'won' : 'lost') : ''} ${entrant.key === meKey ? 'is-me' : ''}">
          ${avatar(entrant, 'sm')}<span class="lg-side-name">${esc(entrant.nombre)}${isWinner && final ? ' <i aria-label="ganador">✓</i>' : ''}</span>
          <span class="lg-sets">${p.state === 'wo' ? (isWinner ? '<b>W.O.</b>' : '') : sets.map(n => `<b>${n}</b>`).join('')}</span>
        </div>`;
      };
      let foot = '';
      if (p.state === 'agendado' || p.state === 'invitado') foot = `📅 ${fmt(p.date)}${p.slot ? ` · ${esc(p.slot)}` : ''}${p.cancha ? ` · ${esc(p.cancha)}` : ''}`;
      if (p.state === 'wo_doble') foot = p.fueraDePlazo ? 'Se jugó fuera de plazo: no suma (bases §9)' : p.retiro ? 'Ambos retirados' : 'No se jugó dentro del plazo: 0 pts para ambos';
      if (p.state === 'wo' && p.retiro) foot = 'Rival retirado de la liga';
      if (p.exception) foot = `${foot ? `${foot} · ` : ''}Plazo extendido al ${fmt(p.deadline)}`;
      return `
        <article class="lg-match ${p.state}">
          <header>${chip(p.state)}${p.date && final ? `<small>${fmt(p.date)}</small>` : ''}</header>
          ${sideHtml(p.a, final && p.winner.key === p.a.key)}
          ${sideHtml(p.b, final && p.winner.key === p.b.key)}
          ${foot ? `<footer>${foot}</footer>` : ''}
        </article>`;
    }).join('');

    return `
      <div class="lg-rounds" role="tablist" aria-label="Fechas">${strip}</div>
      <div class="lg-round-head">
        <div><h3>Fecha ${round.numero}</h3><span>${esc(fmtLong(round.window.start))} al ${esc(fmtLong(round.window.end))} · ${statusLine}</span></div>
        <span class="lg-round-count">${played}/${round.partidos.length} resueltos</span>
      </div>
      <div class="lg-matches">${cards}</div>
      ${round.libre ? `<p class="lg-bye">Libre esta fecha: <strong>${esc(round.libre.nombre)}</strong></p>` : ''}`;
  }

  // ── Inscritos ─────────────────────────────────────────────────────────
  function renderEntrants(v) {
    if (!v.entrants.length) return emptyCategory(v);
    const note = v.drawDone
      ? 'Los números del fixture fueron sorteados por la comisión organizadora.'
      : v.phase === 'inscripcion'
        ? 'El número de cada jugador sigue el orden de inscripción; la comisión puede sortearlos al cerrar la inscripción.'
        : 'Números según el orden de inscripción.';
    return `
      <div class="lg-summary">
        <div><strong>${v.entrants.filter(e => !e.retirado).length}</strong><span>Inscritos</span></div>
        <div><strong>${v.rounds.length}</strong><span>Fechas</span></div>
        <div><strong>${v.maestros}</strong><span>Al Maestros</span></div>
        <div><strong>${v.rounds.length ? esc(fmt(v.rounds[v.rounds.length - 1].window.end, { day: 'numeric', month: 'short', year: 'numeric' })) : '–'}</strong><span>Última fecha</span></div>
      </div>
      <ul class="lg-entrants">
        ${v.entrants.map(e => `<li class="${e.retirado ? 'is-out' : ''}"><span class="lg-num">${e.numero}</span>${avatar(e)}<span><strong>${esc(e.nombre)}</strong><small>${esc(category(e.categoria) || 'Jugador')}${e.retirado ? ' · Retirado' : ''}</small></span></li>`).join('')}
      </ul>
      <p class="lg-legend">${note}${v.rounds.length > season.ventanas.length ? ` Con ${v.entrants.length} inscritos hacen falta ${v.rounds.length} fechas: las que exceden el calendario oficial siguen el mismo patrón de 10 días.` : ''}</p>`;
  }

  function emptyCategory(v) {
    const open = L.todayIso() <= season.cierreInscripcion;
    return `<p class="lg-empty">${v.entrants.length === 1 ? 'Hay un solo inscrito' : 'Aún no hay inscritos'} en ${GENDER_LABEL[v.gender]}.${open ? ' ¡La inscripción está abierta!' : ''}</p>`;
  }

  // ── Bases ─────────────────────────────────────────────────────────────
  function renderRules(v) {
    const p = season.puntos;
    const windows = Array.from({ length: Math.max(season.ventanas.length, v.rounds.length) }, (_, i) => L.getRoundWindow(season, i + 1));
    return `
      <div class="lg-flow" aria-label="Cómo se juega una fecha">
        ${['Revisa tu rival de la fecha', 'Agenda día, hora y cancha', 'Tu rival acepta', 'Jueguen dentro de los 10 días', 'Registra el resultado', 'Tu rival lo confirma y suman los puntos']
          .map((step, i) => `<div><b>${i + 1}</b><span>${step}</span></div>`).join('')}
      </div>
      <div class="lg-rules">
        <article><h4>Puntaje</h4>
          <div class="lg-points"><div><strong>${p.victoria}</strong><span>Ganador</span></div><div><strong>${p.derrota}</strong><span>Perdedor</span></div><div><strong>${p.noPresentacion}</strong><span>No presentación</span></div></div>
          <p>Fecha a fecha los puntos se acumulan y definen el ranking de la liga.</p></article>
        <article><h4>Quién juega</h4><p>Todos los integrantes de UCTenis con sus cuotas al día. Participación voluntaria y gratuita, en categoría damas y varones.</p></article>
        <article><h4>Sistema</h4><p>Todos contra todos por fechas: en cada fecha juegas con un rival distinto hasta completar todos los cruces. Si los inscritos son impares, en cada fecha alguien queda libre.</p></article>
        <article><h4>Plazos</h4><p>Cada partido es obligatorio y se juega dentro de los 10 días de su fecha. La fecha vence y no se recupera en forma retroactiva.</p></article>
        <article><h4>W.O.</h4><p>Si no se juega dentro del plazo, es W.O. para ambos y nadie suma. Si uno no se presenta, gana el jugador presente.</p></article>
        <article><h4>Casos especiales</h4><p>Licencias médicas justificadas o fuerza mayor se presentan a la comisión organizadora, que puede extender el plazo de ese partido.</p></article>
        <article><h4>Formato</h4><p>${esc(season.formato)}. Cada jugador lleva pelotas en buen estado y se juega con las mejores, de común acuerdo.</p></article>
        <article><h4>Torneo de Maestros</h4><p>Al cerrar la liga clasifican los 4, 6 u 8 mejores según inscritos (menos de 8 → 4; 8 a 11 → 6; 12 o más → 8) y se premian los puestos finales.</p></article>
      </div>
      <h4 class="lg-sub">Calendario de fechas</h4>
      <ol class="lg-calendar">${windows.map((w, i) => `<li class="${v.today >= w.start && v.today <= w.end ? 'is-open' : v.today > w.end ? 'is-past' : ''}"><b>${i + 1}ª</b><span>${esc(fmtLong(w.start))} al ${esc(fmt(w.end, { day: 'numeric', month: 'long', year: 'numeric' }))}</span>${i >= season.ventanas.length ? '<em>adicional</em>' : ''}</li>`).join('')}</ol>`;
  }

  // ── Comisión organizadora (admin) ─────────────────────────────────────
  function renderAdmin(v) {
    const el = document.getElementById('lgAdmin');
    el.hidden = !state.isAdmin;
    if (!state.isAdmin) return;
    const phase = v.phase;
    const enrolledKeys = new Set(v.entrants.map(e => e.key));
    const playerEmails = new Set(state.players.map(p => String(p.email || '').toLowerCase()));
    const candidates = [
      ...state.players
        .filter(isLeagueEligible)
        .filter(p => [v.gender, ''].includes(L.normalizeGender(p.genero || p.gender)) && !L.getEnrollment(p, season) && !enrolledKeys.has(L.playerKey(p)))
        .map(p => ({ value: `p:${p.id}`, nombre: p.nombre, detail: p.activo === false ? (p.soloLiga ? 'solo liga' : 'fuera de la escalerilla') : category(p.categoria) })),
      ...state.staff
        .filter(f => f.activo !== false && [v.gender, ''].includes(L.normalizeGender(f.genero || f.gender)) && !playerEmails.has(String(f.email || '').toLowerCase()))
        .map(f => ({ value: `s:${String(f.email || '').toLowerCase()}`, nombre: f.nombre, detail: 'funcionario' }))
    ].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    const expired = v.rounds.flatMap(r => r.partidos.map(p => ({ r, p })))
      .filter(({ p }) => (p.state === 'wo_doble' && !p.retiro) || p.exception);

    el.innerHTML = `
      <div class="lg-admin-head"><h2>Comisión organizadora · ${GENDER_LABEL[v.gender]}</h2><span class="lg-chip muted">Solo administradores</span></div>
      <div class="lg-admin-grid">
        <article>
          <h4>Inscribir jugador</h4>
          <div class="lg-inline">
            <select id="lgAdminCandidate"><option value="">${candidates.length ? 'Elige un jugador…' : 'Todos los activos ya están inscritos'}</option>${candidates.map(c => `<option value="${esc(c.value)}">${esc(c.nombre)}${c.detail ? ` · ${esc(c.detail)}` : ''}</option>`).join('')}</select>
            <button class="lg-btn sm" type="button" data-action="admin-enroll">Inscribir</button>
          </div>
          ${phase !== 'inscripcion' ? '<p class="lg-warn">La liga ya partió: inscribir a alguien ahora cambia todos los cruces del fixture.</p>' : ''}
        </article>
        <article>
          <h4>Sorteo del fixture</h4>
          <p class="lg-muted">${v.drawDone ? 'Números ya sorteados.' : 'Hoy los números siguen el orden de inscripción.'} Las bases asignan un número a cada inscrito al cerrar la inscripción.</p>
          <button class="lg-btn sm ghost" type="button" data-action="admin-draw" ${v.entrants.length < 2 ? 'disabled' : ''}>${v.drawDone ? 'Volver a sortear' : 'Sortear números'}</button>
          ${phase !== 'inscripcion' ? '<p class="lg-warn">Sortear con la liga en curso reordena los cruces de fechas ya jugadas.</p>' : ''}
        </article>
      </div>
      <h4 class="lg-sub">Inscritos (${v.entrants.length})</h4>
      <ul class="lg-admin-list">${v.entrants.map(e => `
        <li><span class="lg-num">${e.numero}</span><span>${esc(e.nombre)}${e.retirado ? ` <em>· retirado ${e.retiradoEn ? esc(fmt(e.retiradoEn)) : ''}</em>` : ''}</span>
          ${phase === 'inscripcion'
            ? `<button class="lg-link" type="button" data-action="admin-unenroll" data-id="${esc(e.id)}">Quitar</button>`
            : e.retirado
              ? `<button class="lg-link" type="button" data-action="admin-rejoin" data-id="${esc(e.id)}">Reincorporar</button>`
              : `<button class="lg-link danger" type="button" data-action="admin-withdraw" data-id="${esc(e.id)}">Retirar</button>`}
        </li>`).join('') || '<li class="lg-muted">Sin inscritos.</li>'}</ul>
      <h4 class="lg-sub">Plazos vencidos y excepciones (bases §9)</h4>
      ${expired.length ? `<ul class="lg-admin-list">${expired.map(({ r, p }) => `
        <li><span class="lg-num">F${r.numero}</span><span>${esc(p.a.nombre)} vs ${esc(p.b.nombre)} ${p.exception ? `<em>· plazo hasta ${esc(fmt(p.deadline))}</em>` : p.fueraDePlazo ? '<em>· resultado fuera de plazo</em>' : ''}</span>
          <span class="lg-inline"><input type="date" value="${esc(p.exception || L.addDays(L.todayIso(), 7))}" data-exception-date="${esc(p.a.id)}|${esc(p.b.id)}" aria-label="Nuevo plazo">
          <button class="lg-link" type="button" data-action="admin-exception" data-a="${esc(p.a.id)}" data-b="${esc(p.b.id)}">${p.exception ? 'Cambiar plazo' : 'Extender plazo'}</button></span>
        </li>`).join('')}</ul>` : '<p class="lg-muted">No hay partidos vencidos sin jugar.</p>'}
      <p class="lg-legend">Los resultados, W.O. y correcciones de marcador se registran como cualquier partido desde el panel del Ranking.</p>`;
  }

  // ── Pintado general ───────────────────────────────────────────────────
  function render() {
    if (!state.loaded) return;
    const v = view();
    if (!state.tab) state.tab = v.phase === 'inscripcion' ? 'inscritos' : 'posiciones';
    document.querySelectorAll('.lg-tabs button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === state.tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === state.tab));
    });
    document.querySelectorAll('.lg-segment button').forEach(b => {
      b.classList.toggle('active', b.dataset.gender === state.gender);
      b.setAttribute('aria-selected', String(b.dataset.gender === state.gender));
    });
    renderStatus(v);
    renderMine();
    const panel = document.getElementById('lgView');
    panel.innerHTML = state.tab === 'fixture' ? renderFixture(v)
      : state.tab === 'inscritos' ? renderEntrants(v)
        : state.tab === 'bases' ? renderRules(v)
          : renderStandings(v);
    renderAdmin(v);
    renderLegacy();
  }

  function renderLegacy() {
    const box = document.getElementById('lgLegacy');
    const cycle = L.getCycle('2026-09-21');
    if (L.todayIso() > L.addDays(cycle.end, 21)) { box.hidden = true; return; }
    const rows = L.calculateStandings(state.players.filter(isLeagueEligible), state.matches.filter(m => !m.ligaTemporada), cycle)
      .filter(row => L.normalizeGender(row.genero) === state.gender && row.pj > 0);
    box.hidden = !rows.length;
    document.getElementById('lgLegacyTable').innerHTML = `<table class="lg-table compact"><thead><tr><th>#</th><th>Jugador</th><th>Pts</th><th>PJ</th><th>PG</th></tr></thead><tbody>${rows.map((row, i) => `<tr><td class="lg-pos">${i + 1}</td><td>${esc(row.nombre)}</td><td class="lg-pts">${row.pts}</td><td>${row.pj}</td><td>${row.pg}</td></tr>`).join('')}</tbody></table>`;
  }

  // ── Acciones ──────────────────────────────────────────────────────────
  function actor() { return { email: state.session ? state.session.email : '' }; }

  async function saveEnrollment(playerId, patch, okMessage) {
    if (state.busy) return;
    state.busy = true;
    try {
      await DB.saveLeagueEnrollmentCloud(playerId, season.field, patch, actor());
      const player = state.players.find(p => p.id === playerId);
      if (player) player[season.field] = { ...(player[season.field] || {}), ...patch };
      toast(okMessage);
    } catch (err) {
      console.error('No se pudo guardar la inscripción de liga:', err);
      toast(/permission/i.test(String(err && err.message)) ? 'No tienes permiso para hacer este cambio.' : 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.', 'bad');
    } finally {
      state.busy = false;
      render();
    }
  }

  function playerById(id) { return state.players.find(p => p.id === id); }

  // Inscribe a alguien sin ficha de jugador creándole una ficha "solo liga".
  async function createLeagueOnlyPlayer(person, enrollment, okMessage) {
    if (state.busy) return;
    state.busy = true;
    try {
      const saved = await DB.createLeagueOnlyPlayerCloud(person, season.field, enrollment, actor());
      const email = String(person.email || '').toLowerCase();
      const existing = state.players.find(p => String(p.email || '').toLowerCase() === email);
      if (existing) existing[season.field] = { ...(existing[season.field] || {}), ...enrollment };
      else if (saved && saved.id) state.players.push(saved);
      state.me = findMe();
      toast(okMessage);
    } catch (err) {
      console.error('No se pudo crear la ficha de liga:', err);
      toast(/permission/i.test(String(err && err.message)) ? 'No tienes permiso para hacer este cambio.' : 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.', 'bad');
    } finally {
      state.busy = false;
      render();
    }
  }

  async function onAction(button) {
    const action = button.dataset.action;
    const now = new Date().toISOString();
    if (action === 'enroll-self' && state.session) {
      if (!confirm(`¿Confirmas tu inscripción al ${season.nombre}? Te comprometes a jugar cada fecha dentro de su plazo.`)) return;
      const rama = button.dataset.rama;
      if (rama) state.gender = rama;
      const enrollment = { inscrito: true, retirado: false, inscritoEn: now, rama };
      const message = `¡Listo! Quedaste inscrito en ${GENDER_LABEL[rama] || 'la liga'}.`;
      if (state.me) return saveEnrollment(state.me.id, enrollment, message);
      const s = state.session;
      return createLeagueOnlyPlayer({ nombre: s.nombre, email: s.email, genero: rama, foto: s.foto, userType: s.userType === 'funcionario' ? 'funcionario' : 'liga' }, enrollment, message);
    }
    if (action === 'unenroll-self' && state.me) {
      if (!confirm('¿Darte de baja de la liga? Puedes volver a inscribirte mientras la inscripción siga abierta.')) return;
      return saveEnrollment(state.me.id, { inscrito: false, numero: null }, 'Te diste de baja de la liga.');
    }
    if (!state.isAdmin) return;
    if (action === 'admin-enroll') {
      const value = document.getElementById('lgAdminCandidate').value;
      const enrollment = { inscrito: true, retirado: false, inscritoEn: now, inscritoPor: actor().email, rama: state.gender };
      if (value.startsWith('s:')) {
        const staff = state.staff.find(f => String(f.email || '').toLowerCase() === value.slice(2));
        if (!staff) return toast('Elige un jugador.', 'bad');
        return createLeagueOnlyPlayer({ nombre: staff.nombre, email: staff.email, genero: state.gender, foto: staff.foto, userType: 'funcionario' }, enrollment, `${staff.nombre} quedó inscrito en ${GENDER_LABEL[state.gender]}.`);
      }
      const player = playerById(value.slice(2));
      if (!player) return toast('Elige un jugador.', 'bad');
      return saveEnrollment(player.id, enrollment, `${player.nombre} quedó inscrito en ${GENDER_LABEL[state.gender]}.`);
    }
    if (action === 'admin-unenroll') {
      const player = playerById(button.dataset.id);
      if (!player || !confirm(`¿Quitar a ${player.nombre} de la liga?`)) return;
      return saveEnrollment(player.id, { inscrito: false, numero: null }, `${player.nombre} salió de la liga.`);
    }
    if (action === 'admin-withdraw') {
      const player = playerById(button.dataset.id);
      if (!player || !confirm(`¿Retirar a ${player.nombre}? Conserva su número; sus partidos pendientes pasan a W.O. a favor del rival.`)) return;
      return saveEnrollment(player.id, { retirado: true, retiradoEn: L.todayIso() }, `${player.nombre} fue retirado de la liga.`);
    }
    if (action === 'admin-rejoin') {
      const player = playerById(button.dataset.id);
      if (!player) return;
      return saveEnrollment(player.id, { inscrito: true, retirado: false, retiradoEn: '' }, `${player.nombre} vuelve a la liga.`);
    }
    if (action === 'admin-exception') {
      const a = playerById(button.dataset.a);
      const b = playerById(button.dataset.b);
      const input = document.querySelector(`[data-exception-date="${CSS.escape(`${button.dataset.a}|${button.dataset.b}`)}"]`);
      const date = input && input.value;
      if (!a || !b || !date) return toast('Indica la nueva fecha límite.', 'bad');
      if (!confirm(`¿Extender el plazo de ${a.nombre} vs ${b.nombre} hasta el ${fmtLong(date)}?`)) return;
      const enrollment = L.getEnrollment(a, season) || {};
      const excepciones = { ...(enrollment.excepciones || {}), [L.pairKey(a, b)]: date };
      return saveEnrollment(a.id, { excepciones }, 'Plazo extendido.');
    }
    if (action === 'admin-draw') {
      const v = view();
      const msg = v.phase === 'inscripcion'
        ? `¿Sortear los números del fixture de ${GENDER_LABEL[v.gender]} (${v.entrants.length} inscritos)?`
        : 'La liga ya partió. Sortear de nuevo cambia los cruces, incluidas fechas ya jugadas. ¿Continuar igual?';
      if (!confirm(msg)) return;
      const order = v.entrants.map(e => e.id);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      state.busy = true;
      try {
        await Promise.all(order.map((id, index) => DB.saveLeagueEnrollmentCloud(id, season.field, { numero: index + 1 }, actor())
          .then(() => { const p = playerById(id); if (p) p[season.field] = { ...(p[season.field] || {}), numero: index + 1 }; })));
        toast('Números sorteados. El fixture ya está actualizado.');
      } catch (err) {
        console.error('Sorteo incompleto:', err);
        toast('El sorteo quedó incompleto; vuelve a intentarlo.', 'bad');
      } finally {
        state.busy = false;
        render();
      }
    }
  }

  // ── Arranque ──────────────────────────────────────────────────────────
  function bindUi() {
    document.querySelector('.lg-segment').addEventListener('click', event => {
      const button = event.target.closest('button[data-gender]');
      if (!button) return;
      state.gender = button.dataset.gender;
      state.round = null;
      render();
    });
    document.querySelector('.lg-tabs').addEventListener('click', event => {
      const button = event.target.closest('button[data-tab]');
      if (!button) return;
      state.tab = button.dataset.tab;
      try { localStorage.setItem('uctenis_liga_tab', state.tab); } catch (e) {}
      render();
    });
    document.addEventListener('click', event => {
      const round = event.target.closest('.lg-round');
      if (round) { state.round = Number(round.dataset.round); render(); return; }
      const action = event.target.closest('[data-action]');
      if (action && action.closest('.lg-page')) onAction(action);
    });
  }

  async function load() {
    DB.seed();
    state.session = DB.getSession();
    const email = String(state.session?.email || '').toLowerCase();
    state.isAdmin = Boolean(state.session && (state.session.isAdmin === true || ADMIN_EMAILS.includes(email)));
    const [players, matches] = await Promise.allSettled([
      DB.isCloudConfigured() ? DB.getPlayersCloud() : Promise.resolve(DB.getUsers()),
      DB.isCloudConfigured() ? DB.getChallengesCloud() : Promise.resolve(DB.getChallenges())
    ]);
    state.players = players.status === 'fulfilled' ? players.value : DB.getUsers();
    state.matches = matches.status === 'fulfilled' ? matches.value : DB.getChallenges();
    if (state.isAdmin && DB.isCloudConfigured()) {
      try { state.staff = await DB.getStaffCloud(); } catch (err) { console.warn('No se pudo leer la lista de funcionarios:', err); }
    }
    state.me = findMe();
    const myGender = state.me ? L.entrantGender(state.me, L.getEnrollment(state.me, season)) : '';
    if (myGender) state.gender = myGender;
    state.loaded = true;
    render();

    // Tabla y fixture en vivo: cualquier resultado o inscripción se refleja
    // sin recargar.
    if (DB.isCloudConfigured()) {
      DB.addEventListener('players-updated', () => {
        state.players = DB.getCachedPlayersSnapshot() || state.players;
        state.me = findMe();
        if (!state.busy) render();
      });
      DB.addEventListener('challenges-updated', () => {
        state.matches = DB.getChallenges();
        if (!state.busy) render();
      });
      DB.initPlayersListener();
      DB.initChallengesListener();
    }
  }

  // liga.html#fixture abre directo esa sección; si no, la última visitada.
  const TABS = ['posiciones', 'fixture', 'inscritos', 'bases'];
  const hashTab = location.hash.slice(1);
  if (TABS.includes(hashTab)) state.tab = hashTab;
  else {
    try {
      const saved = localStorage.getItem('uctenis_liga_tab');
      if (TABS.includes(saved)) state.tab = saved;
    } catch (e) {}
  }
  bindUi();
  load().catch(err => {
    console.error('No se pudo cargar la liga:', err);
    document.getElementById('lgView').innerHTML = '<p class="lg-empty">No se pudo cargar la liga. Revisa tu conexión y recarga la página.</p>';
  });
})();
