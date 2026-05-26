/**
 * UCTenis - Sistema de Reservas y Sincronización
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Ve a script.google.com y crea un nuevo proyecto.
 * 2. Pega todo este código en el archivo "Código.gs".
 * 3. Configura los IDs de los 4 calendarios de las canchas y el ID de tu Google Sheet con los miembros.
 * 4. Haz clic en "Implementar" -> "Nueva implementación".
 * 5. Selecciona tipo "Aplicación web".
 * 6. Ejecutar como: "Tú" y Quién tiene acceso: "Cualquier persona".
 * 7. Copia la "URL de la aplicación web" y ponla en tu archivo script.js como API_URL.
 */

// =======================================================
// ⚙️ CONFIGURACIÓN DEL SISTEMA
// =======================================================
const CONFIG = {
  // 1. ID de la hoja de cálculo de Google Sheets con la lista de miembros
  // Debes tener una columna con los correos de los miembros permitidos
  SHEET_MIEMBROS_ID: "1daJNs_3BA8Enagm61KwBDZee3SFUer-zirRFW2ID_nE", 

  // Perfil administrador dentro de la pagina.
  // Si quieres endurecerlo mas, agrega un ADMIN_PIN y envialo desde el front.
  ADMINS: {
    emails: ["ucteniclub@gmail.com", "dsilva@uct.cl"],
    names: ["UCTenis Club", "David Silva"]
  },
  ADMIN_PIN: "",
  PHOTO_FOLDER_NAME: "UCTenis fotos jugadores",
  
  // 2. IDs de los 4 Google Calendars para cada cancha
  // Ve a Configuración del Calendario -> Integrar el calendario -> ID del calendario
  CALENDARS: {
    "cec1": "e500541f01f115243cc82fdd8cb8af53885461cb6d91e8f6e2c22ed07557c23c@group.calendar.google.com",
    "cec2": "5ed0d53a5c6913b60c1886bd04748fac22783d81209501200038e5dc6352b323@group.calendar.google.com",
    "cjp1": "9c053fe813a0903f56d9aa39efa99dc495dc041115b662940e5d1735bec43ff3@group.calendar.google.com",
    "cjp2": "0562d62a2046c1253e0f7b0e9f3d0c11dd850e79219eb050aa1a9770cf6b7702@group.calendar.google.com"
  },
  
  // 3. Horarios permitidos (Bloques de 1.5 hrs)
  SLOTS: ['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00'],
  
  // Puedes configurar las franjas horarias permitidas por cancha.
  // Puede ser un array simple (mismos horarios todos los días) o un objeto mapeado por día de la semana.
  // Días: 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado.
  // Ejemplo:
  //   cec1: {
  //     1: ['18:00', '19:30', '21:00'], // Lunes de 18 a 22:30
  //     6: ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00'], // Sábados
  //     0: [], // Domingos cerrado
  //     default: ['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00']
  //   }
  COURT_SLOTS: {
    cec1: {
      1: ['18:00', '19:30', '21:00'], // Lunes
      2: ['18:00', '19:30', '21:00'], // Martes
      3: ['18:00', '19:30', '21:00'], // Miércoles
      4: ['18:00', '19:30', '21:00'], // Jueves
      5: ['18:00', '19:30', '21:00'], // Viernes
      6: ['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00'], // Sábado
      0: [] // Domingo (Cerrado)
    },
    cec2: {
      1: ['18:00', '19:30', '21:00'], // Lunes
      2: ['18:00', '19:30', '21:00'], // Martes
      3: ['18:00', '19:30', '21:00'], // Miércoles
      4: ['18:00', '19:30', '21:00'], // Jueves
      5: ['18:00', '19:30', '21:00'], // Viernes
      6: ['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00'], // Sábado
      0: [] // Domingo (Cerrado)
    },
    cjp1: {
      1: ['20:00'], // Lunes (20:00 a 21:30)
      2: ['18:00', '19:30', '21:00'], // Martes
      3: ['18:00', '19:30', '21:00'], // Miércoles
      4: ['18:00', '19:30', '21:00'], // Jueves
      5: ['20:00'], // Viernes (20:00 a 21:30)
      6: ['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00'], // Sábado
      0: [] // Domingo (Cerrado)
    },
    cjp2: {
      1: ['20:00'], // Lunes (20:00 a 21:30)
      2: ['18:00', '19:30', '21:00'], // Martes
      3: ['18:00', '19:30', '21:00'], // Miércoles
      4: ['18:00', '19:30', '21:00'], // Jueves
      5: ['20:00'], // Viernes (20:00 a 21:30)
      6: ['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00'], // Sábado
      0: [] // Domingo (Cerrado)
    }
  }
};

// =======================================================
// 🌐 PUNTO DE ENTRADA WEB (API)
// =======================================================

function doGet(e) {
  return handleRequest(e.parameter);
}

function doPost(e) {
  let data = {};
  try {
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }
  } catch(err) {
    data = e.parameter;
  }
  return handleRequest(data);
}

