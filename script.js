/* UCTenis Logic */

const CONFIG = {
    LAT: -38.7359,
    LON: -72.5904,
    API_URL: "https://script.google.com/macros/s/AKfycbzrf9Xm7UoP3d4NXxbSNZOFMLaDZk1h49N3EzlZS_xuxYDkzJyDvpmlpwQuQX8kfno/exec"
};

const MEMBERS = ["Luis Otth", "Ismael Devia", "Paulo Garrido", "Roberto Bermudez", "Roberto Espinoza", "Pablo Lagos", "Francisco Encina", "Gustavo Curaqueo", "Cristian Henriquez", "Cristian Rebolledo", "Sebastián Garrido", "Rodrigo Castro", "Matías Cáceres", "Juan Maripillán", "David Figueroa", "David Silva", "David Fonseca", "Cristian Farias", "Jaime Castillo", "José Baeza", "José Melgarejo", "Miguel Escalona", "Rodrigo Zuñiga", "Francisco Muñoz", "Sebastian Aguilar", "Victor Navarrete", "Cristobal Correa", "Jano Medina", "Miguel Angulo", "Carolina Cárdenas", "Mauricio Matus", "Angélica Encina", "Maria José", "Klaus Hennicke", "Francisco Mendez", "Violeta Moreno", "Valeria Schatter"];

