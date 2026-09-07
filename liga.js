(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UCTennisLeague = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const COMPLETED_STATUSES = new Set(['completado', 'wo_retador', 'wo_retado']);
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
    // Ancla de lanzamiento: lunes 14 de septiembre de 2026, arranque oficial
    // de la Liga UCTenis (Semana 1 del primer ciclo). Es lunes, así que
    // todos los ciclos futuros caen en múltiplos exactos de "weeks" semanas
    // contados desde esta fecha. Fechas anteriores al lanzamiento se anclan
    // al primer ciclo: no existen "ciclos fantasma" antes de que la liga
    // exista.
    const epoch = Date.UTC(2026, 8, 14);
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
    return String(score || '').split(',').map(part => part.trim()).filter(Boolean).reduce((stats, set) => {
      const match = set.match(/^(\d+)\s*[-/]\s*(\d+)/);
      if (!match) return stats;
      const first = Number(match[1]);
      const second = Number(match[2]);
      if (first > second) stats.a++;
      if (second > first) stats.b++;
      return stats;
    }, { a: 0, b: 0 });
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

  return { DEFAULT_RULES, getCycle, isLeagueMatch, calculateStandings };
});