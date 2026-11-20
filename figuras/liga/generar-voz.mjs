// Genera la voz de la explicación guiada con Piper (motor de voz libre).
//   node figuras/liga/generar-voz.mjs <piper> <voz.onnx> [velocidad]
// <piper>: ejecutable de piper (pip install piper-tts). <voz.onnx>: voz de
// https://huggingface.co/rhasspy/piper-voices (p. ej. es_MX-claude-high).
// Escribe figuras/liga/audio/cue-N.mp3 (necesita ffmpeg). Después:
//   node figuras/liga/build.mjs --embed   (y sin flags / --light)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildModel } from "./model.mjs";
import { narration } from "./narration.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const [piper, voice, speed = "0.88"] = process.argv.slice(2);
if (!piper || !voice) { console.error("uso: node generar-voz.mjs <piper> <voz.onnx> [velocidad]"); process.exit(1); }
const out = join(HERE, "audio");
mkdirSync(out, { recursive: true });
narration(buildModel()).forEach((cue, i) => {
  const wav = join(out, `cue-${i + 1}.wav`);
  const mp3 = join(out, `cue-${i + 1}.mp3`);
  execFileSync(piper, ["-m", voice, "-f", wav, "--length-scale", speed, "--sentence-silence", "0.15"], { input: cue.voz || cue.text });
  // Mono, 64 kb/s, volumen parejo y sin silencio al inicio/final.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5,apad=pad_dur=0.12",
    "-ac", "1", "-ar", "24000", "-b:a", "64k", mp3]);
  rmSync(wav);
  console.log("cue", i + 1, "→", mp3.replace(HERE + "/", ""));
});
