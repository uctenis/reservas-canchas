// Guion corto (≈25 s) de la explicación guiada de la liga.
// - `text`: subtítulo. `voz`: lo que se pronuncia, si difiere (W.O.).
// - `fechas`: fechas que recorre la figura mientras suena la frase.
// - `audio`: audio grabado de la frase, si existe (lo genera generar-voz.mjs).
import { existsSync } from "node:fs";
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
  const cues = [
    { fechas: [0], text: "¿Cómo funciona la liga? Te lo explico en veinte segundos." },
    { fechas: [1], text: "Cada fecha juegas contra quien tienes al frente, y tienen diez días para jugar." },
    { fechas: [1], text: "¿Ganas? Tres puntos. ¿Pierdes? Igual sumas uno. ¡Siempre conviene jugar!" },
    { fechas: middle, text: "Fecha a fecha cambias de rival, hasta enfrentar a todos." },
    { fechas: [woF], text: "Si no juegan a tiempo, pierden los dos por W.O.: nadie suma.", voz: "Si no juegan a tiempo, pierden los dos por doble u o: nadie suma." },
    { fechas: [last], text: `Al final, los ${NUM[model.masters] || model.masters} mejores van al Torneo de Maestros. ¡Nos vemos en la cancha!` },
  ];
  return cues.map((c, i) => {
    const audio = `audio/cue-${i + 1}.mp3`;
    return existsSync(join(HERE, audio)) ? { ...c, audio } : c;
  });
}
