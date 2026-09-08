/* Selector de fecha propio para toda la web (input.uct-date): reemplaza el
 * calendario nativo del navegador -- que solo se abre pinchando el icono y
 * no se puede re-diseñar -- por un popup propio, con clic en cualquier
 * parte del campo. El valor del input se mantiene siempre en formato ISO
 * (yyyy-mm-dd), igual que el <input type="date"> nativo, para no romper el
 * codigo existente que lee/escribe ese valor.
 */
(() => {
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const WEEKDAYS = ['L','M','M','J','V','S','D'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function toISO(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
  function parseISO(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  let openState = null; // { input, pop }

  function closePopup() {
    if (!openState) return;
    openState.pop.remove();
    openState.input.setAttribute('aria-expanded', 'false');
    openState = null;
    document.removeEventListener('mousedown', onOutsideClick, true);
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('scroll', closePopup, true);
    window.removeEventListener('resize', closePopup, true);
  }

  function onOutsideClick(event) {
    if (!openState) return;
    if (openState.pop.contains(event.target) || event.target === openState.input) return;
    closePopup();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') closePopup();
  }

  function buildPopup(input) {
    const min = parseISO(input.getAttribute('min'));
    const max = parseISO(input.getAttribute('max'));
    const selected = parseISO(input.value);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const view = { y: (selected || today).getFullYear(), m: (selected || today).getMonth() };

    const pop = document.createElement('div');
    pop.className = 'uct-datepicker-pop';
    pop.setAttribute('role', 'dialog');

    function render() {
      const first = new Date(view.y, view.m, 1);
      const startOffset = (first.getDay() + 6) % 7; // semana empieza en lunes
      const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startOffset; i++) cells.push('');
      for (let d = 1; d <= daysInMonth; d++) cells.push(d);

      const yearOptions = [];
      const currentYear = today.getFullYear();
      for (let y = currentYear - 100; y <= currentYear + 6; y++) yearOptions.push(y);

      pop.innerHTML = `
        <div class="uct-dp-head">
          <button type="button" class="uct-dp-nav" data-nav="-1" aria-label="Mes anterior">&#8249;</button>
          <div class="uct-dp-headsel">
            <select class="uct-dp-month" aria-label="Mes"></select>
            <select class="uct-dp-year" aria-label="A&ntilde;o"></select>
          </div>
          <button type="button" class="uct-dp-nav" data-nav="1" aria-label="Mes siguiente">&#8250;</button>
        </div>
        <div class="uct-dp-weekdays">${WEEKDAYS.map(w => `<span>${w}</span>`).join('')}</div>
        <div class="uct-dp-grid">${cells.map(d => {
          if (!d) return '<span class="uct-dp-cell uct-dp-empty"></span>';
          const cellDate = new Date(view.y, view.m, d);
          const disabled = (min && cellDate < min) || (max && cellDate > max);
          const isToday = sameDay(cellDate, today);
          const isSelected = sameDay(cellDate, selected);
          const classes = ['uct-dp-cell', 'uct-dp-day'];
          if (isToday) classes.push('is-today');
          if (isSelected) classes.push('is-selected');
          if (disabled) classes.push('is-disabled');
          return `<button type="button" class="${classes.join(' ')}" data-day="${d}" ${disabled ? 'disabled' : ''}>${d}</button>`;
        }).join('')}</div>
        <div class="uct-dp-foot">
          <button type="button" class="uct-dp-today">Hoy</button>
          ${input.required ? '' : '<button type="button" class="uct-dp-clear">Limpiar</button>'}
        </div>`;

      const monthSel = pop.querySelector('.uct-dp-month');
      MONTHS.forEach((name, index) => monthSel.add(new Option(name, index, false, index === view.m)));
      const yearSel = pop.querySelector('.uct-dp-year');
      yearOptions.forEach(y => yearSel.add(new Option(y, y, false, y === view.y)));

      monthSel.addEventListener('change', () => { view.m = Number(monthSel.value); render(); });
      yearSel.addEventListener('change', () => { view.y = Number(yearSel.value); render(); });

      pop.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click', () => {
        view.m += Number(btn.dataset.nav);
        if (view.m < 0) { view.m = 11; view.y--; }
        if (view.m > 11) { view.m = 0; view.y++; }
        render();
      }));

      pop.querySelectorAll('.uct-dp-day:not(.is-disabled)').forEach(btn => btn.addEventListener('click', () => {
        selectValue(input, toISO(view.y, view.m, Number(btn.dataset.day)));
        closePopup();
      }));

      const todayBtn = pop.querySelector('.uct-dp-today');
      if (todayBtn) todayBtn.addEventListener('click', () => {
        selectValue(input, toISO(today.getFullYear(), today.getMonth(), today.getDate()));
        closePopup();
      });
      const clearBtn = pop.querySelector('.uct-dp-clear');
      if (clearBtn) clearBtn.addEventListener('click', () => {
        selectValue(input, '');
        closePopup();
      });
    }

    render();
    return pop;
  }

  function selectValue(input, isoValue) {
    input.value = isoValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function positionPopup(input, pop) {
    const rect = input.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < popRect.height + 12 && rect.top > popRect.height + 12;
    pop.style.top = openUp ? `${Math.max(8, rect.top - popRect.height - 6)}px` : `${rect.bottom + 6}px`;
    let left = rect.left;
    left = Math.min(left, window.innerWidth - popRect.width - 8);
    left = Math.max(8, left);
    pop.style.left = `${left}px`;
  }

  function openPopup(input) {
    if (openState && openState.input === input) return;
    closePopup();
    const pop = buildPopup(input);
    pop.style.position = 'fixed';
    pop.style.visibility = 'hidden';
    document.body.appendChild(pop);
    positionPopup(input, pop);
    pop.style.visibility = 'visible';
    input.setAttribute('aria-expanded', 'true');
    openState = { input, pop };
    document.addEventListener('mousedown', onOutsideClick, true);
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('scroll', closePopup, true);
    window.addEventListener('resize', closePopup, true);
  }

  document.addEventListener('click', event => {
    const input = event.target.closest('input.uct-date');
    if (input && !input.disabled) openPopup(input);
  });
  document.addEventListener('keydown', event => {
    const input = event.target.closest && event.target.closest('input.uct-date');
    if (input && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openPopup(input);
    }
  });
})();
