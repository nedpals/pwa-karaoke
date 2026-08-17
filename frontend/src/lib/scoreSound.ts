const ROLL_GAIN = 0.05;
const ROLL_TREMOLO_HZ = 26;
const ROLL_BAND_HZ = 1400;

const LAND_GAIN = 0.16;
const NOTE_SECONDS = 0.55;

// C5 E5 G5 C6, the triad alone, then a falling minor third
const GREAT = [523.25, 659.25, 783.99, 1046.5];
const GOOD = [523.25, 659.25, 783.99];
const POOR = [392.0, 311.13];

// Struck together the notes stack, so that tier is trimmed to match
function notesFor(score: number) {
  if (score >= 90) return { pitches: GREAT, spacing: 0.075, type: "triangle" as const, gain: 1 };
  if (score >= 75) return { pitches: GOOD, spacing: 0.0, type: "triangle" as const, gain: 0.5 };
  return { pitches: POOR, spacing: 0.18, type: "sawtooth" as const, gain: 1 };
}

function noiseBuffer(context: BaseAudioContext, seconds: number): AudioBuffer {
  const frames = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < frames; i++) {
    channel[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

export function scheduleRoll(
  context: BaseAudioContext,
  destination: AudioNode,
  startAt: number,
  seconds: number,
) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, seconds);
  source.loop = true;

  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = ROLL_BAND_HZ;
  band.Q.value = 1;

  const tremolo = context.createOscillator();
  tremolo.frequency.value = ROLL_TREMOLO_HZ;

  const tremoloDepth = context.createGain();
  tremoloDepth.gain.value = 0.5;

  const level = context.createGain();
  level.gain.setValueAtTime(0.35, startAt);
  level.gain.linearRampToValueAtTime(1, startAt + seconds);

  const output = context.createGain();
  output.gain.value = ROLL_GAIN;

  tremolo.connect(tremoloDepth).connect(level.gain);
  source.connect(band).connect(level).connect(output).connect(destination);

  source.start(startAt);
  tremolo.start(startAt);
  source.stop(startAt + seconds);
  tremolo.stop(startAt + seconds);

  return { source, tremolo, output };
}

export function scheduleLand(
  context: BaseAudioContext,
  destination: AudioNode,
  startAt: number,
  score: number,
) {
  const { pitches, spacing, type, gain } = notesFor(score);

  pitches.forEach((pitch, index) => {
    const at = startAt + index * spacing;

    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = pitch;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(LAND_GAIN * gain, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_SECONDS);

    oscillator.connect(envelope).connect(destination);
    oscillator.start(at);
    oscillator.stop(at + NOTE_SECONDS);
  });
}

export const LAND_TAIL_SECONDS = NOTE_SECONDS + 0.4;

let live: AudioContext | null = null;
let rolling: ReturnType<typeof scheduleRoll> | null = null;

function context(): AudioContext | null {
  try {
    if (!live) live = new AudioContext();
    if (live.state === "suspended") void live.resume();
    return live;
  } catch {
    return null;
  }
}

export function startRoll(seconds: number) {
  const ctx = context();
  if (!ctx || rolling) return;

  rolling = scheduleRoll(ctx, ctx.destination, ctx.currentTime, seconds);
}

export function stopRoll() {
  if (!rolling) return;

  try {
    rolling.source.stop();
    rolling.tremolo.stop();
  } catch {
    // Already stopped on schedule
  }

  rolling = null;
}

export function playLand(score: number) {
  const ctx = context();
  if (!ctx) return;

  scheduleLand(ctx, ctx.destination, ctx.currentTime, score);
}