const MESSAGES = [
    "¡Hoy es tu día para brillar en la cancha, [Nombre]! (O al menos para no tropezar con tus propios pies).",
    "[Nombre], el sol brilla, ¡casi tanto como tu futuro revés si practicas hoy! O no.",
    "El clima está perfecto, [Nombre]. Sin excusas... excepto quizás tu condición física.",
    "¡Vamos a aprovechar el buen tiempo, [Nombre], y a mejorar ese revés! O a resignarnos a que siempre será así.",
    "El sol brilla tanto como tu determinación, [Nombre]. Lástima que la pelota no siempre siga esa misma luz.",
    "Día nublado, [Nombre], perfecto para que nadie vea tus errores no forzados con claridad. ¡Aprovéchalo!",
    "Hoy el clima está ideal para practicar tus saques, [Nombre]. Apunta a la cancha, es un buen comienzo.",
    "No hay mejor clima para mejorar tu técnica, [Nombre]. O para darte cuenta de que no tienes.",
    "El sol está contigo, [Nombre], igual que tu pasión por el tenis. La pelota, a veces, está en tu contra.",
    "Nublado pero sin lluvia, [Nombre]. ¡Una razón más para no detenerse... o para quedarse en casa viendo Netflix!",
    "Nada mejor que un día soleado para mostrar de qué estás hecho, [Nombre]. Y de qué no, también.",
    "El clima perfecto para esos rallies largos, [Nombre]. Si es que logras pasar la segunda pelota.",
    "Con este clima, cada punto cuenta, [Nombre]. Especialmente los que pierdes por errores tontos.",
    "Hoy toca darle fuerte, [Nombre], el clima está de nuestro lado. La red, ya veremos.",
    "Aprovecha este día sin lluvia para dar lo mejor de ti, [Nombre]. O al menos, inténtalo.",
    "Hoy el sol está para acompañarte a mejorar, [Nombre]. Y para que se vea bien claro cuándo fallas.",
    "El clima no podría ser mejor, [Nombre], ¡a aprovechar cada minuto! (Probablemente los últimos de tu energía).",
    "La victoria está en tu mente antes de estar en la cancha, [Nombre]. Y a veces, solo se queda ahí.",
    "El tenis es 90% mental y 10% evitar tropezar con la línea blanca, [Nombre]. Concentración.",
    "Si pierdes el partido, [Nombre], al menos no pierdas la compostura. Bueno, tal vez un poco. O mucho.",
    "¡No culpes a la raqueta, [Nombre]! Ella está haciendo lo mejor que puede con el material que tiene.",
    "Hoy no se trata de ganar, [Nombre], se trata de no romper otra cuerda... ni tu paciencia.",
    "Si no puedes ganar el punto, [Nombre], al menos haz que tu rival sude por él. O que se ría.",
    "¿Hoy vienes a jugar o a dar un curso de errores no forzados, [Nombre]? Ambas son válidas.",
    "Recuerda, [Nombre], el tenis es como la vida: a veces solo intentas no hacer el ridículo.",
    "¡Gran saque, [Nombre]! Lástima que fue fuera por medio metro. O dos.",
    "Siempre dicen que el esfuerzo lo es todo, [Nombre]. Bueno, hoy lo intentaste. Eso ya es algo.",
    "Tu revés tiene un 50% de probabilidades de ir a la red, [Nombre]... optimismo, ¿no?",
    "Un día sin tenis es un día perdido, [Nombre]. O un día ganado para tus rodillas.",
    "Con cada golpe, [Nombre], estás más cerca de la perfección. O de la siguiente pelota perdida.",
    "Tu mayor rival no está del otro lado de la red, [Nombre], sino en tu mente. Y a veces, es tu propio físico.",
    "El clima es perfecto, igual que tu determinación, [Nombre]. Lástima que la pelota tenga sus propias ideas.",
    "El éxito es 1% inspiración y 99% transpiración, [Nombre]... ¡y hoy toca sudar para disimular los errores!",
    "El tenis es el único deporte donde puedes discutir contigo mismo y perder, [Nombre].",
    "Si la pelota va hacia ti, [Nombre], ¡corre! Es una pista, no una selfie. Aunque una buena selfie después de un punto (ganado) no está mal.",
    "La raqueta está en tus manos, [Nombre], pero la magia viene del café que tomaste antes. O del ibuprofeno.",
    "Hoy no jugamos para ganar, [Nombre], sino para demostrar que sabemos correr... aunque sea detrás de la pelota.",
    "Tu saque es tan rápido, [Nombre], que ni tú sabes a dónde va... ¡sorpresa! (Generalmente fuera).",
    "[Nombre], dicen que la práctica hace al maestro. A estas alturas, tú deberías ser un maestro... en encontrar excusas.",
    "Hoy es un día perfecto para que tu revés paralelo sorprenda a todos, [Nombre]. Principalmente a ti mismo si entra.",
    "Recuerda [Nombre], cada error no forzado es una oportunidad de aprendizaje. Ya debes ser un erudito.",
    "[Nombre], no te presiones. La probabilidad de que esa dejada toque la red es alta, pero la esperanza es lo último que se pierde... después de la pelota.",
    "El pronóstico dice sol, [Nombre]. Ideal para que el reflejo no sea tu excusa cuando la pelota pase de largo.",
    "¡Vamos [Nombre]! Hoy es un buen día para donar algunas pelotas a las canchas vecinas con tus saques.",
    "Tu plan de juego hoy, [Nombre]: 1. Pegarle a la pelota. 2. Intentar que entre. 3. Repetir el paso 1 con más optimismo.",
    "[Nombre], si te sientes frustrado, solo recuerda que hay gente que paga por esto. Tú, por ejemplo.",
    "Dicen que el tenis es un deporte de caballeros, [Nombre]. Intenta no lanzar la raqueta... muy lejos.",
    "Objetivo del día, [Nombre]: que la cantidad de pelotas perdidas sea menor que tu edad. ¡Tú puedes (quizás)!",
    "[Nombre], la clave está en la anticipación. Anticipa que vas a correr mucho... y probablemente en vano.",
    "Si tu oponente te gana con un 'lucky shot', [Nombre], recuerda que tú llevas todo el partido jugando 'unlucky shots'.",
    "[Nombre], hoy tu derecha podría ser ilegal de tan potente... si le apuntaras a la cancha.",
    "No te preocupes por el marcador, [Nombre]. Lo importante es que el atuendo combine.",
    "[Nombre], piensa en la pelota como ese problema que evitas. Tarde o temprano, te va a volver... o se va a ir muy lejos.",
    "Hoy puede ser el día en que todos tus globos aterricen dentro, [Nombre]. O el día que descubras el bádminton.",
    "Recuerda, [Nombre]: un buen grito después de un mal golpe no mejora el punto, pero libera el alma (y asusta a las palomas).",
    "[Nombre], la red es tu amiga. A veces demasiado... especialmente en los drop shots.",
    "No subestimes el poder de una buena charla técnica contigo mismo en medio del punto, [Nombre]. Aunque nadie más la entienda.",
    "Ánimo, [Nombre]. Aunque no ganes el partido, siempre puedes ganar la discusión sobre si la pelota fue buena o mala.",
    "Eres mas malo que el presidente del club, [Nombre]. (Es broma... o no).",
    "[Nombre], cuidado que los mutantes estan ganando todo! Mantén la guardia alta.",
    "[Nombre], no robes puntos como Melgarejo! Juega limpio, o al menos, que no te pillen.",
    "[Nombre], ¿también fuiste atendido por el \"nana vieja\"? Esas historias son leyenda."
];

