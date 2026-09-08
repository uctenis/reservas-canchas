(() => {
  const API_URL = window.CONFIG.API_URL;
  const ADMIN_EMAILS = ['uctenisclub@gmail.com','dsilva@uct.cl'];
  const state = { tournaments:[], current:null, participants:[], clubPlayers:[] };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const courtNames = {cec1:'CEC Cancha 1',cec2:'CEC Cancha 2',cjp1:'CJP Cancha 1',cjp2:'CJP Cancha 2'};
  const slots = ['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','20:00','21:00'];

  function isAdmin(session) {
    return Boolean(session && (session.isAdmin === true || ADMIN_EMAILS.includes(String(session.email || '').toLowerCase())));
  }
  function notice(message, error = false) {
    const el = $('adminAlert');
    el.textContent = message;
    el.className = 'admin-alert' + (error ? ' error' : '');
    el.style.display = 'block';
    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => { el.style.display = 'none'; }, 5500);
  }
  async function api(action, payload = {}, requireAdmin = true) {
    const body = { action, ...payload };
    if (requireAdmin) {
      const token = await DB.getIdTokenOrReauth();
      if (!token) throw new Error(DB.lastAuthError || 'La sesion administrativa vencio.');
      body.idToken = token;
      body.actorEmail = DB.getSession()?.email || '';
    }
    const response = await fetch(API_URL, { method:'POST', body:JSON.stringify(body) });
    const data = await response.json();
    if (!data.ok) {
      const error = new Error(data.msg || 'No se pudo completar la operacion.');
      error.data = data;
      throw error;
    }
    return data;
  }

  function blankTournament() {
    return {name:'',edition:'',tagline:'',description:'',venue:'',surface:'Mixta',category:'Todo competidor',gender:'Abierto',startDate:'',endDate:'',registrationDeadline:'',rules:'Al mejor de 3 sets. En caso de empate 1-1, match tie-break a 10 puntos en el tercer set.',prize:'',organizer:'UCTenis Club',contact:'uctenisclub@gmail.com',size:8,status:'draft',published:false,featured:false,participants:[],matches:[],news:[]};
  }
  function readForm() {
    return {
      ...(state.current || {}),
      name:$('tourName').value.trim(), edition:$('tourEdition').value.trim(), size:Number($('tourSize').value),
      category:$('tourCategory').value.trim(), gender:$('tourGender').value, startDate:$('tourStart').value,
      endDate:$('tourEnd').value, registrationDeadline:$('tourDeadline').value, venue:$('tourVenue').value.trim(),
      surface:$('tourSurface').value, status:$('tourStatus').value, prize:$('tourPrize').value.trim(),
      tagline:$('tourTagline').value.trim(), description:$('tourDescription').value.trim(), rules:$('tourRules').value.trim(),
      organizer:$('tourOrganizer').value.trim(), contact:$('tourContact').value.trim(),
      published:$('tourPublished').checked, featured:$('tourFeatured').checked,
      participants:state.participants
    };
  }
  function fillForm(t) {
    const values = {
      tourName:t.name,tourEdition:t.edition,tourSize:t.size,tourCategory:t.category,tourGender:t.gender,
      tourStart:t.startDate,tourEnd:t.endDate,tourDeadline:t.registrationDeadline,tourVenue:t.venue,
      tourSurface:t.surface,tourStatus:t.status,tourPrize:t.prize,tourTagline:t.tagline,
      tourDescription:t.description,tourRules:t.rules,tourOrganizer:t.organizer,tourContact:t.contact
    };
    Object.entries(values).forEach(([id,value]) => { if ($(id)) $(id).value = value ?? ''; });
    $('tourEnd').min = t.startDate || '';
    $('tourPublished').checked = t.published === true;
    $('tourFeatured').checked = t.featured === true;
    state.participants = JSON.parse(JSON.stringify(t.participants || []));
    $('editorTitle').textContent = t.name || 'Nuevo campeonato';
    $('editorSubtitle').textContent = t.id ? `${t.participants?.length || 0}/${t.size} inscritos - ${t.matches?.filter(m => m.status === 'completed').length || 0} resultados` : 'Configura, publica y opera el torneo desde aqui.';
    $('archiveTournamentBtn').style.display = t.id ? '' : 'none';
    $('publicPreviewLink').href = t.id ? `campeonato.html?id=${encodeURIComponent(t.id)}` : 'campeonato.html';
    $('bracketPreviewLink').href = t.id ? `campeonato.html?id=${encodeURIComponent(t.id)}` : 'campeonato.html';
    renderParticipants();
    renderMatches();
  }
  function selectTournament(id) {
    state.current = state.tournaments.find(t => t.id === id) || blankTournament();
    fillForm(state.current);
    renderList();
  }
  function renderList() {
    $('tournamentList').innerHTML = state.tournaments.length ? state.tournaments.map(t => `
      <button class="admin-list-item ${state.current?.id === t.id ? 'active' : ''}" data-id="${esc(t.id)}"><strong>${esc(t.name)}</strong><span>${esc(t.status)} - ${t.participants?.length || 0}/${t.size} inscritos</span></button>`).join('') : '<div class="empty-state">No hay campeonatos creados.</div>';
  }
  async function loadTournaments(preferredId) {
    const data = await api('get_tournaments');
    state.tournaments = data.tournaments || [];
    renderList();
    if (preferredId) selectTournament(preferredId);
    else if (state.current?.id) selectTournament(state.current.id);
    else if (state.tournaments[0]) selectTournament(state.tournaments[0].id);
    else { state.current = blankTournament(); fillForm(state.current); }
  }
  // El ranking oficial del club vive en Firestore (la misma fuente que usa
  // ranking.html), no en el Sheet legado que leia la accion "get_ranking" del
  // Apps Script -- ese Sheet ya no se actualiza desde que el ranking se migro
  // a Firestore, asi que quedarse con el dejaba la siembra de los cuadros
  // basada en datos desactualizados. db.js ya esta cargado en esta pagina,
  // asi que se consulta Firestore directo, igual que hace el ranking.
  async function loadClubPlayers() {
    try {
      const raw = DB.isCloudConfigured() ? await DB.getPlayersCloud() : DB.getUsers();
      const byGender = { M: [], F: [] };
      raw.forEach(player => {
        const genero = String(player.genero || player.gender || '').toUpperCase().startsWith('F') ? 'F' : 'M';
        const activo = player.activo !== false && player.participaRanking !== false;
        if (!activo) return;
        const pos = Number(player.pos ?? player.posicion ?? player.rank ?? player.ranking);
        byGender[genero].push({ ...player, genero, pos: Number.isFinite(pos) && pos > 0 ? pos : null });
      });
      // Si a alguien le falta la posicion explicita, igual se le asigna un
      // lugar relativo (por nombre) para que no quede fuera de la siembra.
      ['M', 'F'].forEach(genero => {
        byGender[genero].sort((a, b) => (a.pos ?? 9999) - (b.pos ?? 9999) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
        byGender[genero].forEach((player, index) => { player.livePos = index + 1; });
      });
      state.clubPlayers = [...byGender.M, ...byGender.F];
      $('clubPlayers').innerHTML = state.clubPlayers.map(p => `<option value="${esc(p.nombre)}" data-id="${esc(p.id)}">${esc(p.email || '')}</option>`).join('');
    } catch (_) {}
  }

  // Asigna la siembra (1, 2, 3...) segun la posicion actual de cada inscrito
  // en el ranking del club, no segun el orden en que se anotaron. Solo se
  // siembra a quienes tienen ficha en el ranking; el resto (externos o sin
  // ranking) queda sin sembrar, al final -- igual que en un cuadro real. El
  // admin puede seguir ajustando cualquier numero a mano despues.
  function seedFromRanking() {
    const withRanking = [];
    const withoutRanking = [];
    state.participants.forEach(participant => {
      const club = state.clubPlayers.find(p => p.id === participant.clubPlayerId);
      if (club && club.livePos) withRanking.push({ participant, livePos: club.livePos });
      else withoutRanking.push(participant);
    });
    if (!withRanking.length) return notice('Ningun inscrito tiene ficha en el ranking del club para sembrar.', true);
    withRanking.sort((a, b) => a.livePos - b.livePos);
    withRanking.forEach((entry, index) => { entry.participant.seed = index + 1; });
    withoutRanking.forEach((participant, index) => { participant.seed = withRanking.length + index + 1; });
    renderParticipants();
    notice(`Siembra actualizada segun el ranking (${withRanking.length} inscrito${withRanking.length === 1 ? '' : 's'} con ficha).`);
  }
  async function saveCurrent(message = 'Campeonato guardado.') {
    const data = await api('admin_save_tournament', { tournament:readForm() });
    state.current = data.tournament;
    await loadTournaments(state.current.id);
    notice(message);
    return state.current;
  }
  function renderParticipants() {
    const size = Number($('tourSize').value || state.current?.size || 8);
    $('capacityLabel').textContent = `(${state.participants.length}/${size})`;
    $('participantBody').innerHTML = state.participants.length ? state.participants
      .sort((a,b)=>(a.seed||99)-(b.seed||99))
      .map((p,index) => `<tr><td><input class="score-input seed-edit" type="number" min="1" max="${size}" value="${p.seed || index + 1}" data-id="${esc(p.id)}"></td><td><strong>${esc(p.name)}</strong></td><td>${p.clubMember ? 'Socio UCTenis' : 'Externo'}</td><td>${esc(p.email || p.phone || '-')}</td><td><button class="tour-btn danger remove-player" type="button" data-id="${esc(p.id)}">Quitar</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">Agrega jugadores para comenzar.</td></tr>';
  }
  function scoreFields(match) {
    const score = match.score || [];
    return [0,1,2].map(i => `<span><input class="score-input" type="number" min="0" data-score="${i}-a" value="${score[i]?.a ?? ''}" aria-label="Games jugador 1 set ${i+1}"> - <input class="score-input" type="number" min="0" data-score="${i}-b" value="${score[i]?.b ?? ''}" aria-label="Games jugador 2 set ${i+1}"></span>`).join('');
  }
  function renderMatches() {
    const matches = state.current?.matches || [];
    $('bracketPreviewLink').hidden = !(state.current?.id && matches.length);
    if (!matches.length) {
      $('adminMatches').innerHTML = '<div class="empty-state">Guarda los inscritos y genera el cuadro para programar los partidos.</div>';
      return;
    }
    const grouped = [...new Set(matches.map(m => m.round))];
    $('adminMatches').innerHTML = grouped.map(round => {
      const items = matches.filter(m => m.round === round);
      return `<div class="tour-section"><h3 class="round-title">${esc(items[0].roundName)}</h3>${items.map(match => {
        const ready = match.player1 && match.player2;
        // BYE (avance automatico por falta de rival) o VOID (ronda vacia):
        // el partido ya quedo resuelto solo, no hay nada que programar ni
        // registrar. Antes se mostraban los mismos campos que un partido
        // real pero deshabilitados, sin explicar por que -- parecia roto.
        const isSettled = match.status === 'bye' || match.status === 'void';
        if (isSettled) {
          return `<article class="match-admin match-admin-settled" data-match-id="${esc(match.id)}">
            <div><strong>${esc(match.player1?.name || 'Por definir')} vs ${esc(match.player2?.name || 'Por definir')}</strong><div class="schedule-meta">${match.status === 'bye' ? 'BYE -- avanza automáticamente, no requiere programación' : 'Sin rivales definidos en esta llave'}</div></div>
          </article>`;
        }
        return `<article class="match-admin" data-match-id="${esc(match.id)}">
          <div><strong>${esc(match.player1?.name || 'Por definir')} vs ${esc(match.player2?.name || 'Por definir')}</strong><div class="schedule-meta">${ready ? esc(match.scoreLabel || match.status) : 'Esperando el resultado de la ronda anterior'}${match.date ? ' - ' + esc(match.date + ' ' + match.slot + ' ' + (courtNames[match.courtId] || '')) : ''}</div></div>
          <div>
            <div class="match-admin-controls">
              <input type="text" class="uct-date" data-field="date" readonly autocomplete="off" value="${esc(match.date || '')}" ${ready ? '' : 'disabled'}>
              <select data-field="slot" ${ready ? '' : 'disabled'}><option value="">Hora</option>${slots.map(s=>`<option ${match.slot===s?'selected':''}>${s}</option>`).join('')}</select>
              <select data-field="courtId" ${ready ? '' : 'disabled'}><option value="">Cancha</option>${Object.entries(courtNames).map(([id,name])=>`<option value="${id}" ${match.courtId===id?'selected':''}>${name}</option>`).join('')}</select>
              <button class="tour-btn save-schedule" type="button" ${ready ? '' : 'disabled'}>Programar</button>
            </div>
            <div class="match-admin-controls" style="margin-top:8px">
              ${scoreFields(match)}
              <select data-field="walkover"><option value="">Marcador normal</option>${ready ? `<option value="${esc(match.player1.id)}">W.O. gana ${esc(match.player1.name)}</option><option value="${esc(match.player2.id)}">W.O. gana ${esc(match.player2.name)}</option>` : ''}</select>
              <button class="tour-btn primary save-result" type="button" ${ready ? '' : 'disabled'}>Publicar resultado</button>
            </div>
          </div>
        </article>`;
      }).join('')}</div>`;
    }).join('');
  }
  async function generateBracket(confirmReplace = false) {
    if (!state.current?.id) await saveCurrent('Campeonato creado. Ahora puedes generar el cuadro.');
    try {
      const data = await api('admin_generate_bracket', { id:state.current.id, confirmReplace });
      state.current = data.tournament;
      await loadTournaments(state.current.id);
      switchTab('bracket');
      notice('Cuadro generado y llaves BYE avanzadas automaticamente.');
    } catch (error) {
      if (error.data?.needsConfirmation && confirm('El cuadro actual contiene horarios o resultados. ?Deseas reemplazarlo?')) return generateBracket(true);
      throw error;
    }
  }
  function switchTab(name) {
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
    document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === name));
  }

  $('tournamentForm').addEventListener('submit', async event => {
    event.preventDefault();
    try { await saveCurrent(); } catch (e) { notice(e.message, true); }
  });
  $('newTournamentBtn').addEventListener('click', () => { state.current = blankTournament(); fillForm(state.current); renderList(); switchTab('details'); });
  $('tournamentList').addEventListener('click', event => { const item = event.target.closest('[data-id]'); if (item) selectTournament(item.dataset.id); });
  document.querySelector('.admin-tabs').addEventListener('click', event => { const tab = event.target.closest('[data-tab]'); if (tab) switchTab(tab.dataset.tab); });
  $('tourSize').addEventListener('change', renderParticipants);
  // La fecha de termino no puede quedar antes que la de inicio: se actualiza
  // el minimo seleccionable del calendario de termino, y si el valor que ya
  // tenia quedo antes del nuevo inicio, se limpia para que lo vuelvan a fijar.
  $('tourStart').addEventListener('change', () => {
    const startVal = $('tourStart').value;
    $('tourEnd').min = startVal || '';
    if (startVal && $('tourEnd').value && $('tourEnd').value < startVal) {
      $('tourEnd').value = '';
    }
  });
  $('participantName').addEventListener('change', () => {
    const p = state.clubPlayers.find(player => player.nombre.toLowerCase() === $('participantName').value.trim().toLowerCase());
    if (p) { $('participantEmail').value = p.email || ''; $('participantMember').checked = true; }
  });
  $('participantForm').addEventListener('submit', event => {
    event.preventDefault();
    const size = Number($('tourSize').value);
    if (state.participants.length >= size) return notice('El cuadro ya alcanzo su capacidad maxima.', true);
    const name = $('participantName').value.trim();
    if (state.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) return notice('Ese jugador ya esta inscrito.', true);
    const club = state.clubPlayers.find(p => p.nombre.toLowerCase() === name.toLowerCase());
    state.participants.push({id:club?.id || `ext_${Date.now().toString(36)}`,name,email:$('participantEmail').value.trim(),phone:$('participantPhone').value.trim(),clubMember:$('participantMember').checked,clubPlayerId:club?.id || '',category:club?.categoria || '',seed:state.participants.length + 1,status:'active'});
    event.target.reset();
    renderParticipants();
  });
  $('participantBody').addEventListener('click', event => {
    const btn = event.target.closest('.remove-player');
    if (btn) { state.participants = state.participants.filter(p => p.id !== btn.dataset.id); state.participants.forEach((p,i)=>p.seed=i+1); renderParticipants(); }
  });
  $('participantBody').addEventListener('change', event => {
    if (event.target.matches('.seed-edit')) {
      const player = state.participants.find(p => p.id === event.target.dataset.id);
      if (player) player.seed = Number(event.target.value);
    }
  });
  $('seedFromRankingBtn').addEventListener('click', seedFromRanking);
  $('saveParticipantsBtn').addEventListener('click', async () => { try { await saveCurrent('Nomina de inscritos guardada.'); } catch(e) { notice(e.message,true); } });
  $('generateBracketBtn').addEventListener('click', async () => { try { await saveCurrent('Inscritos guardados.'); await generateBracket(false); } catch(e) { notice(e.message,true); } });
  $('regenerateBracketBtn').addEventListener('click', async () => { try { await generateBracket(false); } catch(e) { notice(e.message,true); } });
  $('archiveTournamentBtn').addEventListener('click', async () => {
    if (!state.current?.id || !confirm('?Archivar este campeonato? Dejaria de aparecer publicamente.')) return;
    try { await api('admin_delete_tournament',{id:state.current.id}); state.current=null; await loadTournaments(); notice('Campeonato archivado.'); } catch(e) { notice(e.message,true); }
  });
  $('adminMatches').addEventListener('click', async event => {
    const row = event.target.closest('.match-admin');
    if (!row) return;
    try {
      if (event.target.closest('.save-schedule')) {
        const date=row.querySelector('[data-field=date]').value, slot=row.querySelector('[data-field=slot]').value, courtId=row.querySelector('[data-field=courtId]').value;
        if (!date || !slot || !courtId) throw new Error('Selecciona fecha, hora y cancha.');
        const data=await api('admin_schedule_match',{id:state.current.id,matchId:row.dataset.matchId,date,slot,courtId});
        state.current=data.tournament; await loadTournaments(state.current.id);
        notice(data.calendarPending ? 'Cancha bloqueada; Calendar quedo en cola de sincronizacion.' : 'Partido programado y cancha bloqueada.');
      }
      if (event.target.closest('.save-result')) {
        const sets=[0,1,2].map(i=>({a:row.querySelector(`[data-score="${i}-a"]`).value,b:row.querySelector(`[data-score="${i}-b"]`).value})).filter(s=>s.a!==''&&s.b!=='');
        const walkoverWinnerId=row.querySelector('[data-field=walkover]').value;
        if (!walkoverWinnerId && !confirm('?Publicar este marcador? El ganador avanzara automaticamente en el cuadro.')) return;
        const data=await api('admin_record_match',{id:state.current.id,matchId:row.dataset.matchId,sets,walkoverWinnerId});
        state.current=data.tournament; await loadTournaments(state.current.id);
        notice('Resultado publicado, noticia creada y cuadro actualizado.');
      }
    } catch(e) { notice(e.message,true); }
  });

  async function boot() {
    await DB.authReady();
    const session = DB.getSession();
    if (!isAdmin(session)) {
      $('adminGate').innerHTML = '<h1>Acceso administrativo</h1><p>Ingresa con una cuenta autorizada para administrar campeonatos.</p><button class="tour-btn primary" id="adminLoginBtn">Ingresar con Google</button><p><a class="tour-link" href="ranking.html">Volver al ranking</a></p>';
      $('adminLoginBtn').addEventListener('click', async () => {
        const result = await DB.loginWithGoogle();
        if (result.ok && isAdmin(result.user)) location.reload();
        else notice(result.msg || 'La cuenta no tiene permisos de administrador.', true);
      });
      return;
    }
    $('adminGate').hidden = true;
    $('adminApp').hidden = false;
    try { await Promise.all([loadTournaments(),loadClubPlayers()]); }
    catch (error) { notice(error.message,true); }
  }
  boot();
})();

