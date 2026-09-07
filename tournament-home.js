(() => {
  const API_URL = window.CONFIG?.API_URL || 'https://script.google.com/macros/s/AKfycbzlzQPYAW_pz4IKdrZqNwjzkKSkvX5gJ6-2_MNteGWW_fDPNPPkkyFBVpy3gpRlV2TG/exec';
  const escText = value => String(value ?? '');
  async function loadTournamentSpotlight() {
    try {
      const response = await fetch(`${API_URL}?action=get_tournaments&v=${Date.now()}`);
      const data = await response.json();
      if (!data.ok) return;
      const tournament = (data.tournaments || []).find(item => item.featured) || data.tournaments?.[0];
      if (!tournament) return;
      const spotlight = document.getElementById('homeTournamentSpotlight');
      const title = document.getElementById('homeTournamentTitle');
      const text = document.getElementById('homeTournamentText');
      const link = document.getElementById('homeTournamentLink');
      if (!spotlight || !title || !text || !link) return;
      title.textContent = tournament.name;
      const confirmed = (tournament.matches || []).filter(match => match.status === 'completed').length;
      const capacity = `${tournament.participants?.length || 0}/${tournament.size || 0} inscritos`;
      text.textContent = escText(tournament.tagline || tournament.description || `${capacity}. Cuadro, agenda y resultados en vivo.`) + (confirmed ? ` ? ${confirmed} resultados publicados.` : '');
      link.href = `campeonato.html?id=${encodeURIComponent(tournament.id)}`;
      spotlight.classList.add('show');
    } catch (error) {
      console.warn('No se pudo cargar el campeonato destacado:', error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadTournamentSpotlight);
  else loadTournamentSpotlight();
})();

