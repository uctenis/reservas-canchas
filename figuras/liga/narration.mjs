// Guion (≈50 s) de la explicación guiada de la liga.
// - `text`: subtítulo. `voz`: lo que se pronuncia, si difiere (W.O.).
// - `fechas`: fechas que recorre la figura mientras suena la frase.
// - `audio`: audio grabado de la frase, si existe (lo genera generar-voz.mjs).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NUM = { 4: "cuatro", 6: "seis", 8: "ocho" };

export function narration(model) {
  const last = model.totalFechas;
  const wo = model.rounds.find((r) => r.matches.some((m) => m.kind === "wo_doble"));
  const woF = wo ? wo.fecha : last - 1;
  const middle = [];
  for (let n = 2; n < woF; n++) middle.push(n);
  const bye = model.names[model.rounds[0].bye];
  const n = ["", "", "", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"][model.names.length] || model.names.length;
  const cues = [
    { fechas: [0], text: `Te explico cómo funciona la liga de tenis del club. En este ejemplo hay ${n} jugadores inscritos.` },
    { fechas: [1], text: "La liga se juega por fechas. En cada fecha, cada jugador tiene un partido contra el rival que está al otro lado de la red." },
    { fechas: [1], text: `Tienen diez días para ponerse de acuerdo, reservar cancha y jugar. Como son ${n}, en cada fecha uno descansa: esta vez le toca a ${bye}.` },
    { fechas: [1], text: "Después del partido se anota el resultado. El que gana suma tres puntos y el que pierde suma uno, así que siempre conviene jugar." },
    { fechas: [2], text: "En la fecha siguiente todos cambian de rival. Así, fecha a fecha, cada jugador se enfrenta una vez con todos los demás." },
    { fechas: middle.slice(1), text: "La tabla de posiciones se ordena por puntos y se actualiza después de cada fecha." },
    { fechas: [woF], text: "Si un partido no se juega dentro del plazo, pierden los dos por W.O. y ninguno suma. Si solo uno no se presenta, el otro gana los tres puntos.", voz: "Si un partido no se juega dentro del plazo, pierden los dos por doble u o, y ninguno suma. Si solo uno no se presenta, el otro gana los tres puntos." },
    { fechas: [last], text: `Después de la última fecha, los ${NUM[model.masters] || model.masters} primeros de la tabla clasifican al Torneo de Maestros. Con ocho o más inscritos clasifican seis, y con doce o más, ocho.` },
    { fechas: [last], text: "¡Inscríbete, juega todas tus fechas y nos vemos en la cancha!" },
  ];
  return cues.map((c, i) => {
    const audio = `audio/cue-${i + 1}.mp3`;
    if (!existsSync(join(HERE, audio))) return c;
    // La versión cambia con el contenido, para que nadie oiga un audio viejo en caché.
    const v = createHash("sha1").update(readFileSync(join(HERE, audio))).digest("hex").slice(0, 8);
    return { ...c, audio: `${audio}?v=${v}` };
  });
}
