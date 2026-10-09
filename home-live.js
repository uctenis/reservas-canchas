/**
 * UCTenis · Datos en vivo de la portada.
 *
 * Llena las tres tarjetas bajo el encabezado: próxima hora libre, clima de
 * hoy y líderes del ranking. Cada tarjeta se resuelve por separado: si una
 * fuente falla, esa tarjeta muestra un texto neutro y el resto sigue igual.
 */
(function () {
  'use strict';

  var DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var MIN_ADVANCE_MS = 4 * 60 * 60 * 1000; // misma regla que reservas: 4 horas de anticipación
  var WEATHER_ICONS = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 80: '🌧️', 81: '🌧️', 82: '⛈️', 95: '⛈️' };

  function $(id) { return document.getElementById(id); }

  function setTile(prefix, value, hint) {
    var valueEl = $(prefix + 'Value');
    var hintEl = $(prefix + 'Hint');
    if (valueEl) { valueEl.textContent = value; valueEl.classList.remove('is-loading'); }
    if (hintEl && hint !== undefined) hintEl.textContent = hint;
  }

  function isoLocal(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function courtLabel(courtId) {
    var court = (typeof DB !== 'undefined' && DB.COURTS || []).find(function (c) { return c.id === courtId; });
    return court ? court.label : courtId.toUpperCase();
  }

  // ── Próxima hora libre ──────────────────────────────────────────────────
  async function loadNextSlot() {
    if (typeof DB === 'undefined' || typeof DB.getSlotsAPI !== 'function') throw new Error('sin API');
    var now = new Date();
    var minTime = now.getTime() + MIN_ADVANCE_MS;

    for (var offset = 0; offset < 5; offset++) {
      var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      if (day.getDay() === 0) continue; // el club no abre los domingos
      var data = await DB.getSlotsAPI(isoLocal(day));
      if (!data || !data.ok || !data.courts) throw new Error('sin disponibilidad');

      var best = null;
      var count = 0;
      Object.keys(data.courts).forEach(function (courtId) {
        var slots = data.courts[courtId];
        if (!Array.isArray(slots)) return;
        slots.forEach(function (slot) {
          var parts = slot.split(':').map(Number);
          var start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), parts[0], parts[1]).getTime();
          if (start < minTime) return;
          count++;
          if (!best || slot < best.slot || (slot === best.slot && courtId < best.courtId)) best = { slot: slot, courtId: courtId };
        });
      });

      if (best) {
        var when = offset === 0 ? 'Hoy' : (offset === 1 ? 'Mañana' : DAYS_SHORT[day.getDay()] + ' ' + day.getDate());
        setTile('liveSlot', when + ' · ' + best.slot, courtLabel(best.courtId) + ' · ' + count + (count === 1 ? ' horario libre' : ' horarios libres') + ' ese día');
        return;
      }
    }
    setTile('liveSlot', 'Sin cupos cercanos', 'Revisa la agenda completa');
  }

  // ── Clima de hoy ────────────────────────────────────────────────────────
  async function loadWeather() {
    var cfg = window.CONFIG || {};
    var lat = cfg.LAT || -38.7359;
    var lon = cfg.LON || -72.5904;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=America/Santiago&forecast_days=1';
    var response = await fetch(url);
    if (!response.ok) throw new Error('clima ' + response.status);
    var data = await response.json();
    var current = data.current_weather || {};
    var daily = data.daily || {};
    var max = Math.round((daily.temperature_2m_max || [])[0]);
    var rain = Math.round((daily.precipitation_probability_max || [])[0] || 0);
    var code = current.weathercode !== undefined ? current.weathercode : (daily.weathercode || [])[0];
    var temp = Math.round(current.temperature);
    if (!Number.isFinite(temp)) throw new Error('clima sin datos');

    var hint = rain >= 60 ? 'Lluvia ' + rain + '% · mejor cancha de asfalto'
      : rain >= 30 ? 'Posible lluvia (' + rain + '%)' + (Number.isFinite(max) ? ' · máx ' + max + '°' : '')
      : 'Buen día para jugar' + (Number.isFinite(max) ? ' · máx ' + max + '°' : '');
    setTile('liveWeather', (WEATHER_ICONS[code] || '🌡️') + ' ' + temp + '°C', hint);
  }

  // ── Líderes del ranking ─────────────────────────────────────────────────
  function isActivePlayer(player) {
    return player && player.activo !== false && player.participaRanking !== false;
  }

  // Mismo criterio que el resto de la portada: 'posicion' y, si no, 'pos'.
  function positionOf(player) {
    var pos = Number(player.posicion != null ? player.posicion : player.pos);
    return Number.isFinite(pos) ? pos : 0;
  }

  function leaderOf(players, gender) {
    return players
      .filter(function (p) {
        var g = String(p.gender || p.genero || '').trim().toUpperCase().charAt(0);
        return g === gender && isActivePlayer(p) && positionOf(p) > 0;
      })
      .sort(function (a, b) { return positionOf(a) - positionOf(b); })[0] || null;
  }

  async function loadLeaders() {
    if (typeof DB === 'undefined' || !DB.isCloudConfigured) throw new Error('sin base de datos');
    // La conexión a la base de datos se inicializa después de cargar la
    // página: se espera hasta 12 segundos antes de darla por no disponible.
    for (var attempt = 0; attempt < 24 && !DB.isCloudConfigured(); attempt++) {
      await new Promise(function (resolve) { setTimeout(resolve, 500); });
    }
    if (!DB.isCloudConfigured()) throw new Error('sin base de datos');
    var players = await DB.getPlayersCloud();
    var male = leaderOf(players, 'M');
    var female = leaderOf(players, 'F');
    var first = male || female;
    if (!first) throw new Error('sin ranking');

    var photo = $('liveLeaderPhoto');
    if (photo) {
      var fallback = 'fotos/default_avatar_' + (first === male ? 'h' : 'm') + '.png';
      photo.onerror = function () { photo.onerror = null; photo.src = fallback; };
      photo.src = first.foto || ('fotos/' + first.id + '.png');
      photo.hidden = false;
      var icon = $('liveLeaderIcon');
      if (icon) icon.hidden = true;
    }
    var other = first === male ? female : null;
    setTile('liveLeader', first.nombre, other ? 'Femenino: ' + other.nombre : (first === male ? 'Ranking masculino' : 'Ranking femenino'));
  }

  function init() {
    if (!$('homeLive')) return;
    loadNextSlot().catch(function () { setTile('liveSlot', 'Ver disponibilidad', 'Revisa la agenda completa'); });
    loadWeather().catch(function () { setTile('liveWeather', 'Sin datos', 'No se pudo consultar el clima'); });
    loadLeaders().catch(function () { setTile('liveLeader', 'Ver ranking', 'Escalerilla oficial del club'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
