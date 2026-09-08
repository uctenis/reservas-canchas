/* Selector de fecha propio para toda la web (input.uct-date): reemplaza el
 * calendario nativo del navegador -- que solo se abre pinchando el icono y
 * no se puede re-diseñar -- por un popup propio, con clic en cualquier
 * parte del campo.
 *
 * Cada <input class="uct-date"> del HTML se "mejora" en dos piezas:
 *   - el input original (oculto, visualmente-invisible) sigue siendo la
 *     fuente de verdad: conserva su id y su valor SIEMPRE en formato ISO
 *     (yyyy-mm-dd), asi que todo el codigo existente que hace
 *     document.getElementById(id).value sigue funcionando igual, sin
 *     tocar un solo call-site.
 *   - un input visible nuevo, insertado justo al lado, es el que el
 *     usuario ve y toca: muestra la fecha en formato chileno (dd/mm/aaaa)
 *     y abre el calendario propio al hacer clic.
 * Un setter propio sobre el input oculto mantiene ambos sincronizados
 * automaticamente, venga la asignacion de este archivo o de cualquier otro
 * (p.ej. chal_fecha.value = todayISO() en ranking.html).
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
  // Formato chileno dia/mes/año para lo que ve el usuario; el valor real
  // (ISO) que usa el resto del sitio nunca cambia.
  function formatDisplayDate(iso) {
    const d = parseISO(iso);
    return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
  }

  // =====================================================================
  // Mejora de inputs: input oculto (fuente ISO) + input visible (dd/mm/aaaa)
  // =====================================================================

  function enhance(realInput) {
    if (realInput.dataset.uctEnhanced) return;
    realInput.dataset.uctEnhanced = '1';

    const display = document.createElement('input');
    display.type = 'text';
    display.className = 'uct-date';
    // Sin esto, el observer de mutaciones (mas abajo) ve este mismo input
    // recien creado -- que tambien tiene la clase "uct-date" -- como si
    // fuera OTRO campo sin mejorar, y lo vuelve a "mejorar" en cascada
    // (ocultandolo y creando un tercero, encima otro, etc.).
    display.dataset.uctEnhanced = '1';
    display.readOnly = true;
    display.autocomplete = 'off';
    display.placeholder = 'dd/mm/aaaa';
    if (realInput.required) display.required = true;
    if (realInput.disabled) display.disabled = true;
    // Varios campos traen su propio "style" inline (ancho, padding, colores
    // particulares de ese formulario); se copia al input visible para que
    // se vea igual que antes -- el input original queda oculto de todas
    // formas, asi que conservar su estilo ahi no serviria de nada.
    const inlineStyle = realInput.getAttribute('style');
    if (inlineStyle) display.setAttribute('style', inlineStyle);
    realInput.insertAdjacentElement('afterend', display);

    realInput.classList.remove('uct-date');
    realInput.classList.add('uct-date-source');
    realInput.tabIndex = -1;
    realInput.setAttribute('aria-hidden', 'true');

    display._uctReal = realInput;
    realInput._uctDisplay = display;

    // El <label for="..."> del HTML original sigue apuntando al id del
    // input oculto (no se toco el markup): al hacer clic en la etiqueta el
    // navegador enfoca ese input escondido. Se redirige el foco (y se abre
    // el calendario) al input visible en vez de dejarlo en un campo que no
    // se ve.
    realInput.addEventListener('focus', () => {
      display.focus();
      openPopup(display);
    });

    function refreshDisplay() { display.value = formatDisplayDate(realInput.value); }

    // Redefine "value" solo en esta instancia: el getter/setter nativos
    // siguen intactos (se delega a ellos), asi que .value sigue siendo ISO
    // para cualquier lectura existente. Solo se agrega el efecto lateral de
    // refrescar el input visible en cada escritura, venga de donde venga.
    const nativeDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    Object.defineProperty(realInput, 'value', {
      configurable: true,
      enumerable: true,
      get() { return nativeDescriptor.get.call(realInput); },
      set(v) { nativeDescriptor.set.call(realInput, v); refreshDisplay(); }
    });

    // El estado disabled tambien puede cambiar despues (p.ej. al reprogramar
    // un partido de campeonato); se refleja en el input visible con el mismo
    // truco.
    const disabledDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'disabled');
    Object.defineProperty(realInput, 'disabled', {
      configurable: true,
      enumerable: true,
      get() { return disabledDescriptor.get.call(realInput); },
      set(v) { disabledDescriptor.set.call(realInput, v); display.disabled = v; }
    });

    refreshDisplay();
  }

  function enhanceAllWithin(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('input.uct-date') && !root.dataset.uctEnhanced) enhance(root);
    root.querySelectorAll('input.uct-date:not([data-uct-enhanced])').forEach(enhance);
  }

  enhanceAllWithin(document);

  // Los formularios de ranking.html/admin-campeonatos.js reconstruyen
  // secciones enteras con innerHTML (nuevo jugador, novedades, partidos de
  // campeonato...); un observer capta esos inputs nuevos sin tener que
  // avisar manualmente desde cada uno de esos renders.
  let scanScheduled = false;
  const observer = new MutationObserver(() => {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      enhanceAllWithin(document);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // =====================================================================
  // Popup del calendario
  // =====================================================================

  let openState = null; // { display, real, pop }

  function closePopup() {
    if (!openState) return;
    openState.pop.remove();
    openState.display.setAttribute('aria-expanded', 'false');
    openState = null;
    document.removeEventListener('mousedown', onOutsideClick, true);
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('scroll', closePopup, true);
    window.removeEventListener('resize', closePopup, true);
  }

  function onOutsideClick(event) {
    if (!openState) return;
    if (openState.pop.contains(event.target) || event.target === openState.display) return;
    closePopup();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') closePopup();
  }

  function buildPopup(realInput) {
    const min = parseISO(realInput.getAttribute('min'));
    const max = parseISO(realInput.getAttribute('max'));
    const selected = parseISO(realInput.value);
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
          ${realInput.required ? '' : '<button type="button" class="uct-dp-clear">Limpiar</button>'}
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
        selectValue(realInput, toISO(view.y, view.m, Number(btn.dataset.day)));
        closePopup();
      }));

      const todayBtn = pop.querySelector('.uct-dp-today');
      if (todayBtn) todayBtn.addEventListener('click', () => {
        selectValue(realInput, toISO(today.getFullYear(), today.getMonth(), today.getDate()));
        closePopup();
      });
      const clearBtn = pop.querySelector('.uct-dp-clear');
      if (clearBtn) clearBtn.addEventListener('click', () => {
        selectValue(realInput, '');
        closePopup();
      });
    }

    render();
    return pop;
  }

  function selectValue(realInput, isoValue) {
    realInput.value = isoValue; // el setter propio ya refresca el input visible
    realInput.dispatchEvent(new Event('input', { bubbles: true }));
    realInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function positionPopup(anchorEl, pop) {
    const rect = anchorEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < popRect.height + 12 && rect.top > popRect.height + 12;
    pop.style.top = openUp ? `${Math.max(8, rect.top - popRect.height - 6)}px` : `${rect.bottom + 6}px`;
    let left = rect.left;
    left = Math.min(left, window.innerWidth - popRect.width - 8);
    left = Math.max(8, left);
    pop.style.left = `${left}px`;
  }

  function openPopup(display) {
    const realInput = display._uctReal;
    if (!realInput || realInput.disabled) return;
    if (openState && openState.display === display) return;
    closePopup();
    const pop = buildPopup(realInput);
    pop.style.position = 'fixed';
    pop.style.visibility = 'hidden';
    document.body.appendChild(pop);
    positionPopup(display, pop);
    pop.style.visibility = 'visible';
    display.setAttribute('aria-expanded', 'true');
    openState = { display, real: realInput, pop };
    document.addEventListener('mousedown', onOutsideClick, true);
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('scroll', closePopup, true);
    window.addEventListener('resize', closePopup, true);
  }

  document.addEventListener('click', event => {
    const display = event.target.closest('input.uct-date');
    if (display && !display.disabled) openPopup(display);
  });
  document.addEventListener('keydown', event => {
    const display = event.target.closest && event.target.closest('input.uct-date');
    if (display && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openPopup(display);
    }
  });
})();