function handleRequest(data) {
  try {
    let response = { ok: false, msg: "Acción no reconocida." };

    switch (data.action) {
      case "validate_member":
        response = validateMember(data.email);
        break;
      case "get_ranking":
        response = getRanking();
        break;
      case "get_available_slots":
        response = getAvailableSlots(data.date);
        break;
      case "create_booking":
        response = createBooking(data);
        break;
      case "cancel_booking":
        response = cancelBooking(data);
        break;
      case "get_user_bookings":
        response = getUserBookings(data.email);
        break;
      case "notify_challenge":
        response = notifyChallenge(data);
        break;
      case "notify_result":
        response = notifyResult(data);
        break;
      case "notify_dispute":
        response = notifyDispute(data);
        break;
      case "get_challenges":
        response = getChallenges();
        break;
      case "create_challenge":
        response = createChallenge(data);
        break;
      case "respond_challenge":
        response = respondChallenge(data);
        break;
      case "submit_challenge_result":
        response = submitChallengeResult(data);
        break;
      case "admin_save_player":
        response = adminSavePlayer(data);
        break;
      case "admin_delete_player":
        response = adminDeletePlayer(data);
        break;
      case "update_own_profile":
        response = updateOwnProfile(data);
        break;
      case "admin_free_special_slots":
        response = adminFreeSpecialSlots(data);
        break;
    }

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, msg: "Error en el servidor: " + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function notifyChallenge(data) {
  const retadoEmail = text(data.retadoEmail);
  const retadorEmail = text(data.retadorEmail);
  const retadoNombre = text(data.retadoNombre) || 'jugador/a';
  const retadorNombre = text(data.retadorNombre) || 'Un jugador';
  const fecha = text(data.fecha) || 'fecha por coordinar';
  const fechaLabel = fecha;
  const cancha = text(data.cancha) || 'cancha por definir';
  const slot = text(data.slot) || '';

  if (!retadoEmail) return { ok: false, msg: 'Correo del jugador retado no proporcionado.' };

  const calendarResult = createChallengeCalendarInvite({
    retadorNombre: retadorNombre,
    retadorEmail: retadorEmail,
    retadoNombre: retadoNombre,
    retadoEmail: retadoEmail,
    fecha: fecha,
    cancha: cancha
  });

  const rankingUrl = 'https://uctenis.github.io/reservas-canchas/ranking.html';
  const slotLine = slot ? '<tr><td style="padding:6px 12px;color:#555;">Hora</td><td style="padding:6px 12px;font-weight:600;">' + slot + '</td></tr>' : '';
  const calendarLine = calendarResult.ok
    ? '<p style="color:#27ae60;margin:0 0 8px;">✅ También se envió una invitación de Google Calendar.</p>'
    : '<p style="color:#e74c3c;margin:0 0 8px;">⚠️ No se pudo crear la invitación Calendar: ' + calendarResult.msg + '</p>';

  const htmlBody = [
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">',
    '  <div style="background:#1a6b3a;padding:24px;text-align:center;">',
    '    <h1 style="color:#fff;margin:0;font-size:22px;">🎾 UCTenis</h1>',
    '    <p style="color:#c8e6c9;margin:6px 0 0;">¡Tienes un nuevo desafío!</p>',
    '  </div>',
    '  <div style="padding:24px;">',
    '    <p style="font-size:16px;margin:0 0 16px;">Hola <strong>' + retadoNombre + '</strong>,</p>',
    '    <p style="margin:0 0 16px;"><strong>' + retadorNombre + '</strong> te ha retado en el ranking UCTenis.</p>',
    '    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">',
    '      <tr style="background:#f5f5f5;"><td style="padding:6px 12px;color:#555;">Fecha</td><td style="padding:6px 12px;font-weight:600;">' + fechaLabel + '</td></tr>',
    '      <tr><td style="padding:6px 12px;color:#555;">Cancha</td><td style="padding:6px 12px;font-weight:600;">' + cancha + '</td></tr>',
    slotLine,
    '    </table>',
    calendarLine,
    '    <div style="text-align:center;margin:20px 0;">',
    '      <a href="' + rankingUrl + '" style="background:#1a6b3a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">Aceptar o Rechazar desafío</a>',
    '    </div>',
    '    <p style="color:#888;font-size:12px;margin:16px 0 0;">UCTenis — Plataforma de ranking universitario</p>',
    '  </div>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to: retadoEmail,
    cc: retadorEmail || '',
    subject: '🎾 ¡Te desafían en UCTenis! ' + retadorNombre + ' te reta',
    htmlBody: htmlBody,
    name: 'UCTenis'
  });

  const waText = '🎾 ¡Hola ' + retadoNombre + '! ' + retadorNombre + ' te ha retado en UCTenis. Fecha: ' + fechaLabel + (slot ? ', ' + slot : '') + ' en ' + cancha + '. Acepta o rechaza en: ' + rankingUrl;
  const whatsappUrl = 'https://wa.me/?text=' + encodeURIComponent(waText);

  return {
    ok: true,
    msg: calendarResult.ok ? 'Correo e invitación Calendar enviados.' : 'Correo enviado; Calendar no se pudo crear.',
    calendar: calendarResult,
    whatsappUrl: whatsappUrl
  };
}

function notifyResult(data) {
  const challengeId = text(data.challengeId);
  const ganadorNombre = text(data.ganadorNombre) || 'El ganador';
  const ganadorEmail = text(data.ganadorEmail);
  const perdedorNombre = text(data.perdedorNombre) || 'El perdedor';
  const perdedorEmail = text(data.perdedorEmail);
  const marcador = text(data.marcador) || 'sin marcador';
  const fecha = text(data.fecha) || '';
  const cancha = text(data.cancha) || '';

  if (!perdedorEmail) return { ok: false, msg: 'Correo del jugador perdedor no proporcionado.' };

  const rankingUrl = 'https://uctenis.github.io/reservas-canchas/ranking.html';
  const fechaLine = fecha ? '<tr style="background:#f5f5f5;"><td style="padding:6px 12px;color:#555;">Fecha</td><td style="padding:6px 12px;font-weight:600;">' + fecha + '</td></tr>' : '';
  const canchaLine = cancha ? '<tr><td style="padding:6px 12px;color:#555;">Cancha</td><td style="padding:6px 12px;font-weight:600;">' + cancha + '</td></tr>' : '';

  const htmlBody = [
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">',
    '  <div style="background:#1a6b3a;padding:24px;text-align:center;">',
    '    <h1 style="color:#fff;margin:0;font-size:22px;">🎾 UCTenis</h1>',
    '    <p style="color:#c8e6c9;margin:6px 0 0;">Resultado de desafío registrado</p>',
    '  </div>',
    '  <div style="padding:24px;">',
    '    <p style="font-size:16px;margin:0 0 16px;">Hola <strong>' + perdedorNombre + '</strong>,</p>',
    '    <p style="margin:0 0 16px;">Se ha registrado el resultado de tu desafío contra <strong>' + ganadorNombre + '</strong>.</p>',
    '    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">',
    fechaLine,
    canchaLine,
    '      <tr style="background:#f5f5f5;"><td style="padding:6px 12px;color:#555;">Marcador</td><td style="padding:6px 12px;font-weight:600;">' + marcador + '</td></tr>',
    '      <tr><td style="padding:6px 12px;color:#555;">Ganador</td><td style="padding:6px 12px;font-weight:600;color:#1a6b3a;">' + ganadorNombre + '</td></tr>',
    '    </table>',
    '    <p style="margin:0 0 16px;color:#555;">Si el resultado no es correcto, puedes disputarlo ingresando a la página de ranking.</p>',
    '    <div style="text-align:center;margin:20px 0;">',
    '      <a href="' + rankingUrl + '" style="background:#1a6b3a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">Ver Ranking / Disputar</a>',
    '    </div>',
    '    <p style="color:#888;font-size:12px;margin:16px 0 0;">UCTenis — Plataforma de ranking universitario</p>',
    '  </div>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to: perdedorEmail,
    cc: ganadorEmail || '',
    subject: '🎾 Resultado UCTenis: ' + ganadorNombre + ' vs ' + perdedorNombre,
    htmlBody: htmlBody,
    name: 'UCTenis'
  });

  return { ok: true };
}

function notifyDispute(data) {
  const challengeId = text(data.challengeId);
  const disputanteNombre = text(data.disputanteNombre) || 'Un jugador';
  const disputanteEmail = text(data.disputanteEmail);
  const contrarioNombre = text(data.contrarioNombre) || 'su oponente';
  const marcador = text(data.marcador) || 'sin marcador';
  const fecha = text(data.fecha) || '';

  const adminEmails = (CONFIG.ADMINS.emails || []).filter(Boolean).join(',');
  if (!adminEmails) return { ok: false, msg: 'No hay correos de administrador configurados.' };

  const rankingUrl = 'https://uctenis.github.io/reservas-canchas/ranking.html';

  const htmlBody = [
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">',
    '  <div style="background:#c0392b;padding:24px;text-align:center;">',
    '    <h1 style="color:#fff;margin:0;font-size:22px;">🎾 UCTenis — Disputa de Resultado</h1>',
    '  </div>',
    '  <div style="padding:24px;">',
    '    <p style="font-size:16px;margin:0 0 16px;">Un jugador ha disputado un resultado registrado.</p>',
    '    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">',
    '      <tr style="background:#f5f5f5;"><td style="padding:6px 12px;color:#555;">Disputante</td><td style="padding:6px 12px;font-weight:600;">' + disputanteNombre + (disputanteEmail ? ' &lt;' + disputanteEmail + '&gt;' : '') + '</td></tr>',
    '      <tr><td style="padding:6px 12px;color:#555;">Contrario</td><td style="padding:6px 12px;font-weight:600;">' + contrarioNombre + '</td></tr>',
    '      <tr style="background:#f5f5f5;"><td style="padding:6px 12px;color:#555;">Marcador disputado</td><td style="padding:6px 12px;font-weight:600;">' + marcador + '</td></tr>',
    fecha ? '<tr><td style="padding:6px 12px;color:#555;">Fecha del desafío</td><td style="padding:6px 12px;font-weight:600;">' + fecha + '</td></tr>' : '',
    challengeId ? '<tr style="background:#f5f5f5;"><td style="padding:6px 12px;color:#555;">ID Desafío</td><td style="padding:6px 12px;font-family:monospace;">' + challengeId + '</td></tr>' : '',
    '    </table>',
    '    <div style="text-align:center;margin:20px 0;">',
    '      <a href="' + rankingUrl + '" style="background:#c0392b;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">Revisar en Ranking</a>',
    '    </div>',
    '    <p style="color:#888;font-size:12px;margin:16px 0 0;">UCTenis — Notificación automática del sistema</p>',
    '  </div>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to: adminEmails,
    subject: '⚠️ Disputa de resultado UCTenis: ' + disputanteNombre + ' vs ' + contrarioNombre,
    htmlBody: htmlBody,
    name: 'UCTenis'
  });

  return { ok: true };
}

