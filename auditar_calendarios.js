/**
 * UCTenis - Auditoría de calendarios de la cuenta del club
 *
 * Solo LEE: no mueve, edita ni borra nada.
 *
 * USO:
 * 1. En el proyecto de Apps Script del club, crea un archivo nuevo y pega esto.
 * 2. Elige la función "auditarCalendarios" y pulsa "Ejecutar".
 * 3. Revisa el "Registro de ejecución".
 *
 * Muestra, por cada calendario de la cuenta, cuántos eventos tiene desde hoy
 * hasta un año más y cuáles son, marcando cuál es el calendario maestro que
 * usa la plataforma (CONFIG.MAIN_CALENDAR_ID) y cuál es el principal de la
 * cuenta (ese no se puede eliminar; ahí van las invitaciones de desafíos).
 */
function auditarCalendarios() {
  const mainId = CONFIG.MAIN_CALENDAR_ID;
  const defaultId = CalendarApp.getDefaultCalendar().getId();
  const from = new Date();
  const to = new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000);
  const lines = [];

  CalendarApp.getAllCalendars().forEach(function(calendar) {
    const id = calendar.getId();
    const tags = [];
    if (id === mainId) tags.push('MAESTRO DE LA PLATAFORMA — conservar');
    if (id === defaultId) tags.push('principal de la cuenta — no se puede eliminar');
    if (!calendar.isOwnedByMe()) tags.push('ajeno/suscrito');

    const byTitle = {};
    let total = 0;
    calendar.getEvents(from, to).forEach(function(ev) {
      const title = ev.getTitle() || '(sin título)';
      if (!byTitle[title]) {
        byTitle[title] = { count: 0, recurring: ev.isRecurringEvent(), first: ev.getStartTime() };
      }
      byTitle[title].count++;
      total++;
    });

    lines.push('');
    lines.push('■ ' + calendar.getName() + (tags.length ? '  [' + tags.join(' | ') + ']' : ''));
    lines.push('  ID: ' + id);
    lines.push('  Eventos de hoy a un año: ' + total);
    Object.keys(byTitle).sort().forEach(function(title) {
      const item = byTitle[title];
      lines.push('    · ' + title + ' — ' + item.count + (item.recurring ? ' (serie recurrente)' : '')
        + ', primero el ' + Utilities.formatDate(item.first, 'America/Santiago', 'dd/MM/yyyy HH:mm'));
    });
  });

  if (!CalendarApp.getCalendarById(mainId)) {
    lines.unshift('⚠️ El calendario maestro configurado (CONFIG.MAIN_CALENDAR_ID) no existe o esta cuenta no tiene acceso.');
  }
  console.log(lines.join('\n'));
}
