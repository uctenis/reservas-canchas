/* UCTenis · Página del Campeonato de Liga (liga.html).
 * El cálculo (fixture, puntajes, plazos) vive en liga.js; aquí solo se pinta
 * y se manejan la inscripción y las acciones de la comisión organizadora. */
(function () {
  'use strict';

  const L = window.UCTennisLeague;
  const season = L.getSeason();
  // Admins del sitio y la comisión organizadora de la liga (en el backend:
  // CONFIG.LEAGUE_ADMIN_EMAILS).
  const ADMIN_EMAILS = ['uctenisclub@gmail.com', 'dsilva@uct.cl', 'profesorbermudez@gmail.com'];
  const PURE_ADMIN_EMAILS = ['uctenisclub@gmail.com'];
  const FINAL_STATES = ['jugado', 'wo', 'wo_doble'];
  const GENDER_LABEL = { M: 'Varones', F: 'Damas' };

  const state = {
    gender: 'M',
    tab: '',
    round: null,
    players: [],
    matches: [],
    session: null,
    me: null,
    isAdmin: false,
    loaded: false,
    busy: false,
    // Cantidad y reparto de grupos elegidos en el panel, por categoría.
    groupDraft: {},
    // Propuestas de horario pendientes en las que participo.
    proposals: [],
    // Anima la aparición de los grupos recién armados.
    revealGroups: false
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
    toast.timer = setTimeout(() => { el.className = 'lg-toast'; }, kind === 'bad' ? 9000 : 4200);
  }

  // La liga es para cualquier socio activo; la cuenta administradora no juega.
  // participaRanking es un flag de la escalerilla (los socios nuevos parten en
  // false hasta que el admin los suma), por eso NO condiciona la liga.
  function isLeagueEligible(player) {
    const email = String(player?.email || '').trim().toLowerCase();
    const activo = player && player.activo !== false && player.activo !== 'false';
    return Boolean(activo) && !PURE_ADMIN_EMAILS.includes(email);
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
    const me = state.me;
    if (!me && !state.isAdmin) {
      // Pasa cuando se entra con una cuenta de Google distinta a la de la
      // ficha (p. ej. un Gmail personal): se muestra con cuál entró.
      el.innerHTML = `
        <div class="lg-mine-card lg-mine-cta">
          <div>
            <h2>No encontramos tu ficha</h2>
            <p>Entraste con <strong>${esc(state.session.email || 'una cuenta sin correo')}</strong>, que no corresponde a ningún socio del club. Cierra sesión y vuelve a ingresar eligiendo la cuenta de Google del correo con que te inscribiste en el club (normalmente tu correo @uct.cl).</p>
          </div>
          <button class="lg-btn" type="button" data-action="switch-account">Cambiar de cuenta</button>
        </div>`;
      return;
    }
    if (!me || !isLeagueEligible(me)) {
      el.innerHTML = state.isAdmin ? '' : `
        <div class="lg-mine-card"><p class="lg-muted">El Campeonato de Liga es para jugadores activos del club. Si crees que tu ficha debería estar activa, escríbele a la comisión.</p></div>`;
      return;
    }
    const enrollment = L.getEnrollment(me, season);
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
            <p>Participación voluntaria y gratuita para jugadores activos con sus cuotas al día. Hay categoría damas y varones: ${gender ? `según tu ficha, compites en <strong>${GENDER_LABEL[gender]}</strong> y jugarás una vez contra cada inscrito de esa categoría` : 'elige en cuál compites'}.</p>
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
    const group = L.groupOf(v, entrant);
    const fixture = L.getPlayerFixture(v, entrant);
    const next = fixture.find(item => item.partido && !FINAL_STATES.includes(item.partido.state));
    const started = v.phase !== 'inscripcion';

    const head = `
      <div class="lg-mine-head">
        ${avatar(entrant, 'lg')}
        <div>
          <span class="lg-eyebrow">${entrant.retirado ? 'Retirado de la liga'
            : v.grouped && !group ? `Inscrito en ${GENDER_LABEL[gender]} · grupo por asignar`
              : `Inscrito · ${v.grouped ? `${groupName(group.numero)} · ` : ''}N° ${entrant.numero} en el fixture de ${GENDER_LABEL[gender]}`}</span>
          <h2>${esc(entrant.nombre)}</h2>
        </div>
        <div class="lg-mine-stats">
          ${started ? `<div><strong>${row ? `${row.pos}°` : '–'}</strong><span>Lugar</span></div>
          <div><strong>${row ? row.pts : 0}</strong><span>Puntos</span></div>
          <div><strong>${row ? `${row.pg}-${row.pp}` : '0-0'}</strong><span>G-P</span></div>`
          : group ? `<div><strong>${group.rounds.length}</strong><span>Fechas</span></div><div><strong>${group.entrants.length - 1}</strong><span>Rivales</span></div>` : ''}
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
        const sentToRival = state.proposals.some(pr => pr.fromEmail === myEmail() && pr.toEmail === rival.email);
        action = canSchedule
          ? `<div class="lg-inline lg-next-actions">
              <button class="lg-btn" type="button" data-action="propose" data-rival="${esc(rival.key)}">${sentToRival ? 'Cambiar mi propuesta' : '📅 Proponer horarios'}</button>
              <a class="lg-btn ghost" href="${scheduleLink(rival)}">Reservar directo</a>
            </div>
            <p class="lg-hint">Propón hasta 3 horarios con cancha libre y ${esc(rival.nombre.split(' ')[0])} elige uno con un clic desde su correo.</p>`
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
            ${whatsAppButton(rival, r)}
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

    el.innerHTML = `<div class="lg-mine-card">${head}${proposalsHtml()}${nextHtml}${strip}${leave}</div>`;
  }

  // ── Propuestas de horario ─────────────────────────────────────────────
  function myEmail() { return String(state.session?.email || '').trim().toLowerCase(); }

  function courtName(courtId) {
    const court = (DB.COURTS || []).find(c => c.id === courtId);
    return court ? court.label.replace(/\s*–\s*/, ' · ') : String(courtId || '').toUpperCase();
  }

  function optionParts(option) {
    const date = new Date(`${option.date}T00:00:00Z`);
    const day = date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/[.,]/g, '');
    return { day: day.charAt(0).toUpperCase() + day.slice(1), slot: option.slot, court: courtName(option.courtId) };
  }
  function optionLabel(option) { const o = optionParts(option); return `${o.day} · ${o.slot} · ${o.court}`; }

  // WhatsApp a teléfonos chilenos guardados como 9XXXXXXXX, +56 9…, etc.
  function waUrl(phone, message) {
    let digits = String(phone || '').replace(/[^0-9]/g, '');
    if (digits.length === 8) digits = `569${digits}`;
    else if (digits.length === 9 && digits[0] === '9') digits = `56${digits}`;
    return digits.length >= 10 ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : '';
  }

  function whatsAppButton(rival, round) {
    const phone = rival.player && rival.player.telefono;
    const url = waUrl(phone, `Hola ${rival.nombre.split(' ')[0]}, nos toca la Fecha ${round.numero} de la liga UCTenis 🎾 ¿Qué días te acomodan?`);
    return url ? `<a class="lg-wa" href="${esc(url)}" target="_blank" rel="noopener"><span aria-hidden="true">💬</span> WhatsApp de ${esc(rival.nombre.split(' ')[0])} · ${esc(phone)}</a>` : '';
  }

  // Propuestas pendientes en las que participo: recibidas (para elegir) y
  // enviadas (esperando respuesta).
  function proposalsHtml() {
    const me = myEmail();
    if (!state.proposals.length || !me) return '';
    return state.proposals.map(pr => {
      const received = pr.toEmail === me;
      const other = received ? pr.fromNombre : pr.toNombre;
      const options = (pr.options || []).map((o, i) => {
        const parts = optionParts(o);
        const inner = `<span>${esc(parts.day)}</span><b>${esc(parts.slot)}</b><small>${esc(parts.court)}</small>`;
        return received
          ? `<button type="button" class="lg-option" data-action="accept-proposal" data-id="${esc(pr.id)}" data-opcion="${i + 1}">${inner}</button>`
          : `<div class="lg-option is-static">${inner}</div>`;
      }).join('');
      return `
        <div class="lg-proposal ${received ? 'is-received' : 'is-sent'}">
          <div class="lg-proposal-head">
            <span class="lg-eyebrow">${received ? `${esc(other)} te propone horarios` : `Le propusiste horarios a ${esc(other)}`}${pr.fecha ? ` · Fecha ${pr.fecha}` : ''}</span>
            <span class="lg-chip ${received ? 'warn' : 'info'}">${received ? 'Elige uno' : 'Esperando respuesta'}</span>
          </div>
          ${pr.nota ? `<p class="lg-proposal-note">“${esc(pr.nota)}”</p>` : ''}
          <div class="lg-options">${options}</div>
          ${received
            ? `<p class="lg-hint">Al elegir se reserva la cancha y el partido queda confirmado para los dos.</p>
               <button class="lg-link" type="button" data-action="counter-proposal" data-id="${esc(pr.id)}">Ninguna me sirve · proponer otros horarios</button>`
            : `<button class="lg-link" type="button" data-action="propose" data-rival-email="${esc(pr.toEmail)}">Cambiar propuesta</button>`}
        </div>`;
    }).join('');
  }

  async function api(action, payload) {
    if (!window.CONFIG || !window.CONFIG.API_URL) throw new Error('No hay conexión con el servidor del club.');
    const idToken = await DB.getIdTokenOrReauth();
    if (!idToken) throw new Error(DB.lastAuthError || 'Tu sesión venció. Vuelve a ingresar.');
    const res = await fetch(window.CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action, ...payload, idToken }) });
    const data = await res.json().catch(() => null);
    if (!data || data.ok !== true) {
      const error = new Error((data && data.msg) || 'No se pudo completar la acción. Intenta de nuevo.');
      error.data = data;
      throw error;
    }
    return data;
  }

  async function loadProposals() {
    if (!state.session || !window.CONFIG || !window.CONFIG.API_URL) return;
    try {
      const data = await api('league_my_proposals', {});
      state.proposals = Array.isArray(data.proposals) ? data.proposals : [];
    } catch (err) {
      // Backend sin la acción nueva todavía: la página sigue igual.
      console.warn('No se pudieron leer las propuestas de horario:', err.message);
      state.proposals = [];
    }
    render();
  }

  // Cruce pendiente entre yo y un rival (por clave o correo).
  function pairingWith(ref) {
    if (!state.me) return null;
    const gender = L.entrantGender(state.me, L.getEnrollment(state.me, season));
    const v = view(gender);
    const me = L.findEntrant(v, state.me);
    if (!me) return null;
    const item = L.getPlayerFixture(v, me).find(it => it.partido && it.rival &&
      ((ref.key && it.rival.key === ref.key) || (ref.email && it.rival.email === ref.email)) &&
      ['por_agendar', 'proximo', 'invitado'].includes(it.partido.state));
    return item ? { me, rival: item.rival, round: item.round, deadline: item.partido.deadline, gender } : null;
  }

  // ── Diálogo para proponer horarios ────────────────────────────────────
  const propose = { ctx: null, day: '', slots: {}, picked: [], note: '' };

  function dialog() {
    let dlg = document.getElementById('lgDialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'lgDialog';
      dlg.className = 'lg-dialog';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', onDialogClick);
      dlg.addEventListener('input', event => { if (event.target.id === 'lgProposeNote') propose.note = event.target.value; });
      dlg.addEventListener('close', () => { propose.ctx = null; dlg.onconfirm = null; });
    }
    return dlg;
  }

  function proposeDates(ctx) {
    const today = L.todayIso();
    const from = ctx.round.window.start > today ? ctx.round.window.start : today;
    const limit = L.addDays(today, 21);
    const to = ctx.deadline < limit ? ctx.deadline : limit;
    const dates = [];
    for (let d = from; d <= to && dates.length < 21; d = L.addDays(d, 1)) dates.push(d);
    return dates;
  }

  function openPropose(ctx) {
    propose.ctx = ctx;
    propose.picked = [];
    propose.note = '';
    const dates = proposeDates(ctx);
    propose.day = dates[0] || '';
    const dlg = dialog();
    dlg.onconfirm = null;
    renderPropose();
    if (!dlg.open) dlg.showModal();
    if (propose.day) loadDay(propose.day);
  }

  async function loadDay(date) {
    if (propose.slots[date] && propose.slots[date] !== 'error') { renderPropose(); return; }
    propose.slots[date] = 'loading';
    renderPropose();
    try {
      const data = await DB.getSlotsAPI(date);
      const minStart = Date.now() + 4 * 3600000;
      const courts = {};
      Object.entries((data && data.ok && data.courts) || {}).forEach(([courtId, list]) => {
        if (!Array.isArray(list)) return;
        const free = list.filter(slot => new Date(`${date}T${slot}:00`).getTime() >= minStart);
        if (free.length) courts[courtId] = free;
      });
      propose.slots[date] = data && data.ok ? courts : 'error';
    } catch (e) {
      propose.slots[date] = 'error';
    }
    if (propose.ctx) renderPropose();
  }

  function renderPropose() {
    const ctx = propose.ctx;
    if (!ctx) return;
    const dlg = dialog();
    const dates = proposeDates(ctx);
    const first = ctx.rival.nombre.split(' ')[0];
    const slots = propose.slots[propose.day];
    const isPicked = (courtId, slot) => propose.picked.some(o => o.date === propose.day && o.courtId === courtId && o.slot === slot);
    let grid;
    if (!dates.length) grid = '<p class="lg-empty">El plazo de esta fecha ya no deja días disponibles.</p>';
    else if (slots === 'loading' || slots === undefined) grid = '<p class="lg-muted lg-loading">Buscando canchas libres…</p>';
    else if (slots === 'error') grid = '<p class="lg-warn">No se pudo consultar la disponibilidad. <button class="lg-link" type="button" data-dlg="retry">Reintentar</button></p>';
    else if (!Object.keys(slots).length) grid = '<p class="lg-muted">No quedan horarios libres este día. Prueba otro.</p>';
    else grid = Object.entries(slots).map(([courtId, list]) => `
      <div class="lg-court-row"><span>${esc(courtName(courtId))}</span>
        <div>${list.map(slot => `<button type="button" class="lg-slot ${isPicked(courtId, slot) ? 'is-picked' : ''}" data-dlg="slot" data-court="${esc(courtId)}" data-slot="${esc(slot)}">${esc(slot)}</button>`).join('')}</div>
      </div>`).join('');

    dlg.innerHTML = `
      <div class="lg-dialog-inner">
        <div class="lg-dialog-head">
          <div><span class="lg-eyebrow">Fecha ${ctx.round.numero} · plazo ${esc(fmtLong(ctx.deadline))}</span><h3>Propón horarios a ${esc(first)}</h3></div>
          <button type="button" class="lg-dialog-x" data-dlg="close" aria-label="Cerrar">×</button>
        </div>
        <p class="lg-muted lg-dialog-intro">Elige hasta 3 horarios con cancha libre. ${esc(first)} recibe un correo y elige uno con un clic: la cancha se reserva sola.</p>
        <div class="lg-days" role="tablist" aria-label="Días">${dates.map(d => {
          const count = propose.picked.filter(o => o.date === d).length;
          const parts = optionParts({ date: d, slot: '', courtId: '' });
          const [weekday, num] = parts.day.split(' ');
          return `<button type="button" role="tab" class="lg-day ${d === propose.day ? 'active' : ''}" data-dlg="day" data-date="${d}" aria-selected="${d === propose.day}"><small>${esc(weekday)}</small><b>${esc(num)}</b>${count ? `<i>${count}</i>` : ''}</button>`;
        }).join('')}</div>
        <div class="lg-slots">${grid}</div>
        <div class="lg-tray">
          <span class="lg-eyebrow">Tu propuesta (${propose.picked.length}/3)</span>
          ${propose.picked.length ? `<div class="lg-options">${propose.picked.map((o, i) => {
            const parts = optionParts(o);
            return `<div class="lg-option is-static"><span>${esc(parts.day)}</span><b>${esc(parts.slot)}</b><small>${esc(parts.court)}</small><button type="button" class="lg-option-x" data-dlg="unpick" data-i="${i}" aria-label="Quitar">×</button></div>`;
          }).join('')}</div>` : '<p class="lg-muted">Toca un horario para agregarlo. Mientras más opciones, más fácil que le acomode.</p>'}
          <label class="lg-note-field">Mensaje para ${esc(first)} (opcional)
            <input id="lgProposeNote" maxlength="200" value="${esc(propose.note)}" placeholder="Ej: prefiero en la tarde">
          </label>
        </div>
        <div class="lg-dialog-foot">
          <button type="button" class="lg-btn ghost" data-dlg="close">Cancelar</button>
          <button type="button" class="lg-btn" data-dlg="send" ${propose.picked.length && !state.busy ? '' : 'disabled'}>${state.busy ? 'Enviando…' : `Enviar propuesta${propose.picked.length ? ` (${propose.picked.length})` : ''}`}</button>
        </div>
      </div>`;
  }

  async function onDialogClick(event) {
    const dlg = dialog();
    if (event.target === dlg) { if (!state.busy) dlg.close(); return; } // clic fuera del cuadro
    if (dlg.onconfirm) { dlg.onconfirm(event); return; }
    const btn = event.target.closest('[data-dlg]');
    if (!btn) return;
    const kind = btn.dataset.dlg;
    if (kind === 'close') { dlg.close(); return; }
    if (kind === 'day') { propose.day = btn.dataset.date; loadDay(propose.day); return; }
    if (kind === 'retry') { delete propose.slots[propose.day]; loadDay(propose.day); return; }
    if (kind === 'unpick') { propose.picked.splice(Number(btn.dataset.i), 1); renderPropose(); return; }
    if (kind === 'slot') {
      const option = { date: propose.day, courtId: btn.dataset.court, slot: btn.dataset.slot };
      const at = propose.picked.findIndex(o => o.date === option.date && o.slot === option.slot && o.courtId === option.courtId);
      if (at >= 0) propose.picked.splice(at, 1);
      else if (propose.picked.some(o => o.date === option.date && o.slot === option.slot)) toast('Ya elegiste ese mismo horario en otra cancha.', 'bad');
      else if (propose.picked.length >= 3) toast('Máximo 3 horarios. Quita uno para cambiarlo.', 'bad');
      else propose.picked.push(option);
      renderPropose();
      return;
    }
    if (kind === 'send') await sendProposal();
  }

  async function sendProposal() {
    const ctx = propose.ctx;
    if (!ctx || !propose.picked.length || state.busy) return;
    state.busy = true;
    renderPropose();
    try {
      await api('league_propose_slots', {
        temporada: season.id, fecha: ctx.round.numero, plazo: ctx.deadline, genero: ctx.gender,
        fromId: state.me.id, fromNombre: state.me.nombre,
        toId: ctx.rival.id, toEmail: ctx.rival.email, toNombre: ctx.rival.nombre,
        options: propose.picked.slice().sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot)),
        nota: propose.note.trim()
      });
      state.busy = false;
      dialog().close();
      toast(`¡Listo! ${ctx.rival.nombre.split(' ')[0]} recibió tus horarios por correo.`);
      await loadProposals();
    } catch (err) {
      state.busy = false;
      toast(err.message, 'bad');
      // Si un horario se ocupó, se vuelve a consultar ese día.
      propose.slots = {};
      if (propose.day) loadDay(propose.day);
    }
  }

  // ── Elegir una opción (aceptar) ───────────────────────────────────────
  function confirmAccept(proposal, opcion) {
    const option = (proposal.options || [])[opcion - 1];
    if (!option) return toast('Esa opción ya no está disponible.', 'bad');
    const parts = optionParts(option);
    const dlg = dialog();
    propose.ctx = null;
    dlg.innerHTML = `
      <div class="lg-dialog-inner lg-confirm">
        <span class="lg-eyebrow">${proposal.fecha ? `Fecha ${proposal.fecha} · ` : ''}Campeonato de Liga</span>
        <h3>¿Confirmas este partido?</h3>
        <div class="lg-confirm-card">
          <strong>${esc(proposal.fromNombre)} <i>vs</i> ${esc(proposal.toNombre)}</strong>
          <span class="lg-confirm-when">${esc(parts.day)} · ${esc(parts.slot)}</span>
          <span>${esc(parts.court)}</span>
        </div>
        <p class="lg-muted">Se reserva la cancha a tu nombre y ambos reciben la confirmación y la invitación de Google Calendar.</p>
        <div class="lg-dialog-foot">
          <button type="button" class="lg-btn ghost" data-confirm="no">Ver otras opciones</button>
          <button type="button" class="lg-btn" data-confirm="yes">Confirmar partido</button>
        </div>
      </div>`;
    dlg.onconfirm = async event => {
      const btn = event.target.closest('[data-confirm]');
      if (!btn || state.busy) return;
      if (btn.dataset.confirm === 'no') { dlg.close(); return; }
      btn.disabled = true;
      btn.textContent = 'Reservando cancha…';
      await acceptProposal(proposal, opcion);
      if (dlg.open) dlg.close();
    };
    if (!dlg.open) dlg.showModal();
  }

  async function acceptProposal(proposal, opcion) {
    state.busy = true;
    try {
      const data = await api('league_accept_proposal', { id: proposal.id, opcion });
      const challenge = data.challenge;
      if (challenge) {
        state.matches = [...state.matches.filter(m => m.id !== challenge.id), challenge];
        if (DB.isCloudConfigured() && DB.saveChallengeCloud) DB.saveChallengeCloud(challenge).catch(() => {});
      }
      state.proposals = state.proposals.filter(p => p.id !== proposal.id);
      toast(`¡Partido confirmado! ${optionLabel(proposal.options[opcion - 1])}. Revisa tu correo.`);
    } catch (err) {
      toast(err.data && err.data.slotTaken ? `${err.message} Elige otra opción o propón otros horarios.` : err.message, 'bad');
      loadProposals();
    } finally {
      state.busy = false;
      render();
    }
  }

  async function findProposal(id) {
    const local = state.proposals.find(p => p.id === id);
    if (local) return local;
    const data = await api('league_get_proposal', { id });
    return data.proposal;
  }

  function openCounter(proposal) {
    const ctx = pairingWith({ email: proposal.fromEmail });
    if (!ctx) return toast('Ya no tienes un partido pendiente con ese jugador.', 'bad');
    openPropose(ctx);
  }

  // Enlaces de los correos: ?propuesta=ID&opcion=N y ?proponer=rival. Sin
  // sesión, la intención se guarda y se retoma al volver de ingresar.
  async function handleIntent() {
    const params = new URLSearchParams(location.search);
    let intent = null;
    if (params.get('propuesta') || params.get('proponer')) {
      intent = { propuesta: params.get('propuesta'), opcion: params.get('opcion'), proponer: params.get('proponer') };
      history.replaceState(null, '', location.pathname + location.hash);
    } else {
      try { intent = JSON.parse(sessionStorage.getItem('uctenis_liga_intent') || 'null'); } catch (e) {}
    }
    if (!intent) return;
    if (!state.session) {
      try { sessionStorage.setItem('uctenis_liga_intent', JSON.stringify(intent)); } catch (e) {}
      toast('Ingresa con tu cuenta del club para responder.');
      return;
    }
    try { sessionStorage.removeItem('uctenis_liga_intent'); } catch (e) {}
    try {
      if (intent.proponer) {
        const ctx = pairingWith({ key: intent.proponer, email: String(intent.proponer).toLowerCase() });
        if (ctx) openPropose(ctx);
        else toast('Ya no tienes un partido pendiente con ese rival.', 'bad');
        return;
      }
      const proposal = await findProposal(intent.propuesta);
      if (!proposal) return;
      if (proposal.status !== 'pendiente') {
        toast(proposal.status === 'aceptada' ? 'Esa propuesta ya fue aceptada: el partido está agendado.' : 'Esa propuesta fue reemplazada por una más nueva.', 'bad');
        return;
      }
      if (proposal.toEmail !== myEmail()) {
        toast(`Esta propuesta es para ${proposal.toNombre}. Entraste como ${myEmail()}.`, 'bad');
        return;
      }
      const opcion = Number(intent.opcion);
      if (opcion > 0) confirmAccept(proposal, opcion);
      else openCounter(proposal);
    } catch (err) {
      toast(err.message, 'bad');
    }
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

  function groupName(numero) { return `Grupo ${numero}`; }

  // Cada grupo tiene su color para reconocerlo en tablas, fixture y fichas.
  const GROUP_COLORS = ['#f59e0b', '#7dd3fc', '#4ade80', '#f472b6'];
  function groupColor(numero) { return GROUP_COLORS[(Math.max(1, numero) - 1) % GROUP_COLORS.length]; }

  function groupTitle(numero, detail = '', tag = 'h3') {
    return `<${tag} class="lg-group-title" style="--gc:${groupColor(numero)}"><span class="lg-group-dot">${numero}</span>${groupName(numero)}${detail ? ` <small>${detail}</small>` : ''}</${tag}>`;
  }

  function fechasFor(size) { return size < 2 ? 0 : size % 2 ? size : size - 1; }

  function averageRanking(entrants) {
    const ranks = entrants.map(e => e.ranking).filter(Boolean);
    return ranks.length ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length : 0;
  }

  /**
   * Tarjetas de los grupos: jugadores ordenados por su lugar en el ranking
   * (el primero es el cabeza de serie), con fechas, cupos al Maestros y
   * ranking promedio para ver de un vistazo que los grupos quedaron parejos.
   * `groups`: [{ numero, entrants, fechas, maestros }].
   */
  function groupCards(groups, { compact = false, reveal = false, showNumbers = false } = {}) {
    const meKey = state.me ? L.playerKey(state.me) : '';
    const averages = groups.map(g => averageRanking(g.entrants)).filter(Boolean);
    const spread = averages.length > 1 ? Math.max(...averages) - Math.min(...averages) : null;
    const cards = groups.map((g, i) => {
      const seeds = g.entrants.slice().sort((a, b) => (a.ranking || Infinity) - (b.ranking || Infinity) || a.numero - b.numero);
      const last = g.fechas ? L.getRoundWindow(season, g.fechas) : null;
      const avg = averageRanking(g.entrants);
      return `
        <section class="lg-group" style="--gc:${groupColor(g.numero)};--i:${i}">
          <div class="lg-group-head">
            <span class="lg-group-badge" aria-hidden="true">${g.numero}</span>
            <div class="lg-group-name"><span>${GENDER_LABEL[state.gender]} · ${season.id}</span><h3>${groupName(g.numero)}</h3></div>
            <span class="lg-group-count"><b>${g.entrants.length}</b> jugadores</span>
          </div>
          <dl class="lg-group-stats">
            <div><dt>Fechas</dt><dd>${g.fechas}</dd></div>
            <div><dt>Al Maestros</dt><dd>${g.maestros}</dd></div>
            <div><dt>Ranking prom.</dt><dd>${avg ? avg.toLocaleString('es-CL', { maximumFractionDigits: 1 }) : '–'}</dd></div>
          </dl>
          <ol class="lg-seeds">
            ${seeds.map((e, j) => `
              <li class="${j === 0 ? 'is-head' : ''} ${e.key === meKey ? 'is-me' : ''} ${e.retirado ? 'is-out' : ''}" style="--j:${j}">
                <span class="lg-seed-rank" title="${e.ranking ? `${e.ranking}° del ranking` : 'Sin lugar en la escalerilla'}">${e.ranking ? `${e.ranking}°` : '–'}</span>
                ${avatar(e, 'sm')}
                <span class="lg-seed-name"><strong>${esc(e.nombre)}</strong><small>${j === 0 ? '<i>★ Cabeza de serie</i>' : esc(category(e.categoria) || 'Jugador')}${e.key === meKey ? ' · Tú' : ''}${e.retirado ? ' · Retirado' : ''}</small></span>
                ${showNumbers ? `<span class="lg-seed-num" title="Número sorteado en el fixture">N° ${e.numero}</span>` : ''}
              </li>`).join('')}
          </ol>
          ${!compact && last ? `<div class="lg-group-foot">Todos contra todos · del ${esc(fmtLong(season.inicio))} al ${esc(fmtLong(last.end))}</div>` : ''}
        </section>`;
    }).join('');
    const balance = spread === null ? '' : `<p class="lg-balance ${spread <= 1 ? 'ok' : ''}">⚖️ ${spread <= 1 ? 'Grupos parejos' : 'Ojo con el equilibrio'}: el ranking promedio varía ${spread.toLocaleString('es-CL', { maximumFractionDigits: 1 })} ${spread === 1 ? 'puesto' : 'puestos'} entre grupos.</p>`;
    return `<div class="lg-groups ${compact ? 'compact' : ''} ${reveal ? 'is-reveal' : ''}">${cards}</div>${balance}`;
  }

  function viewGroups(v) {
    return v.groups.map(g => ({ numero: g.numero, entrants: g.entrants, fechas: g.rounds.length, maestros: g.maestros }));
  }

  // Lo elegido en el panel (cantidad y reparto) mientras no se guarde.
  function groupDraft(v) {
    const draft = state.groupDraft[v.gender] || {};
    return { count: draft.count || (v.grouped ? v.groups.length : 1), mode: draft.mode || 'alternado' };
  }

  // Grupos que resultarían con lo elegido en el panel.
  function draftGroups(v) {
    const { count, mode } = groupDraft(v);
    if (count < 2) return [];
    const assignment = L.assignGroups(v.entrants, count, mode);
    const groups = Array.from({ length: count }, (_, i) => ({ numero: i + 1, entrants: v.entrants.filter(e => assignment.get(e.key) === i + 1) }));
    const quotas = L.mastersByGroup(v.entrants.length, groups.map(g => g.entrants.length));
    return groups.map((g, i) => ({ ...g, fechas: fechasFor(g.entrants.length), maestros: quotas[i] }));
  }

  function renderStandings(v) {
    if (!v.entrants.length) return emptyCategory(v);
    const pre = v.phase === 'inscripcion'
      ? `<div class="lg-note">La tabla empieza a moverse el ${fmtLong(season.inicio)}. Por ahora todos parten en cero.</div>` : '';
    const tables = v.groups.map(group => `
      ${v.grouped ? groupTitle(group.numero, `${group.entrants.length} jugadores · clasifican ${group.maestros}`) : ''}
      ${standingsTable(v, group.standings, group.maestros)}`).join('');
    const quota = v.grouped
      ? `Clasifican ${v.maestros} al Torneo de Maestros: ${v.groups.map(g => `${g.maestros} del ${groupName(g.numero)}`).join(' y ')}.`
      : `Clasifican ${v.maestros} al Torneo de Maestros.`;
    return `
      ${pre}
      ${tables}
      <p class="lg-legend">Desempate: puntos → enfrentamiento directo (si empatan dos) → partidos ganados → diferencia de sets → diferencia de games. ${quota}</p>`;
  }

  function standingsTable(v, standings, maestros) {
    const meKey = state.me ? (L.findEntrant(v, state.me) || {}).key : '';
    const rows = standings.map((row, index) => {
      const cut = index === maestros - 1 && standings.length > maestros
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
      <div class="lg-table-wrap">
        <table class="lg-table">
          <thead><tr>
            <th>#</th><th>Jugador</th><th title="Puntos">Pts</th><th title="Partidos jugados">PJ</th><th title="Ganados">PG</th><th title="Perdidos">PP</th>
            <th class="lg-hide-sm" title="Sets a favor y en contra">Sets</th><th class="lg-hide-sm" title="Diferencia de games">±G</th><th class="lg-hide-sm" title="W.O. en contra (simples y dobles)">WO</th><th class="lg-hide-xs">Últimos</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
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

    const card = p => {
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
    };
    const byes = list => list.length ? `<p class="lg-bye">Libre esta fecha: <strong>${list.map(e => esc(e.nombre)).join(', ')}</strong></p>` : '';
    const body = v.grouped
      ? v.groups.map(group => {
        const partidos = round.partidos.filter(p => p.grupo === group.numero);
        const libres = round.libres.filter(e => e.grupo === group.numero);
        return `${groupTitle(group.numero, '', 'h4')}
          ${partidos.length ? `<div class="lg-matches">${partidos.map(card).join('')}</div>` : `<p class="lg-muted">Este grupo ya completó sus cruces.</p>`}
          ${byes(libres)}`;
      }).join('')
      : `<div class="lg-matches">${round.partidos.map(card).join('')}</div>${byes(round.libres)}`;

    return `
      <div class="lg-rounds" role="tablist" aria-label="Fechas">${strip}</div>
      <div class="lg-round-head">
        <div><h3>Fecha ${round.numero}</h3><span>${esc(fmtLong(round.window.start))} al ${esc(fmtLong(round.window.end))} · ${statusLine}</span></div>
        <span class="lg-round-count">${played}/${round.partidos.length} resueltos</span>
      </div>
      ${body}`;
  }

  // ── Inscritos ─────────────────────────────────────────────────────────
  function renderEntrants(v) {
    if (!v.entrants.length) return emptyCategory(v);
    const note = v.drawDone
      ? 'Los números del fixture fueron sorteados por la comisión organizadora.'
      : v.phase === 'inscripcion'
        ? 'El número de cada jugador sigue el orden de inscripción; la comisión puede sortearlos al cerrar la inscripción.'
        : 'Números según el orden de inscripción.';
    const list = entrants => `
      <ul class="lg-entrants">
        ${entrants.map(e => `<li class="${e.retirado ? 'is-out' : ''}"><span class="lg-num">${e.numero}</span>${avatar(e)}<span><strong>${esc(e.nombre)}</strong><small>${esc(category(e.categoria) || 'Jugador')}${e.ranking ? ` · Ranking ${e.ranking}°` : ''}${e.retirado ? ' · Retirado' : ''}</small></span></li>`).join('')}
      </ul>`;
    const sections = v.grouped
      ? groupCards(viewGroups(v), { reveal: state.revealGroups, showNumbers: v.drawDone }) +
        (v.sinGrupo.length ? `<h3 class="lg-sub">Sin grupo asignado</h3>${list(v.sinGrupo)}` : '')
      : list(v.entrants);
    return `
      <div class="lg-summary">
        <div><strong>${v.entrants.filter(e => !e.retirado).length}</strong><span>Inscritos</span></div>
        ${v.grouped ? `<div><strong>${v.groups.length}</strong><span>Grupos</span></div>` : ''}
        <div><strong>${v.rounds.length}</strong><span>Fechas</span></div>
        <div><strong>${v.maestros}</strong><span>Al Maestros</span></div>
        <div><strong>${v.rounds.length ? esc(fmt(v.rounds[v.rounds.length - 1].window.end, { day: 'numeric', month: 'short', year: 'numeric' })) : '–'}</strong><span>Última fecha</span></div>
      </div>
      ${sections}
      <p class="lg-legend">${note}${v.grouped ? ' Los grupos los armó la comisión repartiendo a los inscritos según su lugar en el ranking.' : ''}${v.rounds.length > season.ventanas.length ? ` Con ${v.entrants.length} inscritos hacen falta ${v.rounds.length} fechas: las que exceden el calendario oficial siguen el mismo patrón de 10 días.` : ''}</p>`;
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
        <article><h4>Sistema</h4><p>Todos contra todos por fechas: en cada fecha juegas con un rival distinto hasta completar todos los cruces. Si los inscritos son impares, en cada fecha alguien queda libre.${v.grouped ? ` En ${GENDER_LABEL[v.gender]} se juega en ${v.groups.length} grupos armados según el ranking: juegas contra todos los de tu grupo y de cada uno clasifican los mejores al Maestros.` : ''}</p></article>
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
  // Fechas que toma la rueda con `groups` grupos: las del grupo más grande.
  function roundsFor(count, groups) {
    const size = Math.ceil(count / groups);
    return size % 2 ? size : size - 1;
  }

  function renderAdmin(v) {
    const el = document.getElementById('lgAdmin');
    el.hidden = !state.isAdmin;
    if (!state.isAdmin) return;
    const phase = v.phase;
    const enrolledKeys = new Set(v.entrants.map(e => e.key));
    const candidates = state.players
      .filter(isLeagueEligible)
      .filter(p => [v.gender, ''].includes(L.normalizeGender(p.genero || p.gender)) && !L.getEnrollment(p, season) && !enrolledKeys.has(L.playerKey(p)))
      .map(p => ({ value: p.id, nombre: p.nombre, detail: category(p.categoria) }))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    const draft = groupDraft(v);
    const preview = draftGroups(v);
    // Sin cambios respecto de lo guardado: no hace falta la vista previa.
    const sameAsCurrent = v.grouped && preview.length === v.groups.length &&
      preview.every(g => g.entrants.every(e => e.grupo === g.numero));
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
          <h4>Grupos según ranking</h4>
          <p class="lg-muted">${v.grouped ? `Hoy hay ${v.groups.length} grupos (${v.groups.map(g => `${groupName(g.numero)}: ${g.entrants.length}`).join(' · ')}).` : 'Hoy juegan todos contra todos en un solo grupo.'} Fechas necesarias con ${v.entrants.length} inscritos: ${[1, 2, 3, 4].filter(k => k === 1 || v.entrants.length >= k * 3).map(k => `${k === 1 ? 'sin grupos' : `${k} grupos`} → ${roundsFor(v.entrants.length, k)}`).join(' · ')}.</p>
          <div class="lg-inline">
            <select id="lgGroupCount" data-draft="count" aria-label="Cantidad de grupos">${[1, 2, 3, 4].filter(k => k === 1 || v.entrants.length >= k * 3).map(k => `<option value="${k}" ${k === draft.count ? 'selected' : ''}>${k === 1 ? 'Sin grupos' : `${k} grupos`}</option>`).join('')}</select>
            <select id="lgGroupMode" data-draft="mode" aria-label="Forma de repartir">
              <option value="alternado" ${draft.mode === 'alternado' ? 'selected' : ''}>Alternado (1°→G1, 2°→G2, 3°→G1…)</option>
              <option value="serpentina" ${draft.mode === 'serpentina' ? 'selected' : ''}>Serpentina (1°→G1, 2°→G2, 3°→G2, 4°→G1…)</option>
            </select>
            <button class="lg-btn sm" type="button" data-action="admin-groups" ${v.entrants.length < 2 ? 'disabled' : ''}>Armar grupos</button>
          </div>
          <p class="lg-muted">Se ordena por el lugar de cada uno en el ranking; quienes no están en la escalerilla van al final. Abajo ves cómo quedarían antes de guardar; después puedes mover a cualquiera de grupo en la lista de inscritos.</p>
          ${phase !== 'inscripcion' ? '<p class="lg-warn">La liga ya partió: rearmar los grupos cambia todos los cruces del fixture.</p>' : ''}
          ${v.sinGrupo.length ? `<p class="lg-warn">${v.sinGrupo.length === 1 ? 'Hay 1 inscrito' : `Hay ${v.sinGrupo.length} inscritos`} sin grupo (${v.sinGrupo.map(e => esc(e.nombre)).join(', ')}): no juegan hasta que les asignes uno.</p>` : ''}
        </article>
        <article>
          <h4>Sorteo de partidos</h4>
          <p class="lg-muted">${v.drawDone ? 'Números ya sorteados.' : 'Hoy los números siguen el orden de inscripción.'} El sorteo asigna un número a cada inscrito${v.grouped ? ' dentro de su grupo' : ''}, y ese número fija quién juega con quién en cada fecha.</p>
          <button class="lg-btn sm ghost" type="button" data-action="admin-draw" ${v.entrants.length < 2 ? 'disabled' : ''}>${v.drawDone ? 'Volver a sortear' : 'Sortear partidos'}</button>
          ${phase !== 'inscripcion' ? '<p class="lg-warn">Sortear con la liga en curso reordena los cruces de fechas ya jugadas.</p>' : ''}
        </article>
      </div>
      ${preview.length && !sameAsCurrent ? `
        <div class="lg-group-preview">
          <div class="lg-group-preview-head"><span class="lg-eyebrow">Vista previa · aún no se guarda</span><span class="lg-muted">Aprieta «Armar grupos» para confirmarlos.</span></div>
          ${groupCards(preview, { compact: true })}
        </div>` : ''}
      <h4 class="lg-sub">Inscritos (${v.entrants.length})</h4>
      <ul class="lg-admin-list">${v.entrants.map(e => `
        <li><span class="lg-num">${v.grouped ? (e.grupo ? `G${e.grupo}·${e.numero}` : '–') : e.numero}</span><span>${esc(e.nombre)}${e.ranking ? ` <em>· ranking ${e.ranking}°</em>` : ''}${e.retirado ? ` <em>· retirado ${e.retiradoEn ? esc(fmt(e.retiradoEn)) : ''}</em>` : ''}</span>
          ${v.grouped ? `<select data-group-for="${esc(e.id)}" aria-label="Grupo de ${esc(e.nombre)}">${e.grupo ? '' : '<option value="" selected>Sin grupo</option>'}${v.groups.map(g => `<option value="${g.numero}" ${g.numero === e.grupo ? 'selected' : ''}>${groupName(g.numero)}</option>`).join('')}</select>` : ''}
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
  function actor() { return { email: state.session ? state.session.email : '', leagueAdmin: state.isAdmin }; }

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
      // Los mensajes en español vienen del backend o de la validación de la
      // cuenta y dicen qué hacer; los del SDK de Firebase no.
      const message = String(err && err.message || '');
      toast(/[áéíóúñ]|sesión|correo|cuenta/i.test(message) && !/insufficient permissions/i.test(message) ? message
        : /permission|permiso/i.test(message) ? 'No tienes permiso para hacer este cambio.' : 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.', 'bad');
    } finally {
      state.busy = false;
      render();
    }
  }

  function playerById(id) { return state.players.find(p => p.id === id); }

  async function onAction(button) {
    const action = button.dataset.action;
    const now = new Date().toISOString();
    if (action === 'switch-account') {
      DB.logout();
      location.href = 'ranking.html?volver=liga';
      return;
    }
    if (action === 'propose') {
      const ctx = pairingWith({ key: button.dataset.rival, email: button.dataset.rivalEmail });
      if (ctx) openPropose(ctx);
      else toast('Ya no tienes un partido pendiente con ese rival.', 'bad');
      return;
    }
    if (action === 'accept-proposal' || action === 'counter-proposal') {
      const proposal = state.proposals.find(p => p.id === button.dataset.id);
      if (!proposal) return;
      if (action === 'accept-proposal') confirmAccept(proposal, Number(button.dataset.opcion));
      else openCounter(proposal);
      return;
    }
    if (action === 'enroll-self' && state.session) {
      if (!confirm(`¿Confirmas tu inscripción al ${season.nombre}? Te comprometes a jugar cada fecha dentro de su plazo.`)) return;
      const rama = button.dataset.rama;
      if (rama) state.gender = rama;
      if (!state.me || !isLeagueEligible(state.me)) return;
      return saveEnrollment(state.me.id, { inscrito: true, retirado: false, inscritoEn: now, rama }, `¡Listo! Quedaste inscrito en ${GENDER_LABEL[rama] || 'la liga'}.`);
    }
    if (action === 'unenroll-self' && state.me) {
      if (!confirm('¿Darte de baja de la liga? Puedes volver a inscribirte mientras la inscripción siga abierta.')) return;
      return saveEnrollment(state.me.id, { inscrito: false, numero: null }, 'Te diste de baja de la liga.');
    }
    if (!state.isAdmin) return;
    if (action === 'admin-enroll') {
      const player = playerById(document.getElementById('lgAdminCandidate').value);
      if (!player) return toast('Elige un jugador.', 'bad');
      return saveEnrollment(player.id, { inscrito: true, retirado: false, inscritoEn: now, inscritoPor: actor().email, rama: state.gender }, `${player.nombre} quedó inscrito en ${GENDER_LABEL[state.gender]}.`);
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
    if (action === 'admin-groups') {
      const v = view();
      const count = Number(document.getElementById('lgGroupCount').value) || 1;
      const mode = document.getElementById('lgGroupMode').value;
      const msg = count === 1
        ? `¿Quitar los grupos de ${GENDER_LABEL[v.gender]}? Volverán a jugar todos contra todos.`
        : `¿Repartir a los ${v.entrants.length} inscritos de ${GENDER_LABEL[v.gender]} en ${count} grupos según el ranking (${mode})? Después hay que sortear los partidos.`;
      if (!confirm(v.phase === 'inscripcion' ? msg : `La liga ya partió y esto cambia todos los cruces. ${msg}`)) return;
      const groups = count > 1 ? L.assignGroups(v.entrants, count, mode) : null;
      const patches = v.entrants.map(e => [e.id, { grupo: groups ? groups.get(e.key) || null : null, numero: null }]);
      delete state.groupDraft[v.gender];
      return saveMany(patches, count === 1 ? 'Grupos eliminados.' : `Listo: ${count} grupos armados según el ranking. Ahora sortea los partidos.`, 'Los grupos quedaron a medias; vuelve a armarlos.', () => {
        if (count === 1) return;
        state.tab = 'inscritos';
        state.revealGroups = true;
        setTimeout(() => {
          state.revealGroups = false;
          const panel = document.getElementById('lgView');
          if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      });
    }
    if (action === 'admin-draw') {
      const v = view();
      const scope = v.grouped ? ` dentro de cada uno de los ${v.groups.length} grupos` : '';
      const msg = v.phase === 'inscripcion'
        ? `¿Sortear los partidos de ${GENDER_LABEL[v.gender]} (${v.entrants.length} inscritos)${scope}?`
        : 'La liga ya partió. Sortear de nuevo cambia los cruces, incluidas fechas ya jugadas. ¿Continuar igual?';
      if (!confirm(msg)) return;
      const patches = v.groups.flatMap(group => {
        const order = group.entrants.map(e => e.id);
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        return order.map((id, index) => [id, { numero: index + 1 }]);
      });
      return saveMany(patches, 'Partidos sorteados. El fixture ya está actualizado.', 'El sorteo quedó incompleto; vuelve a intentarlo.');
    }
  }

  // Guarda varias inscripciones a la vez (grupos, sorteo).
  async function saveMany(patches, okMessage, failMessage, onSaved) {
    if (state.busy) return;
    state.busy = true;
    try {
      await Promise.all(patches.map(([id, patch]) => DB.saveLeagueEnrollmentCloud(id, season.field, patch, actor())
        .then(() => { const p = playerById(id); if (p) p[season.field] = { ...(p[season.field] || {}), ...patch }; })));
      toast(okMessage);
      if (onSaved) onSaved();
    } catch (err) {
      console.error(failMessage, err);
      toast(failMessage, 'bad');
    } finally {
      state.busy = false;
      render();
    }
  }

  async function onGroupChange(select) {
    if (!state.isAdmin) return;
    const player = playerById(select.dataset.groupFor);
    const grupo = Number(select.value) || null;
    if (!player || !grupo) return;
    if (!confirm(`¿Mover a ${player.nombre} al ${groupName(grupo)}?${view().phase !== 'inscripcion' ? ' La liga ya partió: cambian los cruces de ambos grupos.' : ''}`)) { render(); return; }
    return saveEnrollment(player.id, { grupo, numero: null }, `${player.nombre} pasó al ${groupName(grupo)}.`);
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
    document.addEventListener('change', event => {
      const select = event.target.closest('select[data-group-for]');
      if (select) onGroupChange(select);
      const draft = event.target.closest('select[data-draft]');
      if (draft) {
        const current = state.groupDraft[state.gender] || {};
        state.groupDraft[state.gender] = { ...current, [draft.dataset.draft]: draft.dataset.draft === 'count' ? Number(draft.value) : draft.value };
        render();
      }
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
    state.me = findMe();
    const myGender = state.me ? L.entrantGender(state.me, L.getEnrollment(state.me, season)) : '';
    if (myGender) state.gender = myGender;
    state.loaded = true;
    render();
    loadProposals().then(handleIntent);

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