function adminFreeSpecialSlots(data) {
  const adminEmail = text(data.adminEmail);
  const fecha = text(data.fecha);
  const courts = data.courts;

  if (!isAdminRequest({ adminEmail: adminEmail })) {
    return { ok: false, msg: 'Acceso reservado al administrador.' };
  }
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, msg: 'Fecha inválida. Usa formato YYYY-MM-DD.' };
  }
  if (!Array.isArray(courts) || courts.length === 0) {
    return { ok: false, msg: 'Debes proporcionar al menos una cancha.' };
  }

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_MIEMBROS_ID);
  let sheet = ss.getSheetByName('horarios_especiales');
  if (!sheet) {
    sheet = ss.insertSheet('horarios_especiales');
    sheet.getRange(1, 1, 1, 3).setValues([['fecha', 'courtId', 'tipo']]);
  }

  const existing = sheet.getDataRange().getValues();
  let saved = 0;

  courts.forEach(function(courtId) {
    const courtIdStr = text(courtId);
    if (!courtIdStr) return;

    // Look for existing row for this fecha+courtId
    let foundRow = -1;
    for (let i = 1; i < existing.length; i++) {
      if (text(existing[i][0]) === fecha && text(existing[i][1]) === courtIdStr) {
        foundRow = i + 1; // 1-indexed row number in sheet
        break;
      }
    }

    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, 3).setValues([[fecha, courtIdStr, 'all_day']]);
    } else {
      sheet.appendRow([fecha, courtIdStr, 'all_day']);
    }
    saved++;
  });

  return { ok: true, saved: saved };
}

function createChallengeCalendarInvite(data) {
  const fecha = text(data.fecha);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, msg: 'Fecha de desafío no válida.' };
  }

  const courtKey = courtKeyFromName(data.cancha);
  const calendarId = courtKey ? CONFIG.CALENDARS[courtKey] : '';
  const calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();
  if (!calendar) return { ok: false, msg: 'Calendario no encontrado.' };

  try {
    const date = new Date(fecha + 'T00:00:00-04:00');
    const guests = [text(data.retadorEmail), text(data.retadoEmail)].filter(Boolean).join(',');
    const event = calendar.createAllDayEvent(
      'Desafío ranking UCTenis: ' + text(data.retadorNombre) + ' vs ' + text(data.retadoNombre),
      date,
      {
        description: [
          'Desafío de ranking UCTenis.',
          'Retador: ' + text(data.retadorNombre) + ' <' + text(data.retadorEmail) + '>',
          'Retado: ' + text(data.retadoNombre) + ' <' + text(data.retadoEmail) + '>',
          'Cancha propuesta: ' + text(data.cancha),
          '',
          'Coordinen la hora exacta y registren el resultado en la página de ranking.'
        ].join('\n'),
        guests: guests,
        sendInvites: true
      }
    );
    if (CalendarApp.EventTransparency && CalendarApp.EventTransparency.TRANSPARENT) {
      event.setTransparency(CalendarApp.EventTransparency.TRANSPARENT);
    }
    return { ok: true, eventId: event.getId(), calendarId: calendarId || 'default' };
  } catch (error) {
    return { ok: false, msg: error.message };
  }
}

function courtKeyFromName(value) {
  const raw = norm(value).replace(/[^a-z0-9]/g, '');
  if (raw === 'cec1') return 'cec1';
  if (raw === 'cec2') return 'cec2';
  if (raw === 'cjp1') return 'cjp1';
  if (raw === 'cjp2') return 'cjp2';
  return '';
}

function getChallenges() {
  const sheet = getChallengesSheet();
  const values = sheet.getDataRange().getValues();
  const challenges = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!text(row[0])) continue;
    challenges.push(challengeFromRow(row));
  }

  return { ok: true, challenges: challenges };
}

function createChallenge(data) {
  const sheet = getChallengesSheet();
  const id = text(data.id) || Utilities.getUuid();
  const now = new Date().toISOString();
  const challenge = {
    id: id,
    retadorId: text(data.retadorId),
    retadorNombre: text(data.retadorNombre),
    retadorEmail: text(data.retadorEmail),
    retadoId: text(data.retadoId),
    retadoNombre: text(data.retadoNombre),
    retadoEmail: text(data.retadoEmail),
    genero: text(data.genero),
    fecha: text(data.fecha),
    cancha: text(data.cancha),
    status: 'pendiente',
    marcador: '',
    ganadorId: '',
    creado: now,
    actualizado: now
  };

  sheet.appendRow(challengeToRow(challenge));
  try {
    if (challenge.retadoEmail) notifyChallenge(challenge);
  } catch (mailError) {
    challenge.notificationError = mailError.message;
  }
  return { ok: true, challenge: publicChallenge(challenge) };
}

function respondChallenge(data) {
  const found = findChallengeRow(text(data.id));
  if (!found) return { ok: false, msg: 'Desafío no encontrado.' };

  const status = data.accept === true || data.accept === 'true' ? 'aceptado' : 'rechazado';
  found.sheet.getRange(found.rowNumber, 11).setValue(status);
  found.sheet.getRange(found.rowNumber, 15).setValue(new Date().toISOString());

  return { ok: true, challenge: publicChallenge(challengeFromRow(found.sheet.getRange(found.rowNumber, 1, 1, 15).getValues()[0])) };
}

function submitChallengeResult(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const found = findChallengeRow(text(data.id));
    if (!found) return { ok: false, msg: 'Desafío no encontrado.' };

    const previous = challengeFromRow(found.sheet.getRange(found.rowNumber, 1, 1, 15).getValues()[0]);
    const wasCompleted = previous.status === 'completado';

    found.sheet.getRange(found.rowNumber, 11).setValue('completado');
    found.sheet.getRange(found.rowNumber, 12).setValue(text(data.marcador));
    found.sheet.getRange(found.rowNumber, 13).setValue(text(data.ganadorId));
    found.sheet.getRange(found.rowNumber, 15).setValue(new Date().toISOString());

    const updated = challengeFromRow(found.sheet.getRange(found.rowNumber, 1, 1, 15).getValues()[0]);
    const rankingUpdate = wasCompleted
      ? { ok: true, skipped: true, msg: 'El resultado ya estaba registrado; no se vuelve a mover el ranking.' }
      : applyChallengeResultToRanking(updated);

    return {
      ok: true,
      challenge: publicChallenge(updated),
      rankingUpdate: rankingUpdate
    };
  } finally {
    lock.releaseLock();
  }
}

function getChallengesSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_MIEMBROS_ID);
  let sheet = ss.getSheetByName(' LIBRO DESAFIOS') || ss.getSheetByName('LIBRO DESAFIOS');
  if (!sheet) sheet = ss.insertSheet(' LIBRO DESAFIOS');

  const headers = ['id', 'retadorId', 'retadorNombre', 'retadorEmail', 'retadoId', 'retadoNombre', 'retadoEmail', 'genero', 'fecha', 'cancha', 'status', 'marcador', 'ganadorId', 'creado', 'actualizado'];
  const first = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (!text(first[0])) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function findChallengeRow(id) {
  if (!id) return null;
  const sheet = getChallengesSheet();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (text(values[i][0]) === id) return { sheet: sheet, rowNumber: i + 1 };
  }
  return null;
}

function challengeFromRow(row) {
  return {
    id: text(row[0]),
    retadorId: text(row[1]),
    retadorNombre: text(row[2]),
    retadorEmail: text(row[3]),
    retadoId: text(row[4]),
    retadoNombre: text(row[5]),
    retadoEmail: text(row[6]),
    genero: text(row[7]),
    fecha: text(row[8]),
    cancha: text(row[9]),
    status: text(row[10]) || 'pendiente',
    marcador: text(row[11]) || null,
    ganadorId: text(row[12]) || null,
    creado: text(row[13]),
    actualizado: text(row[14])
  };
}

function challengeToRow(challenge) {
  return [
    challenge.id,
    challenge.retadorId,
    challenge.retadorNombre,
    challenge.retadorEmail,
    challenge.retadoId,
    challenge.retadoNombre,
    challenge.retadoEmail,
    challenge.genero,
    challenge.fecha,
    challenge.cancha,
    challenge.status,
    challenge.marcador,
    challenge.ganadorId,
    challenge.creado,
    challenge.actualizado
  ];
}

function publicChallenge(challenge) {
  return {
    id: challenge.id,
    retadorId: challenge.retadorId,
    retadoId: challenge.retadoId,
    genero: challenge.genero,
    fecha: challenge.fecha,
    cancha: challenge.cancha,
    status: challenge.status,
    marcador: challenge.marcador || null,
    ganadorId: challenge.ganadorId || null,
    creado: challenge.creado,
    actualizado: challenge.actualizado
  };
}

// =======================================================
// 👥 FUNCIONES DE MIEMBROS (Validación desde Google Sheets)
// =======================================================

function validateMember(email) {
  if (!email) return { ok: false, msg: "Correo no proporcionado." };
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_MIEMBROS_ID);
    const sheet = ss.getSheetByName('usuariosautorizados');
    const jugadoresSheet = ss.getSheetByName('jugadores');
    const needle = email.toLowerCase().trim();
    
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      // usuariosautorizados: columna F = correo.
      for (let i = 1; i < data.length; i++) {
        if (text(data[i][5]).toLowerCase() === needle) {
          return { ok: true, msg: "Miembro validado.", isAdmin: isAdminRequest({ actorEmail: needle }) };
        }
      }
    }

    if (jugadoresSheet) {
      const players = jugadoresSheet.getDataRange().getValues();
      // jugadores: columna K = correo opcional.
      for (let i = 1; i < players.length; i++) {
        if (text(players[i][10]).toLowerCase() === needle) {
          const player = playerFromRow(players[i], i + 1);
          return {
            ok: true,
            msg: "Miembro validado.",
            player: publicPlayer(player),
            isAdmin: isAdminRequest({ actorEmail: needle, actorName: player.nombre })
          };
        }
      }
    }
    
    return { ok: false, msg: "El correo no se encuentra en la lista oficial de miembros autorizados." };
  } catch (error) {
    return { ok: false, msg: "Error interno al acceder a la lista de Drive." };
  }
}

// =======================================================
// 📅 FUNCIONES DE CALENDARIO (Disponibilidad y Creación)
// =======================================================

function getAvailableSlots(dateStr) {
  // dateStr en formato YYYY-MM-DD
  const date = new Date(dateStr + "T00:00:00-04:00"); // Zona horaria Chile
  const startOfDay = new Date(date.getTime());
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date.getTime());
  endOfDay.setHours(23, 59, 59, 999);
  
  const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, etc.
  let result = { ok: true, date: dateStr, courts: {}, playable: {} };

  // Leer horarios_especiales para detectar canchas con slots libres todo el día
  const specialCourts = {};
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_MIEMBROS_ID);
    const specialSheet = ss.getSheetByName('horarios_especiales');
    if (specialSheet) {
      const specialData = specialSheet.getDataRange().getValues();
      for (let i = 1; i < specialData.length; i++) {
        const rowFecha = text(specialData[i][0]);
        const rowCourt = text(specialData[i][1]);
        const rowTipo  = text(specialData[i][2]);
        if (rowFecha === dateStr && rowCourt && rowTipo === 'all_day') {
          specialCourts[rowCourt] = true;
        }
      }
    }
  } catch (specialErr) {
    // Si falla la lectura de horarios_especiales, continuar normalmente
  }
  
  // Revisar disponibilidad en cada calendario
  for (let courtKey in CONFIG.CALENDARS) {
    let calId = CONFIG.CALENDARS[courtKey];
    let calendar = CalendarApp.getCalendarById(calId);
    
    if (!calendar) {
      result.courts[courtKey] = { error: "Calendario no encontrado" };
      result.playable[courtKey] = [];
      continue;
    }
    
    let events;
    try {
      events = calendar.getEvents(startOfDay, endOfDay);
    } catch (e) {
      result.courts[courtKey] = { error: "No se pudo leer el calendario: " + e.message };
      result.playable[courtKey] = [];
      continue;
    }
    
    // Filtrar para considerar ocupados SOLO los bloques de reservas de UCTenis o desafíos de ranking
    let busyTimes = events
      .filter(e => {
        const title = (e.getTitle() || '').toLowerCase();
        return title.includes('reserva uctenis') || title.includes('desafío ranking') || title.includes('desafio ranking');
      })
      .map(e => ({
        start: e.getStartTime().getTime(),
        end: e.getEndTime().getTime()
      }));
    
    // Obtener los slots candidatos para esta cancha y este día específico de la semana
    // Si esta cancha tiene un override de horario especial (all_day), usar TODOS los slots de CONFIG.SLOTS
    let candidateSlots;
    if (specialCourts[courtKey]) {
      candidateSlots = CONFIG.SLOTS;
    } else if (CONFIG.COURT_SLOTS && CONFIG.COURT_SLOTS[courtKey]) {
      const courtConfig = CONFIG.COURT_SLOTS[courtKey];
      if (Array.isArray(courtConfig)) {
        candidateSlots = courtConfig;
      } else {
        candidateSlots = courtConfig[dayOfWeek] || courtConfig['default'] || CONFIG.SLOTS;
      }
    } else {
      candidateSlots = CONFIG.SLOTS;
    }
    
    // Guardamos la lista de todas las franjas "jugables" definidas para este día
    result.playable[courtKey] = candidateSlots;
    
    let availableSlots = [];
    candidateSlots.forEach(slot => {
      let [h, m] = slot.split(':').map(Number);
      let slotStart = new Date(dateStr + "T00:00:00-04:00");
      slotStart.setHours(h, m, 0, 0);
      
      let slotEnd = new Date(slotStart.getTime() + 90 * 60000); // +1.5 horas
      
      // Comprobar si el bloque se superpone con algún evento
      let isBusy = busyTimes.some(b => {
        return (slotStart.getTime() < b.end && slotEnd.getTime() > b.start);
      });
      
      if (!isBusy) {
        availableSlots.push(slot);
      }
    });
    
    result.courts[courtKey] = availableSlots;
  }
  
  return result;
}

