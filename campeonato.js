(() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbzlzQPYAW_pz4IKdrZqNwjzkKSkvX5gJ6-2_MNteGWW_fDPNPPkkyFBVpy3gpRlV2TG/exec';
  const root = document.getElementById('tournamentRoot');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const formatDate = value => {
    if (!value) return 'Por confirmar';
    const parts = value.slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat('es-CL', { day:'numeric', month:'short', year:'numeric' }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  };
  const statusLabel = {draft:'Borrador',registration:'Inscripciones abiertas',draw:'Cuadro generado',in_progress:'En juego',finished:'Finalizado',archived:'Archivado'};
  const courtLabel = {cec1:'CEC Cancha 1',cec2:'CEC Cancha 2',cjp1:'CJP Cancha 1',cjp2:'CJP Cancha 2'};
  let currentTournament = null;

  function getScheduledMatches(tournament) {
    return (tournament?.matches || []).filter(match => match.date && match.status !== 'completed')
      .sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
  }
  // Resumen corto para el encabezado de marca de los exports (fechas, sede,
  // categoria/rama/superficie) -- la misma informacion que ya se ve en la
  // ficha del torneo, condensada en una linea.
  function tournamentMetaLine(t) {
    const parts = [];
    if (t?.startDate) parts.push(`${formatDate(t.startDate)}${t.endDate && t.endDate !== t.startDate ? ' – ' + formatDate(t.endDate) : ''}`);
    if (t?.venue) parts.push(t.venue);
    const modality = [t?.category, t?.gender, t?.surface].filter(Boolean).join(' · ');
    if (modality) parts.push(modality);
    return parts.join('   ·   ');
  }
  // Se carga una sola vez el PNG real del logo (no una captura de pantalla
  // del header chico de la pagina) para que se vea nitido incluso agrandado
  // en el encabezado de marca del PDF y la historia de Instagram.
  let logoImagePromise = null;
  function loadLogoImage() {
    if (!logoImagePromise) {
      logoImagePromise = new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = 'logo_uctenis_v03.png';
      });
    }
    return logoImagePromise;
  }

  // Posicion actual de cada socio en la escalerilla oficial (Firestore),
  // separada por genero -- igual que hace admin-campeonatos.js para sembrar.
  // Los inscritos de club usan su propio id de socio como id de participante
  // (ver admin-campeonatos.js: clubPlayerId === id), asi que un mismo mapa
  // por id sirve tanto para los partidos del cuadro como para "Inscritos".
  // Es "best effort": si Firestore no responde, el cuadro igual se ve, solo
  // sin las medallas de ranking.
  let clubRankingById = {};
  async function loadClubRanking() {
    try {
      if (typeof DB === 'undefined') return;
      const raw = DB.isCloudConfigured() ? await DB.getPlayersCloud() : DB.getUsers();
      const byGender = { M: [], F: [] };
      (raw || []).forEach(player => {
        if (player.activo === false || player.participaRanking === false) return;
        const genero = String(player.genero || player.gender || '').toUpperCase().startsWith('F') ? 'F' : 'M';
        const pos = Number(player.pos ?? player.posicion ?? player.rank ?? player.ranking);
        byGender[genero].push({ id: player.id, nombre: player.nombre, pos: Number.isFinite(pos) && pos > 0 ? pos : null });
      });
      const map = {};
      ['M', 'F'].forEach(genero => {
        byGender[genero].sort((a, b) => (a.pos ?? 9999) - (b.pos ?? 9999) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
        byGender[genero].forEach((player, index) => { if (player.id) map[player.id] = index + 1; });
      });
      clubRankingById = map;
    } catch (_) { /* sin ranking disponible: el cuadro se ve igual */ }
  }

  // seedThreshold la usa "Cabezas de serie" (ver renderSeededList) para
  // limitar cuantos sembrados del TORNEO se listan ahi. La medalla de
  // ranking del CLUB es otro numero (posicion en la escalerilla oficial) y
  // se muestra para cualquier socio inscrito que tenga ficha, sin ese tope.
  function seedThreshold(size) {
    return Math.max(2, Math.floor((size || 0) / 4));
  }
  function clubRankBadge(playerId) {
    const pos = playerId ? clubRankingById[playerId] : null;
    return pos ? `<span class="club-rank-badge" title="Posici&oacute;n en la escalerilla UCTenis">#${esc(pos)}</span>` : '';
  }

  function playerLine(player, match) {
    if (!player) return '<div class="match-player"><span>Por definir</span><span class="match-score">-</span></div>';
    const won = match.winner && match.winner.id === player.id;
    return `<div class="match-player ${won ? 'winner' : ''}"><span><span class="match-seed">${player.seed ? '#' + esc(player.seed) : ''}</span>${esc(player.name)}${clubRankBadge(player.id)}</span><span class="match-score">${won ? '&#10003;' : ''}</span></div>`;
  }

  // Panel de cabezas de serie (como la lista "SEEDED PLAYERS" de un cuadro
  // ATP): solo tiene sentido mostrar una fraccion de los inscritos como
  // sembrados, no la nomina completa (eso ya vive en "Inscritos").
  function renderSeededList(tournament) {
    const seedSlots = seedThreshold(tournament.size);
    const seeded = (tournament.participants || [])
      .filter(player => player.seed && player.seed <= seedSlots)
      .sort((a, b) => a.seed - b.seed);
    if (!seeded.length) return '';
    return `<div class="tour-card seeded-list">
      <h3 class="round-title">Cabezas de serie</h3>
      ${seeded.map(player => `<div class="seeded-item"><span class="seeded-num">${esc(player.seed)}</span><span>${esc(player.name)}${clubRankBadge(player.clubPlayerId || player.id)}</span></div>`).join('')}
    </div>`;
  }

  function renderBracket(tournament) {
    if (!tournament.matches?.length) return '<div class="tour-card empty-state">El cuadro se publicar&aacute; cuando finalicen las inscripciones.</div>';
    const rounds = [...new Set(tournament.matches.map(match => match.round))];
    const finalMatch = tournament.matches.find(match => match.roundName === 'Final');
    const championBox = `<section class="bracket-round champion-round"><h3 class="round-title">Campe&oacute;n</h3><div class="round-matches"><article class="match-box champion-box" data-match-id="champion">
      ${tournament.champion
        ? `<div class="champion-name"><span class="champion-trophy">&#127942;</span>${esc(tournament.champion.name)}${clubRankBadge(tournament.champion.id)}</div>`
        : `<div class="champion-name champion-pending">${finalMatch?.winner ? esc(finalMatch.winner.name) + clubRankBadge(finalMatch.winner.id) : 'Por definir'}</div>`}
    </article></div></section>`;
    return `<div class="seeded-and-bracket">
      ${renderSeededList(tournament)}
      <div class="bracket-scroll"><div class="bracket" id="tourBracket">${rounds.map(round => {
        const matches = tournament.matches.filter(match => match.round === round);
        return `<section class="bracket-round"><h3 class="round-title">${esc(matches[0]?.roundName || 'Ronda')}</h3><div class="round-matches">${matches.map(match => `
          <article class="match-box" data-match-id="${esc(match.id)}" data-next="${esc(match.roundName === 'Final' ? 'champion' : (match.nextMatchId || ''))}">
            ${playerLine(match.player1, match)}
            ${playerLine(match.player2, match)}
            <div class="match-meta">${esc(match.scoreLabel || (match.date ? formatDate(match.date) + ' &middot; ' + match.slot : 'Horario por confirmar'))}</div>
          </article>`).join('')}</div></section>`;
      }).join('')}${championBox}</div></div>
    </div>`;
  }

  // Las lineas que conectan cada partido con el siguiente se calculan a
  // partir de la posicion real ya renderizada (getBoundingClientRect), en
  // vez de intentar cuadrarlas a puro CSS: el cuadro puede tener 8, 16 o 32
  // jugadores (distinta cantidad de rondas y de huecos entre partidos), asi
  // que medir el DOM real es lo unico que funciona para cualquier tamano.
  function drawBracketConnectors() {
    const bracket = document.getElementById('tourBracket');
    if (!bracket) return;
    let svg = bracket.querySelector('.bracket-lines');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'bracket-lines');
      bracket.prepend(svg);
    }
    const boxRect = bracket.getBoundingClientRect();
    svg.setAttribute('width', bracket.scrollWidth);
    svg.setAttribute('height', bracket.scrollHeight);
    svg.innerHTML = '';
    bracket.querySelectorAll('.match-box[data-next]').forEach(box => {
      const nextId = box.dataset.next;
      if (!nextId) return;
      const target = bracket.querySelector(`.match-box[data-match-id="${CSS.escape(nextId)}"]`);
      if (!target) return;
      const from = box.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      // getBoundingClientRect ya viene en coordenadas de viewport, asi que
      // restar boxRect (medido en el mismo instante) cancela cualquier
      // scroll de los contenedores por los que pase (.bracket-scroll, la
      // pagina, etc.) sin necesitar sumarlo aparte.
      const x1 = from.right - boxRect.left;
      const y1 = from.top + from.height / 2 - boxRect.top;
      const x2 = to.left - boxRect.left;
      const y2 = to.top + to.height / 2 - boxRect.top;
      const midX = x1 + (x2 - x1) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`);
      path.setAttribute('class', 'bracket-line');
      svg.appendChild(path);
    });
  }

  let redrawScheduled = false;
  function scheduleDrawConnectors() {
    if (redrawScheduled) return;
    redrawScheduled = true;
    requestAnimationFrame(() => {
      redrawScheduled = false;
      drawBracketConnectors();
    });
  }
  window.addEventListener('resize', scheduleDrawConnectors);

  // =====================================================================
  // Exportar el cuadro: PDF (una sola hoja) e imagen para Instagram.
  // html2canvas/jsPDF se cargan solo si el admin realmente hace clic en
  // exportar -- son ~500KB combinados que la mayoria de las visitas nunca
  // necesita, asi que no se cargan de entrada con la pagina.
  // =====================================================================
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { existing.dataset.loaded === '1' ? resolve() : existing.addEventListener('load', resolve, { once: true }); return; }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => { script.dataset.loaded = '1'; resolve(); };
      script.onerror = () => reject(new Error('No se pudo cargar una libreria necesaria para exportar.'));
      document.head.appendChild(script);
    });
  }
  async function ensureExportLibs() {
    if (!window.html2canvas) await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    if (!window.jspdf) await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  function sanitizeFilename(name) {
    return String(name || 'campeonato').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'campeonato';
  }
  // El cuadro puede quedar mas ancho que la ventana visible (scroll lateral
  // en mobile, o simplemente un cuadro de 32 con muchas rondas); se le pide
  // a html2canvas el ancho/alto reales de contenido (scrollWidth/Height), no
  // solo lo que se ve, para que la exportacion nunca salga recortada.
  async function captureBracketCanvas() {
    const target = document.getElementById('bracketExportArea');
    if (!target) throw new Error('Todavia no hay cuadro para exportar.');
    await ensureExportLibs();
    return window.html2canvas(target, {
      backgroundColor: '#07110c',
      scale: 2,
      useCORS: true,
      width: target.scrollWidth,
      height: target.scrollHeight,
      windowWidth: target.scrollWidth
    });
  }
  async function withExportButton(btn, label, task) {
    if (!btn || btn.disabled) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    try { await task(); }
    catch (error) { alert(error.message || 'No se pudo completar la exportacion.'); }
    finally { btn.disabled = false; btn.textContent = original; }
  }
  // Fondo oscuro + franja de acento arriba: mismo lenguaje visual de la
  // pagina (verde lima UCTenis) en vez de una hoja plana.
  function paintPdfPageBackground(doc, pageW, pageH) {
    doc.setFillColor(7, 17, 12);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setFillColor(216, 255, 62);
    doc.rect(0, 0, pageW, 2.4, 'F');
  }
  // Encabezado de marca compartido entre la portada del cuadro y la pagina
  // de agenda: logo real (no una captura), nombre del torneo y sus datos
  // clave (fechas, sede, categoria) en una sola linea. Devuelve el Y desde
  // donde puede seguir dibujando el resto de la pagina.
  function paintPdfBrandHeader(doc, { pageW, margin, logo, title, subtitle, showLine = true }) {
    let y = margin + 2;
    const logoSize = 15;
    if (logo) doc.addImage(logo, 'PNG', margin, y, logoSize, logoSize);
    const textX = logo ? margin + logoSize + 5 : margin;
    const textW = pageW - textX - margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(216, 255, 62);
    doc.text(title, textX, y + 6.5, { maxWidth: textW });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(190, 202, 195);
    doc.text(subtitle, textX, y + 12.5, { maxWidth: textW });
    doc.setFontSize(7.5);
    doc.setTextColor(120, 132, 126);
    doc.text('UCTenis Club  ·  Plataforma oficial de reservas y ranking', textX, y + 17);
    y += logoSize + 5;
    if (showLine) {
      doc.setDrawColor(55, 70, 60);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
    }
    return y;
  }
  async function exportBracketPDF(btn) {
    await withExportButton(btn, 'Generando PDF...', async () => {
      const t = currentTournament || {};
      const [canvas, logo] = await Promise.all([captureBracketCanvas(), loadLogoImage()]);
      const { jsPDF } = window.jspdf;
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;

      // --- Portada: encabezado de marca + cuadro completo ---
      paintPdfPageBackground(doc, pageW, pageH);
      const bodyTop = paintPdfBrandHeader(doc, {
        pageW, margin, logo,
        title: String(t.name || 'Campeonato UCTenis'),
        subtitle: tournamentMetaLine(t) || 'Cuadro oficial'
      });
      const footerReserve = 7;
      const availW = pageW - margin * 2;
      const availH = pageH - bodyTop - margin - footerReserve;
      const ratio = Math.min(availW / canvas.width, availH / canvas.height);
      const w = canvas.width * ratio, h = canvas.height * ratio;
      doc.addImage(canvas.toDataURL('image/png', 1), 'PNG', (pageW - w) / 2, bodyTop + Math.max(0, (availH - h) / 2), w, h);
      doc.setFontSize(7.5);
      doc.setTextColor(120, 132, 126);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, margin, pageH - margin + 3);
      doc.text('uctenis.github.io/reservas-canchas', pageW - margin, pageH - margin + 3, { align: 'right' });

      // --- Pagina de agenda: solo si hay partidos con horario confirmado ---
      const scheduled = getScheduledMatches(t);
      if (scheduled.length) {
        doc.addPage();
        paintPdfPageBackground(doc, pageW, pageH);
        let y = paintPdfBrandHeader(doc, {
          pageW, margin, logo,
          title: 'Agenda de partidos',
          subtitle: `${scheduled.length} partido${scheduled.length === 1 ? '' : 's'} programado${scheduled.length === 1 ? '' : 's'} · ${String(t.name || '')}`
        });
        const colX = { date: margin, round: margin + 34, match: margin + 66, slot: pageW - margin - 34, court: pageW - margin - 20 };
        const drawTableHeader = () => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(216, 255, 62);
          doc.text('FECHA', colX.date, y);
          doc.text('RONDA', colX.round, y);
          doc.text('PARTIDO', colX.match, y);
          doc.text('HORA', colX.slot, y);
          doc.text('CANCHA', colX.court, y);
          y += 3;
          doc.setDrawColor(40, 55, 45);
          doc.line(margin, y, pageW - margin, y);
          y += 6;
        };
        drawTableHeader();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        scheduled.forEach((match, index) => {
          if (y > pageH - margin - 10) {
            doc.addPage();
            paintPdfPageBackground(doc, pageW, pageH);
            y = margin + 8;
            drawTableHeader();
          }
          if (index % 2 === 0) {
            doc.setFillColor(15, 26, 20);
            doc.rect(margin - 2, y - 4.2, pageW - margin * 2 + 4, 7.2, 'F');
          }
          doc.setTextColor(225, 232, 228);
          doc.text(formatDate(match.date).replace(/ de /g, ' '), colX.date, y);
          doc.setTextColor(180, 190, 185);
          doc.text(String(match.roundName || '-'), colX.round, y);
          const names = `${match.player1?.name || 'Por definir'} vs ${match.player2?.name || 'Por definir'}`;
          doc.setTextColor(225, 232, 228);
          doc.text(names.length > 40 ? names.slice(0, 39) + '…' : names, colX.match, y, { maxWidth: colX.slot - colX.match - 4 });
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(216, 255, 62);
          doc.text(String(match.slot || '-'), colX.slot, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(180, 190, 185);
          doc.text(String(courtLabel[match.courtId] || match.courtId || '-'), colX.court, y);
          y += 7.5;
        });
      }

      doc.save(`cuadro-${sanitizeFilename(t.name)}.pdf`);
    });
  }
  // Cada ronda se captura por separado (en vez de una sola foto del cuadro
  // completo) para poder repartirlas en varias historias sin cortar ningun
  // partido a la mitad: gracias a "align-items:stretch" en .bracket, todas
  // las .bracket-round ya quedan renderizadas con la misma altura, asi que
  // solo hace falta acomodarlas una junto a otra.
  async function captureBracketRounds() {
    const bracket = document.getElementById('tourBracket');
    if (!bracket) throw new Error('Todavia no hay cuadro para exportar.');
    await ensureExportLibs();
    const sections = Array.from(bracket.querySelectorAll(':scope > .bracket-round'));
    if (!sections.length) throw new Error('Todavia no hay cuadro para exportar.');
    const canvases = [];
    for (const section of sections) {
      canvases.push(await window.html2canvas(section, { backgroundColor: '#07110c', scale: 2, useCORS: true }));
    }
    return canvases;
  }
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // Fondo con degrade + resplandor detras del encabezado, en vez de un
  // color plano -- mismo tono de la pagina (verde carbon) pero con
  // terminacion mas cuidada para que se vea como una pieza de diseno.
  function paintStoryBackground(ctx, w, h) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0c1a12');
    bg.addColorStop(0.45, '#07110c');
    bg.addColorStop(1, '#050b07');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, 210, 40, w / 2, 210, 620);
    glow.addColorStop(0, 'rgba(216,255,62,.16)');
    glow.addColorStop(1, 'rgba(216,255,62,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d8ff3e';
    ctx.fillRect(0, 0, w, 6);
  }
  // Formato historia de Instagram (1080x1920). Si las rondas no caben
  // completas y legibles en un solo cuadro vertical, se reparten en varias
  // imagenes (parte 1, parte 2...) agrupando rondas completas -- nunca una
  // ronda cortada a la mitad entre dos imagenes.
  async function exportBracketInstagram(btn) {
    await withExportButton(btn, 'Generando historias...', async () => {
      const t = currentTournament || {};
      const [roundCanvases, logo] = await Promise.all([captureBracketRounds(), loadLogoImage()]);
      const STORY_W = 1080, STORY_H = 1920;
      const PAD_X = 64, HEADER_H = 300, FOOTER_H = 130, GAP = 22, CARD_PAD = 26;
      const availW = STORY_W - PAD_X * 2 - CARD_PAD * 2;
      const availH = STORY_H - HEADER_H - FOOTER_H - CARD_PAD * 2;
      const maxRoundH = Math.max(...roundCanvases.map(c => c.height));
      const scale = Math.min(1, availH / maxRoundH);

      const pages = [];
      let current = [], currentW = 0;
      roundCanvases.forEach(canvas => {
        const w = canvas.width * scale;
        const withGap = current.length ? GAP + w : w;
        if (current.length && currentW + withGap > availW) { pages.push(current); current = []; currentW = 0; }
        currentW += current.length ? GAP + w : w;
        current.push(canvas);
      });
      if (current.length) pages.push(current);

      const tournamentName = String(t.name || 'Campeonato UCTenis');
      const metaLine = tournamentMetaLine(t);
      for (let i = 0; i < pages.length; i++) {
        const group = pages[i];
        const out = document.createElement('canvas');
        out.width = STORY_W; out.height = STORY_H;
        const ctx = out.getContext('2d');
        paintStoryBackground(ctx, STORY_W, STORY_H);
        ctx.textAlign = 'center';

        // --- Encabezado de marca: logo real + nombre + datos clave ---
        let headerY = 66;
        if (logo) {
          const logoSize = 96;
          ctx.drawImage(logo, (STORY_W - logoSize) / 2, headerY, logoSize, logoSize);
          headerY += logoSize + 26;
        } else {
          headerY += 10;
        }
        ctx.fillStyle = '#d8ff3e';
        ctx.font = '800 46px Arial, sans-serif';
        ctx.fillText(tournamentName.toUpperCase(), STORY_W / 2, headerY, STORY_W - PAD_X * 2);
        headerY += 40;
        ctx.fillStyle = 'rgba(255,255,255,.72)';
        ctx.font = '600 26px Arial, sans-serif';
        ctx.fillText(pages.length > 1 ? `Cuadro oficial · Parte ${i + 1} de ${pages.length}` : 'Cuadro oficial', STORY_W / 2, headerY, STORY_W - PAD_X * 2);
        if (metaLine) {
          headerY += 36;
          ctx.fillStyle = 'rgba(216,255,62,.85)';
          ctx.font = '600 22px Arial, sans-serif';
          ctx.fillText(metaLine, STORY_W / 2, headerY, STORY_W - PAD_X * 2);
        }

        // --- Tarjeta que enmarca el cuadro, para que no quede "pegado" ---
        const cardX = PAD_X, cardY = HEADER_H, cardW = STORY_W - PAD_X * 2, cardH = STORY_H - HEADER_H - FOOTER_H;
        ctx.fillStyle = 'rgba(255,255,255,.035)';
        roundRectPath(ctx, cardX, cardY, cardW, cardH, 28);
        ctx.fill();
        ctx.strokeStyle = 'rgba(216,255,62,.22)';
        ctx.lineWidth = 2;
        roundRectPath(ctx, cardX, cardY, cardW, cardH, 28);
        ctx.stroke();

        const groupW = group.reduce((sum, c, idx) => sum + c.width * scale + (idx ? GAP : 0), 0);
        let x = Math.max(cardX, cardX + (cardW - groupW) / 2);
        group.forEach(canvas => {
          const w = canvas.width * scale, h = canvas.height * scale;
          ctx.drawImage(canvas, x, cardY + CARD_PAD + (cardH - CARD_PAD * 2 - h) / 2, w, h);
          x += w + GAP;
        });

        // --- Pie: marca + sitio, con separador ---
        const footerY = STORY_H - FOOTER_H;
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(PAD_X, footerY);
        ctx.lineTo(STORY_W - PAD_X, footerY);
        ctx.stroke();
        ctx.fillStyle = '#d8ff3e';
        ctx.font = '800 26px Arial, sans-serif';
        ctx.fillText('UCTENIS CLUB', STORY_W / 2, footerY + 46);
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.font = '500 21px Arial, sans-serif';
        ctx.fillText('uctenis.github.io/reservas-canchas', STORY_W / 2, footerY + 78);

        await new Promise(resolve => out.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = pages.length > 1
            ? `cuadro-ig-${sanitizeFilename(tournamentName)}-parte${i + 1}de${pages.length}.png`
            : `cuadro-ig-${sanitizeFilename(tournamentName)}.png`;
          a.click();
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png', 1));
      }
    });
  }
  root.addEventListener('click', event => {
    const pdfBtn = event.target.closest('#exportBracketPdfBtn');
    if (pdfBtn) return exportBracketPDF(pdfBtn);
    const igBtn = event.target.closest('#exportBracketIgBtn');
    if (igBtn) return exportBracketInstagram(igBtn);
  });

  function render(t) {
    currentTournament = t;
    document.title = `${t.name} | UCTenis`;
    const scheduled = getScheduledMatches(t);
    const completed = (t.matches || []).filter(match => match.status === 'completed').length;
    const rules = esc(t.rules || 'Eliminaci&oacute;n directa. Partidos al mejor de tres sets; tercer set definido por la organizaci&oacute;n.');
    root.className = '';
    root.innerHTML = `
      <header class="tour-hero" style="--tour-accent:${esc(t.accent || '#d8ff3e')}">
        <span class="tour-kicker">${esc(statusLabel[t.status] || 'Campeonato oficial')}</span>
        <h1>${esc(t.name)}</h1>
        <p class="tour-lead">${esc(t.tagline || t.description || 'Competencia, comunidad y tenis universitario en un solo cuadro.')}</p>
        <div class="tour-hero-actions">
          <a class="tour-link primary" href="#cuadro">Ver cuadro oficial</a>
          <a class="tour-link" href="#agenda">Pr&oacute;ximos partidos</a>
        </div>
        <div class="tour-metrics">
          <div class="tour-metric"><strong>${formatDate(t.startDate)}</strong><span>Inicio</span></div>
          <div class="tour-metric"><strong>${esc(t.venue || 'UCTenis')}</strong><span>Sede</span></div>
          <div class="tour-metric"><strong>${t.participants?.length || 0} / ${t.size}</strong><span>Inscritos</span></div>
          <div class="tour-metric"><strong>${t.champion ? esc(t.champion.name) : completed + ' resultados'}</strong><span>${t.champion ? 'Campe&oacute;n/a' : 'Avance'}</span></div>
        </div>
      </header>

      <section class="tour-section" id="cuadro">
        <div class="tour-section-head">
          <div><h2>Cuadro oficial</h2><p class="tour-section-copy">Los ganadores avanzan autom&aacute;ticamente en cada ronda.</p></div>
          <div class="bracket-export-actions">
            <span class="status-pill">${t.size} jugadores</span>
            ${t.matches?.length ? `
              <button type="button" class="tour-btn" id="exportBracketPdfBtn" title="Descargar el cuadro en PDF, en una sola hoja">&#128196; PDF</button>
              <button type="button" class="tour-btn" id="exportBracketIgBtn" title="Descargar el cuadro en formato historia de Instagram (1080x1920); si no cabe completo, se reparte en varias imagenes">&#128248; Historia IG</button>
            ` : ''}
          </div>
        </div>
        <div id="bracketExportArea">
          <div class="bracket-export-header">
            <img src="logo_uctenis_v03.png" alt="UCTenis" class="bracket-export-logo">
            <div><strong>${esc(t.name)}</strong><span>${esc(t.category)} &middot; ${esc(t.gender)} &middot; ${formatDate(t.startDate)}${t.venue ? ' &middot; ' + esc(t.venue) : ''}</span></div>
          </div>
          ${renderBracket(t)}
        </div>
      </section>

      <div class="tour-grid">
        <section class="tour-section" id="agenda">
          <div class="tour-section-head"><div><h2>Agenda de cancha</h2><p class="tour-section-copy">Horarios confirmados por la organizaci&oacute;n.</p></div></div>
          <div class="tour-card schedule-list">${scheduled.length ? scheduled.map(match => `
            <article class="schedule-item"><div class="schedule-date">${formatDate(match.date).replace(/ de /g,' ')}</div><div><strong>${esc(match.player1?.name || 'Por definir')} vs ${esc(match.player2?.name || 'Por definir')}</strong><div class="schedule-meta">${esc(match.roundName)} &middot; ${esc(courtLabel[match.courtId] || match.courtId)}</div></div><strong>${esc(match.slot)}</strong></article>`).join('') : '<div class="empty-state">No hay partidos pendientes con horario confirmado.</div>'}</div>
        </section>
        <section class="tour-section">
          <div class="tour-section-head"><div><h2>Ficha del torneo</h2><p class="tour-section-copy">Informaci&oacute;n oficial.</p></div></div>
          <div class="tour-card">
            <p><strong>Categor&iacute;a:</strong> ${esc(t.category)}</p>
            <p><strong>Modalidad:</strong> ${esc(t.gender)} &middot; ${esc(t.surface)}</p>
            <p><strong>Premiaci&oacute;n:</strong> ${esc(t.prize || 'Por anunciar')}</p>
            <p><strong>Organiza:</strong> ${esc(t.organizer || 'UCTenis Club')}</p>
            <p><strong>Bases:</strong> ${rules}</p>
          </div>
        </section>
      </div>

      <div class="tour-grid">
        <section class="tour-section">
          <div class="tour-section-head"><div><h2>&Uacute;ltimas noticias</h2><p class="tour-section-copy">Resultados publicados desde la mesa de control.</p></div></div>
          <div class="news-list">${t.news?.length ? t.news.map(item => `<article class="news-item"><div class="news-time">${formatDate(item.publishedAt)}</div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p></article>`).join('') : '<div class="tour-card empty-state">Las noticias aparecer&aacute;n al registrar los primeros resultados.</div>'}</div>
        </section>
        <section class="tour-section">
          <div class="tour-section-head"><div><h2>Inscritos</h2><p class="tour-section-copy">N&oacute;mina oficial del campeonato.</p></div></div>
          <div class="tour-card roster-list">${t.participants?.length ? [...t.participants].sort((a,b)=>(a.seed||99)-(b.seed||99)).map(player => `<div class="roster-item"><span>${esc(player.name)}${player.clubMember ? ' <small>UCTenis</small>' : ''}${clubRankBadge(player.clubPlayerId || player.id)}</span><span class="seed-pill">#${esc(player.seed || '-')}</span></div>`).join('') : '<div class="empty-state">A&uacute;n no hay inscritos publicados.</div>'}</div>
        </section>
      </div>`;
    scheduleDrawConnectors();
  }

  async function load() {
    try {
      if (typeof DB !== 'undefined') { try { await DB.authReady(); } catch (_) {} }
      const rankingPromise = loadClubRanking();
      const id = new URLSearchParams(location.search).get('id');
      const query = id ? `action=get_tournament&id=${encodeURIComponent(id)}` : 'action=get_tournaments';
      const response = await fetch(`${API_URL}?${query}&v=${Date.now()}`);
      const data = await response.json();
      const tournament = id ? data.tournament : data.tournaments?.[0];
      if (!data.ok || !tournament) throw new Error(data.msg || 'No hay campeonatos publicados.');
      await rankingPromise;
      render(tournament);
    } catch (error) {
      root.className = '';
      root.innerHTML = `<div class="tour-card empty-state"><h1>Campeonato no disponible</h1><p>${esc(error.message)}</p><a class="tour-link" href="index.html">Volver al inicio</a></div>`;
    }
  }
  load();
})();