const STORY_TEMPLATES = [
    "Se comenta en los pasillos que [Nombre1] está entrenando en secreto para ganarle el próximo set a [Nombre2]. Las apuestas están 100 a 1... a favor de [Nombre2].",
    "Dicen las malas lenguas que [Nombre1] tiene un revés más temible que el de [Nombre2]. Claro, si por 'temible' entendemos 'impredeciblemente fuera'.",
    "Hoy, [Nombre1] y [Nombre2] podrían enfrentarse. El pronóstico es reservado, pero se espera una alta probabilidad de risas (y errores no forzados).",
    "Alerta de Clásico UCTenis: [Nombre1] vs [Nombre2]. Se juega el honor, la última Coca-Cola del refri y el derecho a presumir por una semana.",
    "[Nombre1] le preguntó a [Nombre2] el secreto de su saque. [Nombre2] respondió: 'Apuntar adentro y rezar un poco no viene mal'.",
    "Última hora desde las canchas: [Nombre1] fue visto practicando dejadas. [Nombre2] fue visto comprando zapatillas más rápidas... y un casco.",
    "Si [Nombre1] y [Nombre2] juegan hoy, recuerden la regla de oro del club: lo importante no es ganar, es tener una buena anécdota para el tercer tiempo.",
    "La rivalidad entre [Nombre1] y [Nombre2] es legendaria. Como el monstruo del Lago Ness: muchos hablan de ella, pocos la han visto terminar bien para ambos.",
    "[Nombre1] dice que su derecha es como la de Federer. [Nombre2] dice que sí, si Federer jugara con la mano izquierda, los ojos vendados y después de tres piscolas.",
    "Dicen que [Nombre1] tiene la volea de un profesional. [Nombre2] pregunta de qué profesional hablamos, ¿uno de bádminton o de recoger pelotas?"
];

// --- Shared Utilities ---

function setDate() {
    const el = document.getElementById('dateToday');
    if (el) {
        const today = new Date();
        el.textContent = today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
}

// --- Weather & Motivation Logic (Index) ---

function getWeatherIcon(wmoCode) {
    const icons = { 0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️", 51: "🌦️", 53: "🌦️", 55: "🌦️", 61: "🌧️", 63: "🌧️", 65: "🌧️", 80: "⛈️", 81: "⛈️", 82: "⛈️" };
    return icons[wmoCode] || "🤷";
}

function updateMotivationalMessage(dailyData = null) {
    const el = document.getElementById('tennisMessage');
    if (!el) return;

    const today = new Date();
    const currentDay = today.getDay();
    const currentHour = today.getHours();

    if (currentDay === 0) {
        el.textContent = "Las canchas están cerradas los domingos. Aprovecha para descansar, planificar tu semana de juego... o cómo evitarla.";
        return;
    }

    let rainProbability = 0;
    if (dailyData && dailyData.precipitation_probability_max && dailyData.precipitation_probability_max.length > 0) {
        rainProbability = dailyData.precipitation_probability_max[0];
    }

    let message = "";

    if (currentHour >= 7 && currentHour <= 23) {
        if (Math.random() < 0.3 && MEMBERS.length >= 2) {
            let m1 = MEMBERS[Math.floor(Math.random() * MEMBERS.length)];
            let m2 = MEMBERS[Math.floor(Math.random() * MEMBERS.length)];
            while (m2 === m1) m2 = MEMBERS[Math.floor(Math.random() * MEMBERS.length)];

            message = STORY_TEMPLATES[Math.floor(Math.random() * STORY_TEMPLATES.length)]
                .replace("[Nombre1]", m1).replace("[Nombre2]", m2);

        } else {
            const member = MEMBERS[Math.floor(Math.random() * MEMBERS.length)];
            message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)].replace("[Nombre]", member);
        }

        if (rainProbability > 70) {
            const member = MEMBERS[Math.floor(Math.random() * MEMBERS.length)];
            message = `${member}, hoy llueve más que tus excusas post-partido. Mejor quédate en casa viendo tutoriales de cómo no hacer una doble falta.`;
        }
    } else {
        const member = MEMBERS[Math.floor(Math.random() * MEMBERS.length)];
        message = `Las canchas duermen, y tú también deberías, ${member}. Mañana será otro día para... seguir intentando que esa pelota entre.`;
    }
    el.textContent = message;
}