function createBooking(data) {
  // data = { email, name, courtId, date, slot }
  
  // 1. Validar si es miembro primero (Regla 4)
  let memberCheck = validateMember(data.email);
  if (!memberCheck.ok) return memberCheck;
  
  // 2. Obtener el calendario
  let calId = CONFIG.CALENDARS[data.courtId];
  if (!calId) return { ok: false, msg: "Cancha no válida." };
  let calendar = CalendarApp.getCalendarById(calId);
  
  // 3. Calcular tiempos
  let [h, m] = data.slot.split(':').map(Number);
  let startTime = new Date(data.date + "T00:00:00-04:00");
  startTime.setHours(h, m, 0, 0);
  let endTime = new Date(startTime.getTime() + 90 * 60000); // 1.5 hrs
  
  // 4. Doble validación: verificar que nadie haya tomado el bloque en los últimos segundos
  let conflicts = calendar.getEvents(startTime, endTime);
  if (conflicts.length > 0) {
    return { ok: false, msg: "Este horario ya fue ocupado por otra persona. Por favor elige otro." };
  }
  
  // 5. Crear el evento en Google Calendar
  try {
    let event = calendar.createEvent(
      `Reserva UCTenis - ${data.name}`, 
      startTime, 
      endTime,
      {
        description: `Reserva automática generada desde la plataforma web.\nUsuario: ${data.name}\nCorreo: ${data.email}\nCancha: ${data.courtId.toUpperCase()}`,
        guests: data.email, // Invitar al usuario para que le llegue a su calendario
        sendInvites: true
      }
    );
    
    return { 
      ok: true, 
      msg: "¡Reserva confirmada y agendada en Google Calendar!", 
      eventId: event.getId() 
    };
    
  } catch (e) {
    return { ok: false, msg: "No se pudo crear el evento en el calendario: " + e.message };
  }
}

function cancelBooking(data) {
  // data = { courtId, eventId }
  let calId = CONFIG.CALENDARS[data.courtId];
  if (!calId) return { ok: false, msg: "Cancha no válida." };
  let calendar = CalendarApp.getCalendarById(calId);
  if (!calendar) return { ok: false, msg: "Calendario no encontrado." };
  
  try {
    let event = calendar.getEventById(data.eventId);
    if (event) {
      event.deleteEvent();
      return { ok: true, msg: "Reserva cancelada con éxito en Google Calendar y horario liberado." };
    } else {
      // Si el evento no existe, posiblemente ya fue borrado. Retornamos ok para limpiar estado local
      return { ok: true, msg: "El evento no existe en Google Calendar. Sincronizado localmente." };
    }
  } catch (e) {
    return { ok: false, msg: "Error al eliminar la reserva del calendario: " + e.message };
  }
}

// =======================================================
// 👤 JUGADORES, ADMINISTRACION Y RANKING AUTOMATICO
// =======================================================

const PLAYER_HEADERS = ['ID', 'Nombre', 'Genero', 'Fecha nac', 'Categoria', 'Mano Habil', 'Reves', 'Foto', 'Ranking', 'Pos. Anterior', 'Correo'];
const RANKING_HEADERS = ['Posicion', 'Nombre', 'Pos. Anterior', '', '', 'ID'];

function adminSavePlayer(data) {
  if (!isAdminRequest(data)) return { ok: false, msg: 'Acceso reservado al administrador.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet();
    const index = getPlayersIndex(ss);
    const requestedId = text(data.id);
    const existing = requestedId ? index.byId[requestedId] : null;
    const player = normalizePlayerPayload(data, existing);

    if (!player.nombre) return { ok: false, msg: 'El nombre del jugador es obligatorio.' };
    if (!player.genero) return { ok: false, msg: 'Selecciona ranking masculino o femenino.' };
    if (!player.id) player.id = generatePlayerId(index, player.genero);
    if (data.photoDataUrl) player.foto = savePlayerPhoto(data, player);

    const duplicate = index.players.find(item =>
      item.id !== player.id &&
      ((player.email && item.email && item.email.toLowerCase() === player.email.toLowerCase()) ||
       norm(item.nombre) === norm(player.nombre))
    );
    if (duplicate) return { ok: false, msg: 'Ya existe un jugador con ese nombre o correo.' };

    const rowNumber = existing ? existing.rowNumber : index.sheet.getLastRow() + 1;
    index.sheet.getRange(rowNumber, 1, 1, PLAYER_HEADERS.length).setValues([playerToRow(player)]);
    ensurePlayerInRanking(ss, player, numberOrBlank(data.posicion));

    return { ok: true, player: publicPlayer(player), ranking: getRanking() };
  } finally {
    lock.releaseLock();
  }
}

function adminDeletePlayer(data) {
  if (!isAdminRequest(data)) return { ok: false, msg: 'Acceso reservado al administrador.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet();
    const index = getPlayersIndex(ss);
    const player = findPlayerReference(index, {
      id: text(data.id),
      nombre: text(data.nombre),
      email: text(data.email)
    });

    if (!player) return { ok: false, msg: 'Jugador no encontrado.' };

    index.sheet.deleteRow(player.rowNumber);
    removePlayerFromRankings(ss, player);

    return { ok: true, deletedId: player.id, ranking: getRanking() };
  } finally {
    lock.releaseLock();
  }
}

function updateOwnProfile(data) {
  const actorEmail = text(data.actorEmail || data.email);
  const validation = actorEmail ? validateMember(actorEmail) : { ok: false };
  if (!validation.ok) return { ok: false, msg: 'Debes ingresar con una cuenta validada para editar tu ficha.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet();
    const index = getPlayersIndex(ss);
    const player = findPlayerReference(index, {
      id: text(data.actorId || data.id),
      nombre: text(data.actorName || data.actorNombre || data.nombre),
      email: actorEmail
    });

    if (!player) return { ok: false, msg: 'No encontré tu ficha en la hoja jugadores.' };

    const updated = {
      ...player,
      fechaNacimiento: payloadField(data, ['fechaNacimiento', 'fechaNac', 'birthDate'], player.fechaNacimiento),
      categoria: normalizeCategory(payloadField(data, ['categoria', 'category'], player.categoria)),
      manoHabil: payloadField(data, ['manoHabil', 'mano', 'hand'], player.manoHabil),
      reves: payloadField(data, ['reves', 'backhand'], player.reves),
      foto: payloadField(data, ['foto', 'photo', 'avatar'], player.foto),
      email: player.email || actorEmail
    };
    if (data.photoDataUrl) updated.foto = savePlayerPhoto(data, updated);

    index.sheet.getRange(player.rowNumber, 1, 1, PLAYER_HEADERS.length).setValues([playerToRow(updated)]);
    return { ok: true, player: publicPlayer(updated), ranking: getRanking() };
  } finally {
    lock.releaseLock();
  }
}

