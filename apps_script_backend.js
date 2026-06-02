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

  FIREBASE_PROJECT_ID: "uctenis-club",
  FIREBASE_API_KEY: "AIzaSyDxNdwD8hHQmN2efhRwflL7RkpC-RFs3ow",

  // Perfil administrador dentro de la pagina.
  // Si quieres endurecerlo mas, agrega un ADMIN_PIN y envialo desde el front.
  ADMINS: {
    emails: ["uctenisclub@gmail.com", "dsilva@uct.cl"],
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
  // Evitar error al ejecutar directamente desde el editor de Apps Script
  if (!e || !e.parameter) {
    return ContentService.createTextOutput(JSON.stringify({ 
      ok: false, 
      msg: "Ejecutado desde el editor de Apps Script o sin parámetros. Para probar en producción usa la URL de la aplicación web." 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  return handleRequest(e.parameter);
}

function doPost(e) {
  // Evitar error al ejecutar directamente desde el editor de Apps Script
  if (!e) {
    return ContentService.createTextOutput(JSON.stringify({ 
      ok: false, 
      msg: "Petición POST vacía o ejecutada desde el editor de Apps Script." 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  let data = {};
  try {
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter || {};
    }
  } catch(err) {
    data = e.parameter || {};
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
      case "admin_reorder_ranking":
        response = adminReorderRanking(data);
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
  const fechaLabel = text(data.fechaLabel) || fecha;
  const cancha = text(data.cancha) || 'cancha por definir';
  const slot = text(data.slot) || '';
  const retadoTelefono = text(data.retadoTelefono);

  if (!retadoEmail) return { ok: false, msg: 'Correo del jugador retado no proporcionado.' };

  const calendarResult = createChallengeCalendarInvite({
    retadorNombre: retadorNombre,
    retadorEmail: retadorEmail,
    retadoNombre: retadoNombre,
    retadoEmail: retadoEmail,
    fecha: fecha,
    fechaLabel: fechaLabel,
    slot: slot,
    cancha: cancha,
    courtId: text(data.courtId),
    tipo: text(data.tipo)
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

  /*
  MailApp.sendEmail({
    to: retadoEmail,
    cc: retadorEmail || '',
    subject: '🎾 ¡Te desafían en UCTenis! ' + retadorNombre + ' te reta',
    htmlBody: htmlBody,
    name: 'UCTenis Club',
    replyTo: (CONFIG.ADMINS.emails || [])[0] || ''
  });
  */

  const waText = '🎾 ¡Hola ' + retadoNombre + '! ' + retadorNombre + ' te ha retado en UCTenis. Fecha: ' + fechaLabel + (slot ? ', ' + slot : '') + ' en ' + cancha + '. Acepta o rechaza en: ' + rankingUrl;
  const cleanPhone = retadoTelefono.replace(/[^0-9]/g, '');
  const whatsappUrl = cleanPhone ? 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(waText) : '';

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
    return { ok: false, msg: 'Fecha no valida.' };
  }

  const calendar = CalendarApp.getDefaultCalendar();
  if (!calendar) return { ok: false, msg: 'Calendario no encontrado.' };

  try {
    const slot = text(data.slot);
    const guests = [text(data.retadorEmail), text(data.retadoEmail)].filter(Boolean).join(',');
    const isFriendly = text(data.tipo) === 'amistoso';
    const title = (isFriendly ? 'Partido amistoso UCTenis: ' : 'Desafio ranking UCTenis: ') + text(data.retadorNombre) + ' vs ' + text(data.retadoNombre);
    const description = [
      isFriendly ? 'Partido amistoso UCTenis.' : 'Desafio de ranking UCTenis.',
      'Organizador: ' + text(data.retadorNombre) + ' <' + text(data.retadorEmail) + '>',
      'Invitado: ' + text(data.retadoNombre) + ' <' + text(data.retadoEmail) + '>',
      'Fecha: ' + (text(data.fechaLabel) || fecha),
      slot ? 'Hora: ' + slot : '',
      'Cancha: ' + text(data.cancha),
      '',
      isFriendly 
        ? 'Acepten o rechacen el partido amistoso en la pagina de UCTenis.' 
        : 'La cancha ya queda reservada por el sistema. Acepten o rechacen el desafio en la pagina de ranking.'
    ].filter(Boolean).join('\n');

    let event;
    if (/^\d{1,2}:\d{2}$/.test(slot)) {
      const dateParts = fecha.split('-').map(Number);
      const timeParts = slot.split(':').map(Number);
      const start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1], 0);
      const end = new Date(start.getTime() + 90 * 60 * 1000);
      event = calendar.createEvent(title, start, end, {
        description: description,
        location: text(data.cancha),
        guests: guests,
        sendInvites: true
      });
    } else {
      const dateParts = fecha.split('-').map(Number);
      const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      event = calendar.createAllDayEvent(title, date, {
        description: description,
        location: text(data.cancha),
        guests: guests,
        sendInvites: true
      });
    }

    if (CalendarApp.EventTransparency && CalendarApp.EventTransparency.TRANSPARENT) {
      event.setTransparency(CalendarApp.EventTransparency.TRANSPARENT);
    }
    return { ok: true, eventId: event.getId(), calendarId: 'default' };
  } catch (error) {
    return { ok: false, msg: error.message };
  }
}

function courtKeyFromName(value) {
  const raw = norm(value).replace(/\s+/g, '');
  if (raw.indexOf('cec1') >= 0 || (raw.indexOf('cec') >= 0 && raw.indexOf('1') >= 0)) return 'cec1';
  if (raw.indexOf('cec2') >= 0 || (raw.indexOf('cec') >= 0 && raw.indexOf('2') >= 0)) return 'cec2';
  if (raw.indexOf('cjp1') >= 0 || (raw.indexOf('cjp') >= 0 && raw.indexOf('1') >= 0)) return 'cjp1';
  if (raw.indexOf('cjp2') >= 0 || (raw.indexOf('cjp') >= 0 && raw.indexOf('2') >= 0)) return 'cjp2';
  return '';
}

function getChallenges() {
  const sheet = getChallengesSheet();
  const values = sheet.getDataRange().getValues();
  const challenges = [];
  let updatedAny = false;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!text(row[0])) continue;
    let challenge = challengeFromRow(row);
    const rowStatus = text(row[10]);

    if (challenge.status === 'completado' && rowStatus !== 'completado') {
      const completedAt = challenge.actualizado || new Date().toISOString();
      challenge.actualizado = completedAt;
      sheet.getRange(i + 1, 11).setValue('completado');
      sheet.getRange(i + 1, 15).setValue(completedAt);
      updatedAny = true;
    }

    // Sync with Google Calendar if it's pending and has an eventId
    if (challenge.status === 'pendiente' && challenge.eventId) {
      try {
        const calendar = CalendarApp.getDefaultCalendar();
        const event = calendar.getEventById(challenge.eventId);
        if (event) {
          const guests = event.getGuestList();
          const retadoEmailNorm = challenge.retadoEmail.toLowerCase().trim();
          let retadoGuest = guests.find(g => g.getEmail().toLowerCase().trim() === retadoEmailNorm);

          if (retadoGuest) {
            const status = retadoGuest.getGuestStatus();
            if (status === CalendarApp.GuestStatus.YES) {
              challenge.status = 'aceptado';
              challenge.actualizado = new Date().toISOString();
              sheet.getRange(i + 1, 11).setValue('aceptado');
              sheet.getRange(i + 1, 15).setValue(challenge.actualizado);
              updatedAny = true;
              updateChallengeInFirebase(challenge.id, {
                status: 'aceptado',
                actualizado: challenge.actualizado
              });
            } else if (status === CalendarApp.GuestStatus.NO) {
              challenge.status = 'rechazado';
              challenge.actualizado = new Date().toISOString();
              sheet.getRange(i + 1, 11).setValue('rechazado');
              sheet.getRange(i + 1, 15).setValue(challenge.actualizado);
              updatedAny = true;
              updateChallengeInFirebase(challenge.id, {
                status: 'rechazado',
                actualizado: challenge.actualizado
              });

              // Deletar reserva de cancha también
              try {
                if (challenge.bookingId && challenge.courtId) {
                  const calId = CONFIG.CALENDARS[challenge.courtId];
                  if (calId) {
                    const courtCal = CalendarApp.getCalendarById(calId);
                    if (courtCal) {
                      const bookingEvent = courtCal.getEventById(challenge.bookingId);
                      if (bookingEvent) bookingEvent.deleteEvent();
                    }
                  }
                }
              } catch (e) {
                console.warn('Error deleting booking event on calendar reject: ' + e.message);
              }
            }
          }
        }
      } catch (calErr) {
        console.warn('Error checking calendar event status: ' + calErr.message);
      }
    }

    challenges.push(challenge);
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
    status: text(data.status) || 'pendiente',
    marcador: text(data.marcador) || '',
    ganadorId: text(data.ganadorId) || '',
    creado: now,
    actualizado: now,
    slot: text(data.slot),
    courtId: text(data.courtId),
    eventId: '',
    bookingId: text(data.bookingId),
    tipo: text(data.tipo) || 'ranking'
  };
  normalizeChallengeCompletion(challenge);

  try {
    if (challenge.status !== 'completado' && challenge.retadoEmail) {
      const res = notifyChallenge(challenge);
      if (res.ok && res.calendar && res.calendar.ok) {
        challenge.eventId = res.calendar.eventId;
      }
    }
  } catch (mailError) {
    challenge.notificationError = mailError.message;
  }

  sheet.appendRow(challengeToRow(challenge));

  if (challenge.status === 'completado') {
    applyChallengeResultToRanking(challenge);
  }

  return { ok: true, challenge: publicChallenge(challenge) };
}

function respondChallenge(data) {
  const found = findChallengeRow(text(data.id));
  if (!found) return { ok: false, msg: 'Desafío no encontrado.' };

  let status = 'rechazado';
  if (data.status === 'eliminado' || data.accept === 'eliminado') {
    status = 'eliminado';
  } else if (data.accept === true || data.accept === 'true' || data.status === 'aceptado') {
    status = 'aceptado';
  }
  
  // Read challenge data from row before doing any updates or deletions
  const challenge = challengeFromRow(found.sheet.getRange(found.rowNumber, 1, 1, 20).getValues()[0]);

  // If status is rechazado or eliminado, free the calendar reservations!
  if (status === 'rechazado' || status === 'eliminado') {
    try {
      if (challenge.bookingId && challenge.courtId) {
        const calId = CONFIG.CALENDARS[challenge.courtId];
        if (calId) {
          const courtCal = CalendarApp.getCalendarById(calId);
          if (courtCal) {
            const bookingEvent = courtCal.getEventById(challenge.bookingId);
            if (bookingEvent) bookingEvent.deleteEvent();
          }
        }
      }
    } catch (e) {
      console.warn('Error deleting court reservation: ' + e.message);
    }

    try {
      if (challenge.eventId) {
        const defaultCal = CalendarApp.getDefaultCalendar();
        if (defaultCal) {
          const inviteEvent = defaultCal.getEventById(challenge.eventId);
          if (inviteEvent) inviteEvent.deleteEvent();
        }
      }
    } catch (e) {
      console.warn('Error deleting challenge invite: ' + e.message);
    }
  }

  if (status === 'eliminado') {
    // Delete row physically
    found.sheet.deleteRow(found.rowNumber);
    challenge.status = 'eliminado';
  } else {
    // Regular update
    found.sheet.getRange(found.rowNumber, 11).setValue(status);
    found.sheet.getRange(found.rowNumber, 15).setValue(new Date().toISOString());
    challenge.status = status;
    challenge.actualizado = new Date().toISOString();
  }

  return { ok: true, challenge: publicChallenge(challenge) };
}

function submitChallengeResult(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const found = findChallengeRow(text(data.id));
    if (!found) return { ok: false, msg: 'Desafío no encontrado.' };

    const previous = challengeFromRow(found.sheet.getRange(found.rowNumber, 1, 1, 20).getValues()[0]);
    const wasCompleted = previous.status === 'completado';

    found.sheet.getRange(found.rowNumber, 11).setValue('completado');
    found.sheet.getRange(found.rowNumber, 12).setValue(text(data.marcador));
    found.sheet.getRange(found.rowNumber, 13).setValue(text(data.ganadorId));
    found.sheet.getRange(found.rowNumber, 15).setValue(new Date().toISOString());
    if (data.tipo) {
      found.sheet.getRange(found.rowNumber, 20).setValue(text(data.tipo));
    }

    const updated = challengeFromRow(found.sheet.getRange(found.rowNumber, 1, 1, 20).getValues()[0]);
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

  const headers = ['id', 'retadorId', 'retadorNombre', 'retadorEmail', 'retadoId', 'retadoNombre', 'retadoEmail', 'genero', 'fecha', 'cancha', 'status', 'marcador', 'ganadorId', 'creado', 'actualizado', 'slot', 'courtId', 'eventId', 'bookingId', 'tipo'];
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
  const challenge = {
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
    actualizado: text(row[14]),
    slot: text(row[15]) || '',
    courtId: text(row[16]) || '',
    eventId: text(row[17]) || '',
    bookingId: text(row[18]) || '',
    tipo: text(row[19]) || 'ranking'
  };
  return normalizeChallengeCompletion(challenge);
}

function hasRecordedChallengeResult(challenge) {
  return Boolean(
    challenge &&
    (text(challenge.marcador) || text(challenge.ganadorId))
  );
}

function normalizeChallengeCompletion(challenge) {
  if (hasRecordedChallengeResult(challenge) && challenge.status !== 'eliminado') {
    challenge.status = 'completado';
  } else if (challenge && ['pendiente', 'aceptado', 'terminado'].includes(challenge.status)) {
    if (challenge.fecha) {
      const dateParts = challenge.fecha.split('-').map(Number);
      const slot = challenge.slot || '23:59';
      const timeParts = slot.split(':').map(Number);
      if (dateParts.length === 3 && timeParts.length >= 2) {
        const matchStart = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1], 0);
        if (new Date() > matchStart) {
          challenge.status = 'terminado';
        }
      }
    }
  }
  return challenge;
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
    challenge.actualizado,
    challenge.slot || '',
    challenge.courtId || '',
    challenge.eventId || '',
    challenge.bookingId || '',
    challenge.tipo || 'ranking'
  ];
}

function publicChallenge(challenge) {
  return {
    id: challenge.id,
    retadorId: challenge.retadorId,
    retadorNombre: challenge.retadorNombre,
    retadoId: challenge.retadoId,
    retadoNombre: challenge.retadoNombre,
    genero: challenge.genero,
    fecha: challenge.fecha,
    cancha: challenge.cancha,
    status: challenge.status,
    marcador: challenge.marcador || null,
    ganadorId: challenge.ganadorId || null,
    creado: challenge.creado,
    actualizado: challenge.actualizado,
    slot: challenge.slot || '',
    courtId: challenge.courtId || '',
    eventId: challenge.eventId || '',
    bookingId: challenge.bookingId || '',
    tipo: challenge.tipo || 'ranking'
  };
}

// =======================================================
// 👥 FUNCIONES DE MIEMBROS (Validación desde Google Sheets)
// =======================================================

function validateMember(email) {
  if (!email) return { ok: false, msg: "Correo no proporcionado." };
  const needle = email.toLowerCase().trim();

  const isAdmin = isAdminRequest({ actorEmail: needle });

  const firebasePlayer = findFirebasePlayerByEmail(needle);
  if (firebasePlayer) {
    return {
      ok: true,
      msg: "Miembro validado.",
      source: "firebase",
      player: firebasePlayer,
      isAdmin: isAdmin || isAdminRequest({ actorEmail: needle, actorName: firebasePlayer.nombre })
    };
  }

  if (isAdmin) {
    return {
      ok: true,
      msg: "Administrador validado.",
      source: "admin",
      isAdmin: true
    };
  }

  return { ok: false, msg: "El correo no se encuentra registrado en Firebase." };
}

function updateChallengeInFirebase(challengeId, fields) {
  if (!CONFIG.FIREBASE_PROJECT_ID || !CONFIG.FIREBASE_API_KEY || !challengeId) return;
  try {
    const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/'
      + encodeURIComponent(CONFIG.FIREBASE_PROJECT_ID)
      + '/databases/(default)/documents/ranking_challenges/'
      + encodeURIComponent(challengeId)
      + '?key=' + encodeURIComponent(CONFIG.FIREBASE_API_KEY);
    
    const docFields = {};
    const fieldPaths = [];
    Object.entries(fields).forEach(([key, val]) => {
      if (val === null || val === undefined) return;
      docFields[key] = { stringValue: String(val) };
      fieldPaths.push('updateMask.fieldPaths=' + encodeURIComponent(key));
    });

    const payload = {
      fields: docFields
    };

    const urlWithMask = firestoreUrl + '&' + fieldPaths.join('&');

    const response = UrlFetchApp.fetch(urlWithMask, {
      method: 'patch',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() >= 300) {
      console.warn('Error updating Firebase Firestore in updateChallengeInFirebase: ' + response.getContentText());
    }
  } catch (err) {
    console.warn('Error updating Firebase Firestore in updateChallengeInFirebase:', err);
  }
}

function findFirebasePlayerByEmail(email) {
  const needle = text(email).toLowerCase();
  if (!needle || !CONFIG.FIREBASE_PROJECT_ID || !CONFIG.FIREBASE_API_KEY) return null;

  const fieldsToTry = ['emailLower', 'email'];
  for (let i = 0; i < fieldsToTry.length; i++) {
    const player = queryFirebasePlayerByEmailField(fieldsToTry[i], needle);
    if (player) return player;
  }
  return null;
}

function queryFirebasePlayerByEmailField(fieldPath, email) {
  try {
    const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/'
      + encodeURIComponent(CONFIG.FIREBASE_PROJECT_ID)
      + '/databases/(default)/documents:runQuery?key='
      + encodeURIComponent(CONFIG.FIREBASE_API_KEY);
    const queryPayload = {
      structuredQuery: {
        from: [{ collectionId: 'ranking_players' }],
        where: {
          fieldFilter: {
            field: { fieldPath: fieldPath },
            op: 'EQUAL',
            value: { stringValue: fieldPath === 'emailLower' ? email : email }
          }
        },
        limit: 1
      }
    };
    const response = UrlFetchApp.fetch(firestoreUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(queryPayload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      console.warn('Respuesta no exitosa de Firestore: ' + response.getResponseCode() + ' - ' + response.getContentText());
      return null;
    }

    const results = JSON.parse(response.getContentText());
    for (let i = 0; i < results.length; i++) {
      if (!results[i].document) continue;
      const player = firebasePlayerFromDocument(results[i].document);
      if (player && player.email && text(player.email).toLowerCase() === email && isFirebasePlayerActive(player)) {
        return player;
      }
    }
  } catch (fbError) {
    console.warn('Error al consultar Firebase Firestore en validateMember:', fbError);
  }
  return null;
}

function firebasePlayerFromDocument(doc) {
  const fields = doc.fields || {};
  const id = text(firestoreField(fields, 'id')) || doc.name.split('/').pop();
  return {
    id: id,
    nombre: text(firestoreField(fields, 'nombre')),
    email: text(firestoreField(fields, 'email')),
    genero: text(firestoreField(fields, 'genero') || firestoreField(fields, 'gender')),
    categoria: text(firestoreField(fields, 'categoria')),
    mano: text(firestoreField(fields, 'mano') || firestoreField(fields, 'manoHabil')),
    reves: text(firestoreField(fields, 'reves')),
    foto: text(firestoreField(fields, 'foto')),
    telefono: text(firestoreField(fields, 'telefono')),
    activo: firestoreBool(fields, 'activo', true),
    participaRanking: firestoreBool(fields, 'participaRanking', true)
  };
}

function firestoreField(fields, name) {
  const value = fields && fields[name];
  if (!value) return '';
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  return '';
}

function firestoreBool(fields, name, fallback) {
  const value = fields && fields[name];
  if (!value || !Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return fallback;
  return value.booleanValue;
}

function isFirebasePlayerActive(player) {
  return player.activo !== false && player.participaRanking !== false;
}

// =======================================================
// 📅 FUNCIONES DE CALENDARIO (Disponibilidad y Creación)
// =======================================================

/**
 * SOLUCIÓN DEFINITIVA DE ZONA HORARIA
 * 
 * Usa Utilities.formatDate(date, 'America/Santiago', 'Z') para detectar
 * el offset UTC real de Chile en cualquier fecha, manejando automáticamente
 * el cambio de horario de verano/invierno.
 *
 * Dado un dateStr "YYYY-MM-DD" y un slot "HH:MM",
 * retorna el timestamp UTC correcto que corresponde a esa hora en Santiago.
 * Funciona sin importar la zona horaria configurada en el proyecto de Apps Script.
 */
function getChileOffsetStr(dateStr) {
  // Usamos mediodia UTC del dia para calcular el offset de Santiago ese dia
  // (evita ambiguedad en cambios de horario que ocurren a medianoche)
  var noonUTC = new Date(dateStr + 'T12:00:00Z');
  // Utilities.formatDate con 'Z' retorna e.g. "-0400" o "-0300"
  var raw = Utilities.formatDate(noonUTC, 'America/Santiago', 'Z');
  // Convertir "-0400" → "-04:00"
  return raw.slice(0, 3) + ':' + raw.slice(3);
}

function makeLocalDate(dateStr, slot) {
  var offsetStr = getChileOffsetStr(dateStr);
  return new Date(dateStr + 'T' + slot + ':00' + offsetStr);
}

function getAvailableSlots(dateStr) {
  // dateStr en formato YYYY-MM-DD
  var offsetStr = getChileOffsetStr(dateStr); // e.g. "-04:00" o "-03:00"
  // Nota: CHILE_OFFSET se mantiene por compatibilidad con código legacy
  var CHILE_OFFSET = offsetStr;

  // startOfDay y endOfDay exactos en hora de Santiago (con offset real del dia)
  var startOfDay = new Date(dateStr + 'T00:00:00' + offsetStr);
  var endOfDay   = new Date(dateStr + 'T23:59:59' + offsetStr);

  // Dia de la semana segun Santiago (0=Dom, 1=Lun, ..., 6=Sab)
  // 'u' en SimpleDateFormat: 1=Lun ... 7=Dom → aplicamos % 7 para 0=Dom
  var noonUTC = new Date(dateStr + 'T12:00:00Z');
  var dayOfWeek = parseInt(Utilities.formatDate(noonUTC, 'America/Santiago', 'u'), 10) % 7;

  let result = { ok: true, date: dateStr, courts: {}, playable: {}, busyLabels: {} };

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
    
    // TODOS los eventos en el calendario de una cancha bloquean ese horario.
    // Los calendarios de canchas son dedicados exclusivamente a reservas, por lo que
    // cualquier evento —creado manualmente o por el sistema— debe marcar el slot como ocupado.
    // El título solo se usa para asignar una etiqueta descriptiva al usuario (ej: "Clases UCTenis").
    let busyTimes = [];
    events.forEach(e => {
      const rawTitle = e.getTitle() || '';
      const title = rawTitle.toLowerCase();
      let busyLabel = '';

      // Detectar etiqueta descriptiva según el título del evento
      if (title.includes('clases uctenis') || title.includes('clase uctenis')) {
        // Solo mostrar como "Clases UCTenis" si no hay override all_day que lo libere
        if (!specialCourts[courtKey]) {
          busyLabel = 'Clases UCTenis';
        }
      }

      busyTimes.push({
        start: e.getStartTime().getTime(),
        end: e.getEndTime().getTime(),
        label: busyLabel
      });
    });
    
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
    result.busyLabels[courtKey] = {};
    
    let availableSlots = [];
    candidateSlots.forEach(slot => {
      // ✅ SOLUCION DEFINITIVA: makeLocalDate usa Utilities.formatDate para obtener
      // el offset real de Santiago ese dia, sin depender de la TZ del servidor.
      // Esto detecta CUALQUIER evento del calendario (manual o automatico).
      let slotStart = makeLocalDate(dateStr, slot);
      let slotEnd   = new Date(slotStart.getTime() + 90 * 60000); // +1.5 horas

      // Comprobar si el bloque se superpone con algun evento (cualquier evento bloquea)
      let busyMatch = busyTimes.find(b => {
        return (slotStart.getTime() < b.end && slotEnd.getTime() > b.start);
      });

      if (!busyMatch) {
        availableSlots.push(slot);
      } else if (busyMatch.label) {
        result.busyLabels[courtKey][slot] = busyMatch.label;
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
  
  // 3. Calcular tiempos con zona horaria real de Santiago (detectada dinamicamente)
  let startTime = makeLocalDate(data.date, data.slot);
  let endTime   = new Date(startTime.getTime() + 90 * 60000); // 1.5 hrs
  
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
        description: `Reserva automática generada desde la plataforma web.\nUsuario: ${data.name}\nCorreo: ${data.email}\nRUT: ${data.rut || 'No registrado'}\nCancha: ${data.courtId.toUpperCase()}`,
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

const PLAYER_HEADERS = ['ID', 'Nombre', 'Genero', 'Fecha nac', 'Categoria', 'Mano Habil', 'Reves', 'Foto', 'Ranking', 'Pos. Anterior', 'Correo', 'Rut'];
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
    if (player.activo) {
      ensurePlayerInRanking(ss, player, numberOrBlank(data.posicion));
    } else {
      removePlayerFromRankings(ss, player);
    }

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

function adminReorderRanking(data) {
  if (!isAdminRequest(data)) return { ok: false, msg: 'Acceso reservado al administrador.' };

  const genero = normalizeGender(data.genero);
  if (!genero) return { ok: false, msg: 'Género no válido.' };

  const orderedIds = data.orderedIds;
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return { ok: false, msg: 'Falta la lista ordenada de jugadores.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = getSpreadsheet();
    // 1. Read existing ranking entries
    const entries = readRankingEntries(ss, genero);
    
    // 2. Build previous map
    const previousMap = buildPreviousPositionMap(entries);
    
    // 3. Sort entries based on orderedIds position
    const entryMap = {};
    entries.forEach(entry => {
      const key = entry.id || entry.nombre;
      if (key) entryMap[key] = entry;
    });
    
    const reorderedEntries = [];
    orderedIds.forEach(id => {
      if (entryMap[id]) {
        reorderedEntries.push(entryMap[id]);
        delete entryMap[id];
      }
    });
    
    // Append remaining
    Object.values(entryMap).forEach(remaining => {
      reorderedEntries.push(remaining);
    });

    // 4. Renumber positions
    const finalEntries = reorderedEntries.map((entry, index) => ({
      ...entry,
      posicion: index + 1
    }));

    // 5. Write to Sheets
    writeRankingEntries(ss, genero, finalEntries, previousMap);
    syncPlayerRankingColumns(ss, genero, finalEntries, previousMap);

    return { ok: true, ranking: getRanking() };
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

    if (!player) {
      const base = validation.player || {};
      const created = normalizePlayerPayload({
        ...base,
        ...data,
        id: text(data.actorId || data.id || base.id),
        nombre: text(data.nombre || data.actorName || data.actorNombre || base.nombre),
        email: actorEmail,
        genero: text(data.genero || data.gender || base.genero || base.gender)
      }, null);

      if (!created.nombre) return { ok: false, msg: 'Ingresa tu nombre para crear tu ficha.' };
      if (!created.genero) return { ok: false, msg: 'Selecciona ranking masculino o femenino.' };
      if (!created.id) created.id = generatePlayerId(index, created.genero);
      if (data.photoDataUrl) created.foto = savePlayerPhoto(data, created);

      const duplicate = index.players.find(item =>
        item.id !== created.id &&
        ((created.email && item.email && item.email.toLowerCase() === created.email.toLowerCase()) ||
         norm(item.nombre) === norm(created.nombre))
      );
      if (duplicate) return { ok: false, msg: 'Ya existe un jugador con ese nombre o correo.' };

      index.sheet.getRange(index.sheet.getLastRow() + 1, 1, 1, PLAYER_HEADERS.length).setValues([playerToRow(created)]);
      ensurePlayerInRanking(ss, created, numberOrBlank(data.posicion || created.ranking));
      return { ok: true, player: publicPlayer(created), ranking: getRanking() };
    }

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
  if (text(challenge.tipo) === 'amistoso') {
    return { ok: true, moved: false, msg: 'Partido amistoso: no se altera el ranking.' };
  }

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
    const filtered = entries.filter(entry => !matchesPlayerReference(entry, player));
    if (filtered.length !== entries.length) {
      const previousMap = {};
      filtered.forEach((entry, index) => {
        const key = rankingEntryKey(entry);
        previousMap[key] = index + 1;
      });
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
    email: text(row[10]),
    rut: text(row[11])
  };
}

function normalizePlayerPayload(data, existing) {
  const base = existing || {};
  const genero = normalizeGender(payloadField(data, ['genero', 'gender'], base.genero));
  const activo = data.activo !== false && data.activo !== 'false' && data.participaRanking !== false && data.participaRanking !== 'false';

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
    email: payloadField(data, ['email', 'correo'], base.email),
    rut: payloadField(data, ['rut'], base.rut),
    activo: activo
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
    player.email,
    player.rut || ''
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
    email: player.email,
    rut: player.rut || ''
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
    if (challenge.tipo !== 'amistoso') {
      ganador.pts += 3;
    }
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
