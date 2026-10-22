(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UCTennisLeague = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const COMPLETED_STATUSES = new Set(['completado', 'wo_retador', 'wo_retado']);
  const DEAD_STATUSES = new Set(['eliminado', 'rechazado', 'vencido']);

  // ════════════════════════════════════════════════════════════════════════
  // Campeonato de Liga por temporadas (bases oficiales 2026)
  // ════════════════════════════════════════════════════════════════════════
  //
  // Todos contra todos por "fechas": cada fecha empareja a todos los
  // inscritos de una categoría con un rival y dura una ventana de ~10 días.
  // El fixture se deriva del orden de inscripción (o del número sorteado por
  // la comisión), así que no necesita guardarse aparte: la inscripción vive
  // en la ficha de cada jugador (campo `season.field`) y los partidos son
  // desafíos tipo "liga" entre la pareja, que en un todos contra todos se
  // enfrenta una sola vez.

  const SEASONS = Object.freeze([
    Object.freeze({
      id: '2026',
      nombre: 'Campeonato de Liga UCTenis 2026',
      field: 'liga2026',
      inicio: '2026-11-01',
      // Bases §3: la inscripción se cierra cuando parte la liga.
      cierreInscripcion: '2026-10-31',
      // Bases, "Fechas y su franja de calendario". Si hay más inscritos que
      // fechas oficiales, getRoundWindow() continúa el mismo patrón.
      ventanas: Object.freeze([
        ['2026-11-01', '2026-11-10'],
        ['2026-11-10', '2026-11-20'],
        ['2026-11-20', '2026-11-30'],
        ['2026-12-01', '2026-12-10'],
        ['2026-12-10', '2026-12-20'],
        ['2026-12-20', '2026-12-31'],
        ['2027-01-01', '2027-01-10'],
        ['2027-01-10', '2027-01-20'],
        ['2027-01-20', '2027-01-30']
      ]),
      // Bases §5: 3 ganador, 1 perdedor, 0 no presentación.
      puntos: Object.freeze({ victoria: 3, derrota: 1, noPresentacion: 0 }),
      formato: 'Tres sets normales, el tercero a Tie Break'
    })
  ]);

  // Estados de cada partido del fixture.
  const PAIRING_STATES = Object.freeze({
    proximo: 'Próxima fecha',
    por_agendar: 'Por agendar',
    invitado: 'Invitación enviada',
    agendado: 'Agendado',
    por_confirmar: 'Resultado por confirmar',
    jugado: 'Jugado',
    wo: 'W.O.',
    wo_doble: 'W.O. doble',
    libre: 'Fecha libre'
  });

  function getSeason(id) {
    if (id) return SEASONS.find(season => season.id === String(id)) || null;
    return SEASONS[SEASONS.length - 1];
  }

  // Fecha "de hoy" en Chile, que es la que manda para abrir y cerrar fechas.
  function todayIso(now = new Date()) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    } catch (e) {
      return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }
  }

  function addDays(iso, days) {
    const date = parseIsoDate(iso);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function daysBetween(fromIso, toIso) {
    return Math.round((parseIsoDate(toIso) - parseIsoDate(fromIso)) / 86400000);
  }

  function lastDayOfMonth(iso) {
    const date = parseIsoDate(iso);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  }

  // Ventana de la fecha `round` (1-indexada). Más allá de las oficiales
  // sigue el patrón de las bases: 1–10, 10–20 y 20–fin de mes.
  function getRoundWindow(season, round) {
    const official = season.ventanas[round - 1];
    if (official) return { start: official[0], end: official[1] };
    let [, end] = season.ventanas[season.ventanas.length - 1];
    let window = null;
    for (let index = season.ventanas.length; index < round; index++) {
      const day = Number(end.slice(8, 10));
      if (day === 10) window = { start: end, end: `${end.slice(0, 8)}20` };
      else if (day === 20) window = { start: end, end: lastDayOfMonth(end) };
      else {
        const start = addDays(lastDayOfMonth(end), 1);
        window = { start, end: `${start.slice(0, 8)}10` };
      }
      end = window.end;
    }
    return window;
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  }

  function normalizeGender(value) {
    const raw = normalizeText(value);
    if (['f', 'femenino', 'female', 'mujer', 'mujeres', 'damas', 'dama'].includes(raw)) return 'F';
    if (['m', 'masculino', 'male', 'hombre', 'hombres', 'varones', 'varon'].includes(raw)) return 'M';
    return '';
  }

  function playerKey(player) {
    return String(player?.id || normalizeText(player?.email) || normalizeText(player?.nombre) || '');
  }

  function pairKey(a, b) {
    return [playerKey(a), playerKey(b)].sort().join('__');
  }

  function getEnrollment(player, season = getSeason()) {
    const raw = player && player[season.field];
    if (!raw || typeof raw !== 'object') return null;
    if (raw.inscrito !== true && raw.inscrito !== 'true' && raw.retirado !== true) return null;
    return raw;
  }

  function isEnrolled(player, season = getSeason()) {
    const enrollment = getEnrollment(player, season);
    return Boolean(enrollment && enrollment.retirado !== true);
  }

  // Inscritos de una categoría en el orden que fija su número en el
  // fixture: primero el número sorteado, luego el orden de inscripción.
  // Quien se retira con la liga en curso conserva su número para no
  // reordenar los cruces de todos los demás.
  function getEntrants(players, season = getSeason(), gender) {
    return (Array.isArray(players) ? players : [])
      .filter(player => player && getEnrollment(player, season))
      .filter(player => !gender || normalizeGender(player.genero || player.gender) === gender)
      .map(player => ({ player, enrollment: getEnrollment(player, season) }))
      .sort((a, b) => {
        const numA = Number(a.enrollment.numero) || Infinity;
        const numB = Number(b.enrollment.numero) || Infinity;
        return numA - numB ||
          String(a.enrollment.inscritoEn || '').localeCompare(String(b.enrollment.inscritoEn || '')) ||
          String(a.player.nombre || '').localeCompare(String(b.player.nombre || ''), 'es');
      })
      .map(({ player, enrollment }, index) => ({
        key: playerKey(player),
        id: player.id || '',
        nombre: player.nombre || 'Jugador',
        email: String(player.email || '').toLowerCase(),
        foto: player.foto || '',
        categoria: player.categoria || '',
        genero: normalizeGender(player.genero || player.gender),
        numero: index + 1,
        sorteado: Boolean(Number(enrollment.numero)),
        retirado: enrollment.retirado === true,
        retiradoEn: isoDate(enrollment.retiradoEn),
        excepciones: enrollment.excepciones && typeof enrollment.excepciones === 'object' ? enrollment.excepciones : {},
        player
      }));
  }

  // Todos contra todos por el método del círculo: con N inscritos son N-1
  // fechas (N si es impar, y cada fecha alguien queda libre).
  function buildRoundRobin(entrants) {
    const seats = entrants.slice();
    if (seats.length < 2) return [];
    if (seats.length % 2) seats.push(null);
    const total = seats.length;
    const rounds = [];
    let ring = seats.slice();
    for (let round = 0; round < total - 1; round++) {
      const pairs = [];
      let bye = null;
      for (let i = 0; i < total / 2; i++) {
        let a = ring[i];
        let b = ring[total - 1 - i];
        if (i === 0 && round % 2) [a, b] = [b, a];
        if (!a || !b) bye = a || b;
        else pairs.push([a, b]);
      }
      rounds.push({ pairs, bye });
      ring = [ring[0], ring[total - 1], ...ring.slice(1, total - 1)];
    }
    return rounds;
  }

  // El id guardado en un desafío puede ser el id local de la sesión y no
  // el de la ficha, así que el correo manda cuando ambos lo tienen.
  function sideMatches(entrant, match, side) {
    if (!entrant || !match) return false;
    const player = entrant.player || entrant;
    const email = String(match[`${side}Email`] || '').trim().toLowerCase();
    if (email && entrant.email) return email === entrant.email;
    const id = String(match[`${side}Id`] || '');
    if (id && (id === String(player.id || '') || id === String(player.localId || ''))) return true;
    const name = normalizeText(match[`${side}Nombre`]);
    return Boolean(name && name === normalizeText(entrant.nombre));
  }

  function matchInvolves(match, a, b) {
    return (sideMatches(a, match, 'retador') && sideMatches(b, match, 'retado')) ||
      (sideMatches(b, match, 'retador') && sideMatches(a, match, 'retado'));
  }

  function matchPlayDate(match) {
    return isoDate(match?.fecha || match?.fechaResultado || match?.actualizado);
  }

  // Partido de liga que corresponde a esta temporada: marcado con la
  // temporada al agendarlo o, si es anterior a esa marca, jugado desde el
  // inicio de la liga.
  function isSeasonMatch(match, season) {
    if (!match || match.tipo !== 'liga' || match.status === 'eliminado') return false;
    if (match.ligaTemporada) return String(match.ligaTemporada) === season.id;
    return matchPlayDate(match) >= season.inicio;
  }

  const STATUS_PRIORITY = { completado: 0, wo_retador: 0, wo_retado: 0, resultado_pendiente: 1, aceptado: 2, pendiente: 3 };

  function parseScore(score) {
    return String(score || '').split(',').map(part => part.trim()).filter(Boolean).map(set => {
      const found = set.match(/^(\d+)\s*[-/]\s*(\d+)/);
      return found ? [Number(found[1]), Number(found[2])] : null;
    }).filter(Boolean);
  }

  // Sets y games desde la óptica del retador. El tercer set se juega a Tie
  // Break (bases §10): cuenta como set, pero solo como un game para no
  // inflar la diferencia con los puntos del desempate.
  function scoreStats(score) {
    return parseScore(score).reduce((stats, [a, b], index) => {
      if (a > b) stats.setsA++;
      if (b > a) stats.setsB++;
      const isMatchTiebreak = index === 2 && Math.max(a, b) >= 10;
      stats.gamesA += isMatchTiebreak ? (a > b ? 1 : 0) : a;
      stats.gamesB += isMatchTiebreak ? (b > a ? 1 : 0) : b;
      return stats;
    }, { setsA: 0, setsB: 0, gamesA: 0, gamesB: 0 });
  }

  function winnerSideOf(match) {
    const winner = String(match?.ganadorId || '');
    if (match?.status === 'wo_retador') return 'retado';
    if (match?.status === 'wo_retado') return 'retador';
    if (!winner) return '';
    if (winner === String(match.retadorId || '') || winner.toLowerCase() === String(match.retadorEmail || '').toLowerCase()) return 'retador';
    if (winner === String(match.retadoId || '') || winner.toLowerCase() === String(match.retadoEmail || '').toLowerCase()) return 'retado';
    if (normalizeText(winner) === normalizeText(match.retadorNombre)) return 'retador';
    if (normalizeText(winner) === normalizeText(match.retadoNombre)) return 'retado';
    return '';
  }

  function exceptionFor(a, b) {
    const key = pairKey(a, b);
    const dates = [a.excepciones?.[key], b.excepciones?.[key]].map(isoDate).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : '';
  }

  // Determina en qué quedó un cruce del fixture.
  function resolvePairing(a, b, window, seasonMatches, today) {
    const exception = exceptionFor(a, b);
    const deadline = exception && exception > window.end ? exception : window.end;
    const related = seasonMatches
      .filter(match => matchInvolves(match, a, b) && !DEAD_STATUSES.has(match.status))
      .sort((x, y) => (STATUS_PRIORITY[x.status] ?? 9) - (STATUS_PRIORITY[y.status] ?? 9) ||
        String(y.actualizado || '').localeCompare(String(x.actualizado || '')));
    const match = related[0] || null;
    const base = { a, b, window, deadline, exception, match, home: null, away: null };
    const sides = match ? (sideMatches(a, match, 'retador') ? { retador: a, retado: b } : { retador: b, retado: a }) : null;

    if (match && COMPLETED_STATUSES.has(match.status)) {
      const played = matchPlayDate(match);
      if (played && played > deadline && match.ligaExcepcion !== true) {
        // Bases §9: una fecha vencida no se juega en forma retroactiva.
        return { ...base, state: 'wo_doble', fueraDePlazo: true };
      }
      const winnerSide = winnerSideOf(match);
      if (!winnerSide) return { ...base, state: 'por_confirmar' };
      const loserSide = winnerSide === 'retador' ? 'retado' : 'retador';
      const isWo = match.status === 'wo_retador' || match.status === 'wo_retado';
      const stats = scoreStats(match.marcador);
      const flip = winnerSide === 'retado';
      const sets = parseScore(match.marcador);
      return {
        ...base,
        state: isWo ? 'wo' : 'jugado',
        winner: sides[winnerSide],
        loser: sides[loserSide],
        score: match.marcador || '',
        // Marcador desde la óptica del ganador, para mostrarlo.
        winnerScore: isWo ? 'W.O.' : sets.map(([x, y]) => flip ? `${y}-${x}` : `${x}-${y}`).join(', '),
        // Games de cada set por jugador, para pintar el marcador por fila.
        setsBy: isWo ? {} : { [sides.retador.key]: sets.map(set => set[0]), [sides.retado.key]: sets.map(set => set[1]) },
        sets: isWo ? null : { winner: flip ? stats.setsB : stats.setsA, loser: flip ? stats.setsA : stats.setsB },
        games: isWo ? null : { winner: flip ? stats.gamesB : stats.gamesA, loser: flip ? stats.gamesA : stats.gamesB },
        date: played
      };
    }

    // Un retiro con la liga en curso entrega los cruces pendientes por W.O.
    const aOut = a.retirado && (!a.retiradoEn || a.retiradoEn <= deadline);
    const bOut = b.retirado && (!b.retiradoEn || b.retiradoEn <= deadline);
    if (aOut || bOut) {
      if (aOut && bOut) return { ...base, state: 'wo_doble', retiro: true };
      return { ...base, state: 'wo', retiro: true, winner: aOut ? b : a, loser: aOut ? a : b, winnerScore: 'W.O.' };
    }

    if (match && match.status === 'resultado_pendiente') {
      return { ...base, state: 'por_confirmar', date: matchPlayDate(match) };
    }
    if (today > deadline) {
      // Bases §8: si no se juega dentro del plazo, W.O. para ambos.
      return { ...base, state: 'wo_doble' };
    }
    if (match && match.status === 'aceptado') return { ...base, state: 'agendado', date: matchPlayDate(match), slot: match.slot || '', cancha: match.cancha || '' };
    if (match && match.status === 'pendiente') return { ...base, state: 'invitado', date: matchPlayDate(match), slot: match.slot || '', cancha: match.cancha || '', invitedBy: sides.retador };
    return { ...base, state: today < window.start ? 'proximo' : 'por_agendar' };
  }

  function emptyRow(entrant) {
    return {
      key: entrant.key, id: entrant.id, nombre: entrant.nombre, foto: entrant.foto, categoria: entrant.categoria,
      numero: entrant.numero, retirado: entrant.retirado,
      pts: 0, pj: 0, pg: 0, pp: 0, woGanados: 0, woPerdidos: 0, woDobles: 0,
      setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0, forma: [], pendientes: 0
    };
  }

  // Bases §6: 4, 6 u 8 clasificados al Torneo de Maestros según inscritos.
  function mastersSize(count) {
    const size = count >= 12 ? 8 : count >= 8 ? 6 : 4;
    return Math.min(size, count);
  }

  function compareSecondary(a, b) {
    return b.pg - a.pg ||
      (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst) ||
      (b.gamesFor - b.gamesAgainst) - (a.gamesFor - a.gamesAgainst) ||
      a.woPerdidos - b.woPerdidos ||
      a.nombre.localeCompare(b.nombre, 'es');
  }

  // Desempate: puntos; si empatan exactamente dos, manda el partido entre
  // ellos; después partidos ganados, diferencia de sets y de games.
  function sortStandings(rows, headToHead) {
    const sorted = rows.slice().sort((a, b) => b.pts - a.pts || compareSecondary(a, b));
    for (let i = 0; i < sorted.length; i++) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].pts === sorted[i].pts) j++;
      if (j === i + 1) {
        const winner = headToHead.get([sorted[i].key, sorted[j].key].sort().join('__'));
        if (winner === sorted[j].key) [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
        if (winner) sorted[i].desempate = sorted[j].desempate = 'Enfrentamiento directo';
      }
      i = j;
    }
    return sorted.map((row, index) => ({ ...row, pos: index + 1 }));
  }

  function getPhase(season, rounds, today) {
    if (today < season.inicio) return 'inscripcion';
    const last = rounds.length ? rounds[rounds.length - 1].window.end : season.ventanas[season.ventanas.length - 1][1];
    return today > last ? 'maestros' : 'en_juego';
  }

  /**
   * Vista completa de una categoría: fixture con el estado de cada cruce,
   * tabla de posiciones y zona de clasificación al Torneo de Maestros.
   */
  function buildSeasonView(players, matches, options = {}) {
    const season = options.season || getSeason();
    const gender = options.gender || 'M';
    const today = options.today || todayIso();
    const points = season.puntos;
    const entrants = getEntrants(players, season, gender);
    const seasonMatches = (Array.isArray(matches) ? matches : []).filter(match => isSeasonMatch(match, season));
    const rows = new Map(entrants.map(entrant => [entrant.key, emptyRow(entrant)]));
    const headToHead = new Map();

    const rounds = buildRoundRobin(entrants).map((round, index) => {
      const number = index + 1;
      const window = getRoundWindow(season, number);
      const partidos = round.pairs.map(([a, b]) => resolvePairing(a, b, window, seasonMatches, today));
      partidos.forEach(partido => {
        const rowA = rows.get(partido.a.key);
        const rowB = rows.get(partido.b.key);
        if (partido.state === 'jugado' || partido.state === 'wo') {
          const winner = rows.get(partido.winner.key);
          const loser = rows.get(partido.loser.key);
          const isWo = partido.state === 'wo';
          winner.pts += points.victoria;
          loser.pts += isWo ? points.noPresentacion : points.derrota;
          winner.pj++; loser.pj++;
          winner.pg++; loser.pp++;
          if (isWo) { winner.woGanados++; loser.woPerdidos++; }
          if (partido.sets) {
            winner.setsFor += partido.sets.winner; winner.setsAgainst += partido.sets.loser;
            loser.setsFor += partido.sets.loser; loser.setsAgainst += partido.sets.winner;
            winner.gamesFor += partido.games.winner; winner.gamesAgainst += partido.games.loser;
            loser.gamesFor += partido.games.loser; loser.gamesAgainst += partido.games.winner;
          }
          winner.forma.push({ r: isWo ? 'WG' : 'G', fecha: number });
          loser.forma.push({ r: isWo ? 'WP' : 'P', fecha: number });
          headToHead.set([partido.a.key, partido.b.key].sort().join('__'), partido.winner.key);
        } else if (partido.state === 'wo_doble') {
          rowA.woDobles++; rowB.woDobles++;
          rowA.forma.push({ r: 'WD', fecha: number });
          rowB.forma.push({ r: 'WD', fecha: number });
        } else if (window.start <= today) {
          rowA.pendientes++; rowB.pendientes++;
        }
      });
      const open = window.start <= today && today <= window.end;
      const closed = today > window.end;
      const done = partidos.length > 0 && partidos.every(p => ['jugado', 'wo', 'wo_doble'].includes(p.state));
      return { numero: number, window, partidos, libre: round.bye, open, closed, done };
    });

    const standings = sortStandings(Array.from(rows.values()), headToHead).map(row => ({
      ...row,
      forma: row.forma.slice(-5),
      diffSets: row.setsFor - row.setsAgainst,
      diffGames: row.gamesFor - row.gamesAgainst
    }));
    const mastersCount = mastersSize(entrants.length);
    standings.forEach(row => { row.maestros = row.pos <= mastersCount; });

    const openRounds = rounds.filter(round => round.open);
    const currentRound = openRounds[0] || rounds.find(round => today < round.window.start) || rounds[rounds.length - 1] || null;
    const totalPartidos = rounds.reduce((sum, round) => sum + round.partidos.length, 0);
    const resueltos = rounds.reduce((sum, round) => sum + round.partidos.filter(p => ['jugado', 'wo', 'wo_doble'].includes(p.state)).length, 0);

    return {
      season, gender, today,
      phase: getPhase(season, rounds, today),
      entrants, rounds, standings,
      maestros: mastersCount,
      currentRound, openRounds,
      progress: { total: totalPartidos, resueltos, pct: totalPartidos ? Math.round((resueltos / totalPartidos) * 100) : 0 },
      drawDone: entrants.length > 0 && entrants.every(entrant => entrant.sorteado)
    };
  }

  function findEntrant(view, ref) {
    if (!view || !ref) return null;
    const id = String(ref.id || '');
    const email = String(ref.email || '').trim().toLowerCase();
    return view.entrants.find(entrant =>
      (id && (entrant.id === id || String(entrant.player.localId || '') === id)) ||
      (email && entrant.email === email)
    ) || null;
  }

  // Cruces de un jugador, fecha por fecha.
  function getPlayerFixture(view, entrant) {
    if (!view || !entrant) return [];
    return view.rounds.map(round => {
      const partido = round.partidos.find(p => p.a.key === entrant.key || p.b.key === entrant.key) || null;
      const rival = partido ? (partido.a.key === entrant.key ? partido.b : partido.a) : null;
      return { round, partido, rival, libre: !partido && round.libre && round.libre.key === entrant.key };
    });
  }

  // Cruces que el jugador puede agendar ahora: fechas en curso o próximas,
  // sin resultado y cuyo plazo no ha vencido.
  function getSchedulablePairings(view, entrant) {
    return getPlayerFixture(view, entrant)
      .filter(item => item.partido && ['por_agendar', 'proximo'].includes(item.partido.state) && view.today <= item.partido.deadline)
      .filter(item => !item.rival.retirado);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Liga semanal (ciclos de 6 semanas, sep–nov 2026). Se mantiene para el
  // historial de ese ciclo y lo que todavía lo muestra.
  // ════════════════════════════════════════════════════════════════════════
  const DEFAULT_RULES = Object.freeze({
    win: 3,
    loss: 1,
    played: 2,
    weeklyBonus: 1,
    weeks: 6,
    // Jugadores poco motivados no siempre llegan a jugar las 6 semanas del
    // ciclo; exigir el 100% para el bono descartaba a casi todos. Con 4 de
    // 6 alcanza para seguir premiando la constancia sin ser todo-o-nada.
    weeklyBonusMinWeeks: 4
  });

  function mergeRules(rules) {
    return { ...DEFAULT_RULES, ...(rules || {}) };
  }

  function isoDate(value) {
    const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }

  function parseIsoDate(value) {
    const date = isoDate(value);
    if (!date) return null;
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function getCycleStart(value, weeks = DEFAULT_RULES.weeks) {
    const date = parseIsoDate(value) || new Date();
    const day = date.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + mondayOffset));
    // Ancla de lanzamiento: lunes 21 de septiembre de 2026, arranque oficial
    // de la Liga UCTenis (Semana 1 del primer ciclo). Es lunes, así que
    // todos los ciclos futuros caen en múltiplos exactos de "weeks" semanas
    // contados desde esta fecha. Fechas anteriores al lanzamiento se anclan
    // al primer ciclo: no existen "ciclos fantasma" antes de que la liga
    // exista.
    const epoch = Date.UTC(2026, 8, 21);
    if (monday.getTime() < epoch) return new Date(epoch).toISOString().slice(0, 10);
    const cycleDays = weeks * 7;
    const daysSinceEpoch = Math.floor((monday.getTime() - epoch) / 86400000);
    const cycleOffset = Math.floor(daysSinceEpoch / cycleDays) * cycleDays;
    return new Date(epoch + cycleOffset * 86400000).toISOString().slice(0, 10);
  }

  function getCycle(value, rules) {
    const resolved = mergeRules(rules);
    const start = getCycleStart(value, resolved.weeks);
    const startDate = parseIsoDate(start);
    const endDate = new Date(startDate.getTime() + (resolved.weeks * 7 - 1) * 86400000);
    return {
      id: `liga-${start}`,
      start,
      end: endDate.toISOString().slice(0, 10),
      weeks: resolved.weeks
    };
  }

  function getPlayerId(match, side) {
    return match?.[`${side}Id`] || match?.[`${side}Email`] || match?.[`${side}Nombre`] || '';
  }

  function getWinnerSide(match) {
    const winner = String(match?.ganadorId || '');
    if (!winner) return '';
    if (winner === String(getPlayerId(match, 'retador'))) return 'retador';
    if (winner === String(getPlayerId(match, 'retado'))) return 'retado';
    return '';
  }

  function getSetStats(score) {
    const stats = scoreStats(score);
    return { a: stats.setsA, b: stats.setsB };
  }

  function isLeagueMatch(match, cycle) {
    if (!match || !COMPLETED_STATUSES.has(match.status)) return false;
    if (match.tipo !== 'liga') return false;
    const date = isoDate(match.fechaResultado || match.fecha || match.actualizado);
    return Boolean(date && date >= cycle.start && date <= cycle.end);
  }

  function calculateStandings(players, matches, cycle, rules) {
    const resolved = mergeRules(rules);
    const rows = new Map();
    (Array.isArray(players) ? players : []).filter(Boolean).forEach(player => {
      const id = player.id || player.email || player.nombre;
      if (!id) return;
      rows.set(String(id), {
        id: String(id),
        nombre: player.nombre || 'Jugador',
        genero: player.genero || player.gender || '',
        categoria: player.categoria || '',
        pts: 0,
        pj: 0,
        pg: 0,
        pp: 0,
        setsFor: 0,
        setsAgainst: 0,
        weeks: new Set()
      });
    });

    const leagueMatches = (Array.isArray(matches) ? matches : [])
      .filter(match => isLeagueMatch(match, cycle))
      .sort((a, b) => isoDate(a.fechaResultado || a.fecha || a.actualizado).localeCompare(isoDate(b.fechaResultado || b.fecha || b.actualizado)));

    // Un jugador puede revanchar al mismo rival varias veces en el ciclo,
    // pero solo el primer resultado entre ese par suma puntaje/estadisticas:
    // evita que alguien farmee puntos jugando siempre contra el mismo rival
    // mas debil. Las revanchas igual cuentan para el bono de constancia
    // semanal (jugar es jugar), solo no duplican pts/pj/pg/sets.
    const scoredPairs = new Set();

    leagueMatches.forEach(match => {
      const winnerSide = getWinnerSide(match);
      if (!winnerSide) return;
      const loserSide = winnerSide === 'retador' ? 'retado' : 'retador';
      const winnerId = String(getPlayerId(match, winnerSide));
      const loserId = String(getPlayerId(match, loserSide));
      if (!rows.has(winnerId)) rows.set(winnerId, { id: winnerId, nombre: match[`${winnerSide}Nombre`] || 'Jugador', genero: match.genero || '', categoria: '', pts: 0, pj: 0, pg: 0, pp: 0, setsFor: 0, setsAgainst: 0, weeks: new Set() });
      if (!rows.has(loserId)) rows.set(loserId, { id: loserId, nombre: match[`${loserSide}Nombre`] || 'Jugador', genero: match.genero || '', categoria: '', pts: 0, pj: 0, pg: 0, pp: 0, setsFor: 0, setsAgainst: 0, weeks: new Set() });

      const winner = rows.get(winnerId);
      const loser = rows.get(loserId);
      const date = parseIsoDate(match.fechaResultado || match.fecha || match.actualizado);
      const week = date ? Math.floor((date - parseIsoDate(cycle.start)) / 86400000 / 7) : 0;
      winner.weeks.add(week); loser.weeks.add(week);

      const pairKey = [winnerId, loserId].sort().join('__');
      if (scoredPairs.has(pairKey)) return;
      scoredPairs.add(pairKey);

      const stats = getSetStats(match.marcador);
      const winnerSets = winnerSide === 'retador' ? stats.a : stats.b;
      const loserSets = winnerSide === 'retador' ? stats.b : stats.a;

      winner.pj++; winner.pg++; winner.pts += resolved.played + resolved.win;
      loser.pj++; loser.pp++; loser.pts += resolved.played + resolved.loss;
      winner.setsFor += winnerSets; winner.setsAgainst += loserSets;
      loser.setsFor += loserSets; loser.setsAgainst += winnerSets;
    });

    rows.forEach(row => {
      if (row.weeks.size >= resolved.weeklyBonusMinWeeks) row.pts += resolved.weeklyBonus;
      row.semanas = row.weeks.size;
      delete row.weeks;
      row.diffSets = row.setsFor - row.setsAgainst;
    });

    return Array.from(rows.values()).sort((a, b) =>
      b.pts - a.pts || b.pg - a.pg || b.diffSets - a.diffSets || b.pj - a.pj || a.nombre.localeCompare(b.nombre, 'es')
    ).map((row, index) => ({ ...row, pos: index + 1 }));
  }

  return {
    // Temporadas
    SEASONS, PAIRING_STATES,
    getSeason, todayIso, addDays, daysBetween, getRoundWindow, normalizeGender,
    playerKey, pairKey, getEnrollment, isEnrolled, getEntrants, buildRoundRobin,
    isSeasonMatch, scoreStats, mastersSize, buildSeasonView, findEntrant,
    getPlayerFixture, getSchedulablePairings,
    // Liga semanal (ciclo anterior)
    DEFAULT_RULES, getCycle, isLeagueMatch, calculateStandings
  };
});