function applyChallengeResultToRanking(challenge) {
  const genero = normalizeGender(challenge.genero);
  const ganadorId = text(challenge.ganadorId);
  if (!genero) return { ok: false, msg: 'Genero de desafio no valido.' };
  if (!ganadorId) return { ok: false, msg: 'Ganador no informado.' };

  const winner = ganadorId === challenge.retadorId
    ? { id: challenge.retadorId, nombre: challenge.retadorNombre }
    : { id: challenge.retadoId, nombre: challenge.retadoNombre };
  const loser = ganadorId === challenge.retadorId
    ? { id: challenge.retadoId, nombre: challenge.retadoNombre }
    : { id: challenge.retadorId, nombre: challenge.retadorNombre };

  const ss = getSpreadsheet();
  const entries = readRankingEntries(ss, genero);
  const winnerIndex = findRankingEntryIndex(entries, winner);
  const loserIndex = findRankingEntryIndex(entries, loser);

  if (winnerIndex < 0 || loserIndex < 0) {
    return { ok: false, msg: 'No se pudo ubicar a ambos jugadores en el ranking.' };
  }

  if (winnerIndex < loserIndex) {
    return { ok: true, moved: false, msg: 'El ganador ya estaba por encima; el ranking mantiene sus posiciones.' };
  }

  const previousMap = buildPreviousPositionMap(entries);
  const oldWinnerPos = entries[winnerIndex].posicion;
  const oldLoserPos = entries[loserIndex].posicion;
  const moved = entries.splice(winnerIndex, 1)[0];
  entries.splice(loserIndex, 0, moved);

  writeRankingEntries(ss, genero, entries, previousMap);
  syncPlayerRankingColumns(ss, genero, entries, previousMap);

  return {
    ok: true,
    moved: true,
    ganadorId: winner.id,
    perdedorId: loser.id,
    from: oldWinnerPos,
    to: oldLoserPos
  };
}

function ensurePlayerInRanking(ss, player, desiredPosition) {
  const genders = ['M', 'F'];
  genders.forEach(genero => {
    let entries = readRankingEntries(ss, genero);
    const previousMap = buildPreviousPositionMap(entries);
    const existingIndex = findRankingEntryIndex(entries, player);

    if (existingIndex >= 0) {
      entries.splice(existingIndex, 1);
    }

    if (genero === player.genero) {
      const position = Number.isFinite(desiredPosition) && desiredPosition > 0
        ? Math.min(desiredPosition, entries.length + 1)
        : entries.length + 1;
      const key = player.id || norm(player.nombre);
      previousMap[key] = existingIndex >= 0 ? previousMap[key] : '';
      entries.splice(position - 1, 0, {
        id: player.id,
        nombre: player.nombre,
        posicion: position,
        posicionAnterior: existingIndex >= 0 ? previousMap[key] : '',
        genero: player.genero
      });
    }

    writeRankingEntries(ss, genero, entries, previousMap);
    syncPlayerRankingColumns(ss, genero, entries, previousMap);
  });
}

function removePlayerFromRankings(ss, player) {
  ['M', 'F'].forEach(genero => {
    const entries = readRankingEntries(ss, genero);
    const previousMap = buildPreviousPositionMap(entries);
    const filtered = entries.filter(entry => !matchesPlayerReference(entry, player));
    if (filtered.length !== entries.length) {
      writeRankingEntries(ss, genero, filtered, previousMap);
      syncPlayerRankingColumns(ss, genero, filtered, previousMap);
    }
  });
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SHEET_MIEMBROS_ID);
}

function getPlayersSheet(ss) {
  const spreadsheet = ss || getSpreadsheet();
  let sheet = spreadsheet.getSheetByName('jugadores');
  if (!sheet) sheet = spreadsheet.insertSheet('jugadores');
  ensureSheetHeaders(sheet, PLAYER_HEADERS);
  return sheet;
}

function getRankingSheet(ss, genero) {
  const spreadsheet = ss || getSpreadsheet();
  const name = normalizeGender(genero) === 'F' ? 'rankingfem' : 'rankingmas';
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet && name === 'rankingfem') sheet = spreadsheet.getSheetByName('rankinfem');
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  ensureSheetHeaders(sheet, RANKING_HEADERS);
  return sheet;
}

function ensureSheetHeaders(sheet, headers) {
  const width = headers.length;
  const first = sheet.getRange(1, 1, 1, width).getValues()[0];
  if (!text(first[0])) sheet.getRange(1, 1, 1, width).setValues([headers]);
}

function getPlayersIndex(ss) {
  const sheet = getPlayersSheet(ss);
  const values = sheet.getDataRange().getValues();
  const players = [];
  const byId = {};
  const byName = {};
  const byEmail = {};

  for (let i = 1; i < values.length; i++) {
    const player = playerFromRow(values[i], i + 1);
    if (!player.id && !player.nombre) continue;
    players.push(player);
    if (player.id) byId[player.id] = player;
    if (player.nombre) byName[norm(player.nombre)] = player;
    if (player.email) byEmail[player.email.toLowerCase()] = player;
  }

  return { sheet: sheet, players: players, byId: byId, byName: byName, byEmail: byEmail };
}

function playerFromRow(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    id: text(row[0]),
    nombre: text(row[1]),
    genero: normalizeGender(row[2]),
    fechaNacimiento: formatSheetDate(row[3]),
    edad: calculateAge(row[3]),
    categoria: normalizeCategory(row[4]),
    manoHabil: text(row[5]),
    mano: text(row[5]),
    reves: text(row[6]),
    foto: text(row[7]),
    ranking: numberOrBlank(row[8]),
    posicionAnterior: numberOrBlank(row[9]),
    email: text(row[10])
  };
}

function normalizePlayerPayload(data, existing) {
  const base = existing || {};
  const genero = normalizeGender(payloadField(data, ['genero', 'gender'], base.genero));

  return {
    id: payloadField(data, ['id', 'codigo', 'uid'], base.id),
    nombre: payloadField(data, ['nombre', 'name', 'jugador'], base.nombre),
    genero: genero,
    fechaNacimiento: payloadField(data, ['fechaNacimiento', 'fechaNac', 'birthDate'], base.fechaNacimiento),
    categoria: normalizeCategory(payloadField(data, ['categoria', 'category'], base.categoria)),
    manoHabil: payloadField(data, ['manoHabil', 'mano', 'hand'], base.manoHabil || base.mano),
    reves: payloadField(data, ['reves', 'backhand'], base.reves),
    foto: payloadField(data, ['foto', 'photo', 'avatar'], base.foto),
    ranking: numberOrBlank(payloadField(data, ['ranking', 'posicion'], base.ranking)),
    posicionAnterior: numberOrBlank(payloadField(data, ['posicionAnterior', 'prev'], base.posicionAnterior)),
    email: payloadField(data, ['email', 'correo'], base.email)
  };
}