async function fetchWeather() {
    const forecastDiv = document.getElementById('forecast');
    const suggestionEl = document.getElementById('smartSuggestion');
    if (!forecastDiv || !suggestionEl) return;

    const URL = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.LAT}&longitude=${CONFIG.LON}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=temperature_2m,precipitation_probability,weathercode&timezone=America/Santiago`;

    try {
        const response = await fetch(URL);
        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        const data = await response.json();
        const daily = data.daily;
        const hourly = data.hourly;

        // Render Daily Forecast
        forecastDiv.innerHTML = "";
        for (let i = 0; i < daily.time.length; i++) {
            const date = new Date(daily.time[i] + 'T00:00:00');
            const dayString = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace(/^\w/, c => c.toUpperCase());
            const icon = getWeatherIcon(daily.weathercode[i]);
            forecastDiv.innerHTML += `
                <div class="forecast-day">
                    <span>${dayString}</span>
                    <div class="weather-icon-emoji">${icon}</div>
                    <span>Máx: ${Math.round(daily.temperature_2m_max[i])}°C</span>
                    <span>Mín: ${Math.round(daily.temperature_2m_min[i])}°C</span>
                    <span>${daily.precipitation_probability_max[i]}% lluvia</span>
                </div>`;
        }

        // Smart Suggestion Logic (Next 4 hours)
        const now = new Date();
        const currentHour = now.getHours();
        let suggestionText = "";

        // Find index for current hour
        let currentIndex = -1;
        for (let i = 0; i < hourly.time.length; i++) {
            if (new Date(hourly.time[i]).getHours() === currentHour && new Date(hourly.time[i]).getDate() === now.getDate()) {
                currentIndex = i;
                break;
            }
        }

        if (currentIndex !== -1) {
            // Analyze next 3 hours
            let willRain = false;
            let maxRainProb = 0;
            let avgTemp = 0;
            let count = 0;

            for (let i = 0; i < 3; i++) {
                if (currentIndex + i < hourly.time.length) {
                    const prob = hourly.precipitation_probability[currentIndex + i];
                    const temp = hourly.temperature_2m[currentIndex + i];
                    if (prob > 30) willRain = true;
                    if (prob > maxRainProb) maxRainProb = prob;
                    avgTemp += temp;
                    count++;
                }
            }
            avgTemp = count > 0 ? avgTemp / count : 0;

            // Generate Message
            if (currentHour < 7 || currentHour > 22) {
                suggestionText = "Las canchas descansan. ¡Tú también deberías! Mañana será otro día para jugar.";
            } else if (willRain) {
                const rainMessages = [
                    `Se viene lluvia (${maxRainProb}% de prob.). Mejor guarda la raqueta y revisa partidos antiguos en YouTube.`,
                    `El cielo se ve amenazante en las próximas horas. Quizás es momento de entrenamiento físico bajo techo.`,
                    `Alta probabilidad de lluvia. La arcilla se convertirá en barro, ¡mejor no arriesgarse!`
                ];
                suggestionText = rainMessages[Math.floor(Math.random() * rainMessages.length)];
            } else if (avgTemp > 28) {
                suggestionText = `¡Hace calor (${Math.round(avgTemp)}°C)! Hidrátate bien y usa bloqueador si vas a jugar ahora.`;
            } else if (avgTemp < 8) {
                suggestionText = `Hace frío (${Math.round(avgTemp)}°C), pero no llueve. ¡Ideal para entrar en calor corriendo en la cancha!`;
            } else {
                const goodWeatherMessages = [
                    `El clima está ideal en las próximas horas. ¡La cancha te está llamando!`,
                    `Ni mucho frío ni calor. Condiciones perfectas para un partido épico.`,
                    `Cielo despejado y buena temperatura. No tienes excusa para no jugar hoy.`
                ];
                suggestionText = goodWeatherMessages[Math.floor(Math.random() * goodWeatherMessages.length)];
            }
        } else {
            suggestionText = "No pude leer el futuro inmediato, pero el pronóstico diario te dará una idea.";
        }

        suggestionEl.textContent = suggestionText;
        updateMotivationalMessage(daily);

    } catch (error) {
        console.error("Error clima:", error);
        suggestionEl.textContent = "Los satélites del clima no responden. Mira por la ventana por si acaso.";
        forecastDiv.innerHTML = "<p>Pronóstico no disponible.</p>";
        updateMotivationalMessage();
    }
}

// --- Ranking Logic ---

let allPlayersData = [];

async function loadRanking() {
    const lastUpdatedEl = document.getElementById('lastUpdatedDate');
    if (!lastUpdatedEl) return;

    lastUpdatedEl.textContent = 'Actualizado: ' + new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

    try {
        const response = await fetch(`${CONFIG.API_URL}?v=${new Date().getTime()}`);
        const data = await response.json();

        if (data.status === 'error') throw new Error(data.message);

        allPlayersData = [
            ...(data.hombres || []).map(p => ({ ...p, gender: 'H' })),
            ...(data.mujeres || []).map(p => ({ ...p, gender: 'M' }))
        ];

        renderTable('M', data.mujeres);
        renderTable('H', data.hombres);
        findTopMover();

    } catch (err) {
        document.getElementById('loadingM').innerHTML = `<div class="error-message">Error: ${err.message}</div>`;
        document.getElementById('loadingH').innerHTML = ``;
    }
}

function renderTable(gender, list) {
    const tbody = document.getElementById(`tbody${gender}`);
    const table = document.getElementById(`table${gender}`);
    const loading = document.getElementById(`loading${gender}`);

    if (!list || list.length === 0) {
        loading.textContent = 'No hay jugadores en esta sección.';
        return;
    }

    tbody.innerHTML = '';
    list.forEach(p => {
        const tr = tbody.insertRow();
        tr.addEventListener('click', () => showPlayerProfile(p.nombre));

        const posActual = parseInt(p.posicion);
        const posAnterior = parseInt(p.posicionAnterior);
        let evolHtml = '<span class="new-entry" title="Nuevo">●</span>';

        if (!isNaN(posAnterior) && posAnterior > 0) {
            const diff = posAnterior - posActual;
            if (diff > 0) evolHtml = `<span class="arrow-up">▲ +${diff}</span>`;
            else if (diff < 0) evolHtml = `<span class="arrow-down">▼ ${diff}</span>`;
            else evolHtml = `<span class="new-entry">●</span>`;
        }

        if (!isNaN(posAnterior) && posAnterior > 0 && posActual !== posAnterior) {
            tr.classList.add('player-highlight');
        }

        tr.innerHTML = `<td>${p.posicion}</td><td>${p.nombre}</td><td>${evolHtml}</td>`;
    });

    loading.style.display = 'none';
    table.style.display = 'table';
}

function findTopMover() {
    let top = { nombre: '', mov: 0, pos: '' };

    allPlayersData.forEach(p => {
        const cur = parseInt(p.posicion);
        const prev = parseInt(p.posicionAnterior);
        if (!isNaN(prev) && prev > cur) {
            const diff = prev - cur;
            if (diff > top.mov) {
                top.mov = diff;
                top.nombre = p.nombre;
                top.pos = p.posicion;
            }
        }
    });

    const banner = document.getElementById('topMoverBanner');
    if (top.mov > 0 && banner) {
        banner.classList.remove('hidden');
        banner.innerHTML = `🚀 ¡Ascenso de la Semana! <strong>${top.nombre}</strong> subió <span style="color:var(--accent-tennis)">${top.mov}</span> puestos hasta el #${top.pos}.`;
    }
}

