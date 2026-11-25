/**
 * UCTenis · Cumpleaños del día en la portada.
 *
 * Muestra un banner con los socios activos que cumplen años hoy (solo nombre
 * de pila, nunca la edad). Si quien visita es el cumpleañero, el saludo es
 * personal. El correo de felicitación lo envía el backend (sendBirthdayGreetings).
 */
(function () {
  'use strict';

  var ICONS = ['🎂', '🎾', '🎉', '🏆'];

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function firstName(player) {
    return String(player.nombre || '').trim().split(/\s+/)[0] || 'Socio';
  }

  // Hoy en hora de Chile, para que coincida con el correo del backend.
  function todayParts() {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-');
      return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
    } catch (e) {
      var now = new Date();
      return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    }
  }

  function isBirthday(player, today) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(player.fechaNacimiento || ''));
    if (!match) return false;
    var month = Number(match[2]);
    var day = Number(match[3]);
    var leap = (today.y % 4 === 0 && today.y % 100 !== 0) || today.y % 400 === 0;
    if (month === 2 && day === 29 && !leap) day = 28;
    return month === today.m && day === today.d;
  }

  function isActive(player) {
    return player && player.activo !== false && player.activo !== 'false';
  }

  function joinNames(names) {
    if (names.length <= 1) return names.join('');
    return names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];
  }

  function sameEmail(a, b) {
    return a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  function render(birthdays, session) {
    var box = $('birthdayBanner');
    if (!box || !birthdays.length) return;

    var mine = session && birthdays.filter(function (p) { return sameEmail(p.email, session.email); })[0];
    var others = birthdays.filter(function (p) { return p !== mine; });
    var names = birthdays.map(firstName);

    var title, text;
    if (mine) {
      title = '¡Feliz cumpleaños, ' + esc(firstName(mine)) + '!';
      text = others.length
        ? 'Hoy el club te celebra a ti' + (others.length === 1 ? ' y a ' : ', y también a ') + esc(joinNames(others.map(firstName))) + '. Que sea un día de ases y buena compañía. 🎾'
        : 'Todo el club UCTenis te desea un día lleno de buen tenis, risas y partidos ganados. Revisa tu correo: te dejamos un saludo.';
    } else if (birthdays.length === 1) {
      title = 'Hoy cumple años ' + esc(names[0]);
      text = 'Salúdalo en la cancha o desafíalo a un partido: ¡hoy se lo merece! 🎉';
    } else {
      title = 'Hoy cumplen años ' + esc(joinNames(names));
      text = 'Un día especial para el club: salúdalos en la cancha y brinden con un buen partido. 🎉';
    }

    var chips = birthdays.map(function (p, i) {
      var photo = p.foto ? '<img src="' + esc(p.foto) + '" alt="" loading="lazy" onerror="this.remove()">' : '';
      return '<span class="bday-chip"><span class="bday-chip-ico">' + (photo || ICONS[i % ICONS.length]) + '</span>' + esc(firstName(p)) + '</span>';
    }).join('');

    box.innerHTML =
      '<div class="bday-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="bday-icon" aria-hidden="true">🎂</div>' +
      '<div class="bday-body">' +
        '<span class="bday-eyebrow">Cumpleaños del día</span>' +
        '<h2>' + title + '</h2>' +
        '<p>' + text + '</p>' +
        '<div class="bday-chips">' + chips + '</div>' +
      '</div>';
    box.hidden = false;
  }

  async function init() {
    if (!$('birthdayBanner') || typeof DB === 'undefined' || !DB.isCloudConfigured) return;
    for (var attempt = 0; attempt < 24 && !DB.isCloudConfigured(); attempt++) {
      await new Promise(function (resolve) { setTimeout(resolve, 500); });
    }
    if (!DB.isCloudConfigured()) return;
    var players = await DB.getPlayersCloud();
    var today = todayParts();
    var birthdays = (players || []).filter(function (p) { return isActive(p) && isBirthday(p, today); });
    var session = typeof DB.getSession === 'function' ? DB.getSession() : null;
    render(birthdays, session);
  }

  function start() { init().catch(function () { /* el banner es opcional */ }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