function payloadField(data, keys, fallback) {
  for (let i = 0; i < keys.length; i++) {
    if (Object.prototype.hasOwnProperty.call(data, keys[i]) && data[keys[i]] !== undefined && data[keys[i]] !== null) {
      return text(data[keys[i]]);
    }
  }
  return text(fallback);
}

function playerToRow(player) {
  return [
    player.id,
    player.nombre,
    player.genero,
    player.fechaNacimiento,
    normalizeCategory(player.categoria),
    player.manoHabil || player.mano,
    player.reves,
    player.foto,
    player.ranking || '',
    player.posicionAnterior || '',
    player.email
  ];
}

function publicPlayer(player) {
  return {
    id: player.id,
    nombre: player.nombre,
    genero: player.genero,
    fechaNacimiento: player.fechaNacimiento,
    edad: player.edad || calculateAge(player.fechaNacimiento),
    categoria: normalizeCategory(player.categoria),
    manoHabil: player.manoHabil || player.mano,
    mano: player.mano || player.manoHabil,
    reves: player.reves,
    foto: photoFor(player.id, player.foto),
    ranking: player.ranking,
    posicionAnterior: player.posicionAnterior,
    email: player.email
  };
}

function savePlayerPhoto(data, player) {
  const dataUrl = (data.photoDataUrl || '').toString();
  if (!dataUrl) return '';

  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('La foto debe ser JPG, PNG o WEBP.');

  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 3500000) throw new Error('La foto es demasiado pesada. Intenta con una imagen menor.');

  const extMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  const ext = extMap[mime] || 'jpg';
  const safeName = fileSafeName((player.id || player.nombre || 'jugador') + '-' + new Date().getTime()) + '.' + ext;
  const blob = Utilities.newBlob(bytes, mime, safeName);
  const file = getPhotoFolder().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600';
}

function getPhotoFolder() {
  const name = CONFIG.PHOTO_FOLDER_NAME || 'UCTenis fotos jugadores';
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function fileSafeName(value) {
  return norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jugador';
}

function generatePlayerId(index, genero) {
  const prefix = normalizeGender(genero) === 'F' ? 'f' : 'm';
  let max = 0;
  index.players.forEach(player => {
    const match = text(player.id).match(new RegExp('^' + prefix + '(\\d+)$', 'i'));
    if (match) max = Math.max(max, Number(match[1]));
  });
  return prefix + String(max + 1).padStart(3, '0');
}

function readRankingEntries(ss, genero) {
  const sheet = getRankingSheet(ss, genero);
  const playerIndex = getPlayersIndex(ss);
  const values = sheet.getDataRange().getValues();
  const out = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const id = text(row[5]);
    const name = text(row[1]);
    const meta = findPlayerReference(playerIndex, { id: id, nombre: name });
    const resolvedId = id || (meta ? meta.id : '');
    const resolvedName = name || (meta ? meta.nombre : '');
    if (!resolvedName) continue;

    out.push({
      id: resolvedId,
      nombre: resolvedName,
      genero: normalizeGender(genero),
      posicion: numberOrBlank(row[0]) || out.length + 1,
      posicionAnterior: numberOrBlank(row[2]) || (meta ? meta.posicionAnterior : '')
    });
  }

  if (!out.length) {
    playerIndex.players
      .filter(player => player.genero === normalizeGender(genero))
      .sort((a, b) => (numberOrBlank(a.ranking) || 9999) - (numberOrBlank(b.ranking) || 9999) || a.nombre.localeCompare(b.nombre, 'es'))
      .forEach((player, index) => {
        out.push({
          id: player.id,
          nombre: player.nombre,
          genero: player.genero,
          posicion: numberOrBlank(player.ranking) || index + 1,
          posicionAnterior: player.posicionAnterior || ''
        });
      });
  }

  out.sort((a, b) => Number(a.posicion) - Number(b.posicion) || a.nombre.localeCompare(b.nombre, 'es'));
  return out.map((entry, index) => ({ ...entry, posicion: index + 1 }));
}

function writeRankingEntries(ss, genero, entries, previousMap) {
  const sheet = getRankingSheet(ss, genero);
  const rows = entries.map((entry, index) => {
    const key = rankingEntryKey(entry);
    const hasPrevious = previousMap && Object.prototype.hasOwnProperty.call(previousMap, key);
    const previous = hasPrevious ? previousMap[key] : (entry.posicionAnterior || entry.posicion || index + 1);
    return [index + 1, entry.nombre, previous, '', '', entry.id || ''];
  });

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, RANKING_HEADERS.length).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, RANKING_HEADERS.length).setValues(rows);
}

function syncPlayerRankingColumns(ss, genero, entries, previousMap) {
  const index = getPlayersIndex(ss);
  entries.forEach((entry, indexNumber) => {
    const player = findPlayerReference(index, entry);
    if (!player) return;
    const key = rankingEntryKey(entry);
    const hasPrevious = previousMap && Object.prototype.hasOwnProperty.call(previousMap, key);
    const previous = hasPrevious ? previousMap[key] : (entry.posicionAnterior || '');
    index.sheet.getRange(player.rowNumber, 9, 1, 2).setValues([[indexNumber + 1, previous]]);
  });
}

function buildPreviousPositionMap(entries) {
  const map = {};
  entries.forEach(entry => {
    map[rankingEntryKey(entry)] = entry.posicion;
  });
  return map;
}

function findRankingEntryIndex(entries, ref) {
  return entries.findIndex(entry => matchesPlayerReference(entry, ref));
}

function findPlayerReference(index, ref) {
  const id = text(ref && ref.id);
  const email = text(ref && ref.email).toLowerCase();
  const nombre = norm(ref && ref.nombre);
  if (id && index.byId[id]) return index.byId[id];
  if (email && index.byEmail[email]) return index.byEmail[email];
  if (nombre && index.byName[nombre]) return index.byName[nombre];
  return null;
}

function matchesPlayerReference(player, ref) {
  if (!player || !ref) return false;
  const playerId = text(player.id);
  const refId = text(ref.id);
  if (playerId && refId && playerId === refId) return true;

  const playerEmail = text(player.email).toLowerCase();
  const refEmail = text(ref.email).toLowerCase();
  if (playerEmail && refEmail && playerEmail === refEmail) return true;

  const playerName = norm(player.nombre);
  const refName = norm(ref.nombre);
  return Boolean(playerName && refName && playerName === refName);
}

function rankingEntryKey(entry) {
  return text(entry.id) || norm(entry.nombre);
}

function normalizeGender(value) {
  const raw = text(value).toUpperCase();
  if (raw === 'M' || raw.indexOf('MASC') === 0 || raw === 'HOMBRE' || raw === 'HOMBRES') return 'M';
  if (raw === 'F' || raw.indexOf('FEM') === 0 || raw === 'MUJER' || raw === 'MUJERES') return 'F';
  return '';
}

function normalizeCategory(value) {
  const raw = text(value);
  return norm(raw) === 'abierta' ? 'Principiante' : raw;
}