// --- Modal Logic ---

function showPlayerProfile(name) {
    const p = allPlayersData.find(x => x.nombre === name);
    if (!p) return;

    const modal = document.getElementById('playerModal');
    const content = modal.querySelector('.modal-content');

    const gender = p.gender || 'H';
    const defaultAvatar = gender === 'M' ? 'fotos/default_avatar_m.png' : 'fotos/default_avatar_h.png';
    const photoSrc = (p.foto && p.foto.trim() !== '') ? p.foto : defaultAvatar;

    // Icons (simplified SVGs)
    const iRank = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
    const iAge = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`;
    const iCat = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.86L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 13.5h8v8H3z"/></svg>`;
    const iHand = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 11c0 5.52-4.48 10-10 10S1 16.52 1 11 5.48 1 11 1s10 4.48 10 10zM11 3c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8z"/></svg>`;

    content.innerHTML = `
        <div class="modal-header">
            <button class="modal-close-btn" onclick="closeModal()">×</button>
            <img src="${photoSrc}" class="modal-photo" onerror="this.src='${defaultAvatar}'" alt="${p.nombre}">
            <h2 class="modal-name">${p.nombre}</h2>
        </div>
        <ul class="modal-stats">
            <li><span class="label">${iRank} Ranking</span><span class="value">#${p.posicion || '-'}</span></li>
            <li><span class="label">${iAge} Edad</span><span class="value">${p.edad || '-'}</span></li>
            <li><span class="label">${iCat} Categoría</span><span class="value">${p.categoria || '-'}</span></li>
            <li><span class="label">${iHand} Mano</span><span class="value">${p.manoHabil || '-'}</span></li>
            <li><span class="label">${iHand} Revés</span><span class="value">${p.reves || '-'}</span></li>
        </ul>
    `;

    modal.classList.add('visible');
}

function closeModal() {
    document.getElementById('playerModal').classList.remove('visible');
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    setDate();

    // Check which page we are on
    if (document.getElementById('forecast')) {
        fetchWeather();
        setInterval(fetchWeather, 60 * 60 * 1000);
    }

    if (document.getElementById('tableM')) {
        loadRanking();

        // Modal close listener
        const modal = document.getElementById('playerModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
    }
});