function isAdminRequest(data) {
  if (CONFIG.ADMIN_PIN && text(data.adminPin || data.pin) !== text(CONFIG.ADMIN_PIN)) return false;

  const emails = (CONFIG.ADMINS.emails || []).map(email => text(email).toLowerCase()).filter(Boolean);
  const names = (CONFIG.ADMINS.names || []).map(name => norm(name)).filter(Boolean);
  const email = text(data.adminEmail || data.actorEmail || data.email).toLowerCase();
  const name = norm(data.adminName || data.adminNombre || data.actorName || data.actorNombre || data.nombre);

  return Boolean((email && emails.indexOf(email) >= 0) || (name && names.indexOf(name) >= 0));
}

// =======================================================
// 🏆 RANKING (leer desde Google Sheets)
// =======================================================
function getRanking() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_MIEMBROS_ID);
    const maleSheet = ss.getSheetByName('rankingmas');
    const femaleSheet = ss.getSheetByName('rankingfem') || ss.getSheetByName('rankinfem');
    const playersSheet = ss.getSheetByName('jugadores');
    const statsById = getChallengeStatsByPlayer();

    const playersMap = {};
    const playersByName = {};
    if (playersSheet) {
      const pdata = playersSheet.getDataRange().getValues();
      for (let i = 1; i < pdata.length; i++) {
        const row = pdata[i];
        // jugadores: A ID, B Nombre, C Genero, D Fecha nac, E Categoria,
        // F Mano Habil, G Reves, H Foto, I Ranking, J Pos. Anterior, K Correo.
        const id = text(row[0]);
        if (!id) continue;
        const player = {
          id: id,
          nombre: text(row[1]),
          genero: text(row[2]),
          fechaNacimiento: formatSheetDate(row[3]),
          edad: calculateAge(row[3]),
          categoria: normalizeCategory(row[4]),
          manoHabil: text(row[5]),
          mano: text(row[5]),
          reves: text(row[6]),
          foto: photoFor(id, row[7]),
          ranking: numberOrBlank(row[8]),
          posicionAnterior: numberOrBlank(row[9]),
          email: text(row[10])
        };
        playersMap[id] = player;
        if (player.nombre) playersByName[norm(player.nombre)] = player;
      }
    }

    function parseRankingSheet(sheet, genero) {
      const out = [];
      if (!sheet) return out;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const r = data[i];
        // rankingmas/rankingfem: A Posicion, B Nombre, C Pos. Anterior, F id.
        const posicion = numberOrBlank(r[0]);
        const nombreRanking = text(r[1]);
        const posicionAnterior = numberOrBlank(r[2]);
        const id = r[5] ? r[5].toString().trim() : '';
        const meta = playersMap[id] || playersByName[norm(nombreRanking)] || {};
        const resolvedId = id || meta.id || '';
        const nombre = nombreRanking || meta.nombre || '';
        const stats = statsById[resolvedId] || { pts: 0, pj: 0, pg: 0, pp: 0 };

        if (!nombre || !posicion) continue;

        out.push({
          id: resolvedId,
          nombre: nombre,
          posicion: posicion,
          posicionAnterior: posicionAnterior || meta.posicionAnterior || '',
          genero: genero,
          fechaNacimiento: meta.fechaNacimiento || '',
          edad: meta.edad || '',
          categoria: normalizeCategory(meta.categoria || ''),
          manoHabil: meta.manoHabil || '',
          mano: meta.mano || meta.manoHabil || '',
          reves: meta.reves || '',
          foto: resolvedId ? photoFor(resolvedId, meta.foto) : '',
          email: meta.email || '',
          pts: stats.pts,
          pj: stats.pj,
          pg: stats.pg,
          pp: stats.pp
        });
      }
      out.sort((a, b) => Number(a.posicion) - Number(b.posicion));
      return out;
    }

    const male = parseRankingSheet(maleSheet, 'M');
    const female = parseRankingSheet(femaleSheet, 'F');

    return {
      ok: true,
      male: male,
      female: female,
      hombres: male,
      mujeres: female,
      updatedAt: new Date().toISOString()
    };
  } catch (e) {
    return { ok: false, msg: 'No se pudo leer el ranking: ' + e.message };
  }
}

function getChallengeStatsByPlayer() {
  const stats = {};
  const sheet = getChallengesSheet();
  const values = sheet.getDataRange().getValues();

  function ensure(id) {
    if (!id) return null;
    if (!stats[id]) stats[id] = { pts: 0, pj: 0, pg: 0, pp: 0 };
    return stats[id];
  }

  for (let i = 1; i < values.length; i++) {
    const challenge = challengeFromRow(values[i]);
    if (challenge.status !== 'completado') continue;

    const retador = ensure(challenge.retadorId);
    const retado = ensure(challenge.retadoId);
    const ganador = ensure(challenge.ganadorId);
    if (!retador || !retado || !ganador) continue;

    retador.pj += 1;
    retado.pj += 1;
    ganador.pts += 3;
    ganador.pg += 1;

    if (challenge.ganadorId === challenge.retadorId) retado.pp += 1;
    if (challenge.ganadorId === challenge.retadoId) retador.pp += 1;
  }

  return stats;
}

function text(value) {
  if (value === null || value === undefined) return '';
  return value.toString().replace(/\s+/g, ' ').trim();
}

function norm(value) {
  return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function numberOrBlank(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

function formatSheetDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return text(value);
}

function calculateAge(value) {
  if (!value) return '';
  let birth = null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    birth = value;
  } else {
    const raw = text(value).replace(/-/g, '/');
    const parts = raw.split('/');
    if (parts.length === 3) {
      const day = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const year = Number(parts[2]);
      if (day && month >= 0 && year) birth = new Date(year, month, day);
    }
  }

  if (!birth || isNaN(birth)) return '';

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 ? age : '';
}

function photoFor(id, value) {
  const raw = text(value);
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw && raw.indexOf('fotos/') === 0) return raw;
  return id ? 'fotos/' + id + '.png' : '';
}

function getUserBookings(email) {
  if (!email) return { ok: false, msg: "Correo no proporcionado." };
  
  const bookings = [];
  const now = new Date();
  
  // Buscar en los próximos 15 días (quincena de reservas)
  const endRange = new Date();
  endRange.setDate(now.getDate() + 15);
  
  // Rango de búsqueda para el día de hoy desde las 00:00:00
  const startRange = new Date();
  startRange.setHours(0, 0, 0, 0);

  try {
    for (let courtKey in CONFIG.CALENDARS) {
      let calId = CONFIG.CALENDARS[courtKey];
      let calendar = CalendarApp.getCalendarById(calId);
      if (!calendar) continue;
      
      let events = calendar.getEvents(startRange, endRange);
      events.forEach(e => {
        const desc = e.getDescription() || "";
        const title = e.getTitle() || "";
        const matchesEmail = desc.toLowerCase().includes(email.toLowerCase()) || 
                             title.toLowerCase().includes(email.toLowerCase());
        
        if (matchesEmail) {
          const start = e.getStartTime();
          const y = start.getFullYear();
          const m = String(start.getMonth() + 1).padStart(2, '0');
          const d = String(start.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;
          
          const hours = String(start.getHours()).padStart(2, '0');
          const mins = String(start.getMinutes()).padStart(2, '0');
          const slotStr = `${hours}:${mins}`;
          
          bookings.push({
            id: e.getId(),
            courtId: courtKey,
            fecha: dateStr,
            slot: slotStr
          });
        }
      });
    }
    
    return { ok: true, bookings: bookings };
  } catch (e) {
    return { ok: false, msg: "Error al leer reservas de Google Calendar: " + e.message };
  }
}
