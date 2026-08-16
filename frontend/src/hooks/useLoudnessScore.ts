import { useCallback, useEffect, useRef, useState } from "react";
import type { DisplayPlayerState } from "../types";

const SAMPLE_INTERVAL_MS = 100;
const CALIBRATION_MS = 4000;
const MIN_SAMPLES = 30;
const GATE_MULTIPLIER = 1.35;
const GATE_MARGIN = 0.005;
const MIN_FLOOR = 0.004;
const FLOOR_PERCENTILE = 0.25;
const MAX_EXCESS_RATIO = 4;
const COVERAGE_WEIGHT = 0.65;
const INTENSITY_WEIGHT = 0.35;
const LEVEL_STEPS = 20;
const LEVEL_GAIN = 4;

export type MicStatus = "off" | "starting" | "listening" | "denied" | "unsupported";

interface Reading {
  entryId: string;
  startedAt: number;
  floorSamples: number[];
  floor: number | null;
  total: number;
  voiced: number;
  energy: number;
  submitted: boolean;
}

export interface UseLoudnessScoreOptions {
  entryId: string | null;
  playState: DisplayPlayerState["play_state"] | null;
  onSubmit: (entryId: string, performance: number) => void;
}

export interface UseLoudnessScoreReturn {
  status: MicStatus;
  level: number;
  enabled: boolean;
  enable: () => void;
  disable: () => void;
}

// A low percentile rather than an average, so somebody singing over the intro
// cannot drag the room's noise floor up to their own voice and lock themselves
// out of the rest of the song.
function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(Math.floor(q * sorted.length), sorted.length - 1)];
}

function readRms(analyser: AnalyserNode, buffer: Uint8Array): number {
  analyser.getByteTimeDomainData(buffer);

  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = (buffer[i] - 128) / 128;
    sum += sample * sample;
  }

  return Math.sqrt(sum / buffer.length);
}

function newReading(entryId: string): Reading {
  return {
    entryId,
    startedAt: 0,
    floorSamples: [],
    floor: null,
    total: 0,
    voiced: 0,
    energy: 0,
    submitted: false,
  };
}

function performanceOf(reading: Reading): number {
  if (reading.total === 0) return 0;

  const coverage = reading.voiced / reading.total;
  const intensity = reading.voiced === 0 ? 0 : reading.energy / reading.voiced;
  const combined = coverage * COVERAGE_WEIGHT + intensity * INTENSITY_WEIGHT;

  return Math.min(Math.max(combined, 0), 1);
}

export function useLoudnessScore({
  entryId,
  playState,
  onSubmit,
}: UseLoudnessScoreOptions): UseLoudnessScoreReturn {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<MicStatus>("off");
  const [level, setLevel] = useState(0);

  const entryIdRef = useRef(entryId);
  const playStateRef = useRef(playState);
  const onSubmitRef = useRef(onSubmit);
  const readingRef = useRef<Reading | null>(null);

  useEffect(() => {
    entryIdRef.current = entryId;
    playStateRef.current = playState;
    onSubmitRef.current = onSubmit;
  }, [entryId, playState, onSubmit]);

  const sample = useCallback((analyser: AnalyserNode, buffer: Uint8Array) => {
    const rms = readRms(analyser, buffer);
    const nextLevel = Math.min(Math.round(rms * LEVEL_GAIN * LEVEL_STEPS) / LEVEL_STEPS, 1);
    setLevel((previous) => (previous === nextLevel ? previous : nextLevel));

    const entry = entryIdRef.current;
    const state = playStateRef.current;

    if (!entry) {
      readingRef.current = null;
      return;
    }

    let reading = readingRef.current;
    if (!reading || reading.entryId !== entry) {
      reading = newReading(entry);
      readingRef.current = reading;
    }

    if (state === "playing") {
      // The clock only starts once audio is actually coming out, so a slow
      // buffer cannot eat the whole calibration window.
      if (reading.startedAt === 0) {
        reading.startedAt = Date.now();
      }

      if (reading.floor === null) {
        if (Date.now() - reading.startedAt < CALIBRATION_MS) {
          reading.floorSamples.push(rms);
          return;
        }

        reading.floor = Math.max(percentile(reading.floorSamples, FLOOR_PERCENTILE), MIN_FLOOR);
      }

      const floor = reading.floor;
      const gate = floor * GATE_MULTIPLIER + GATE_MARGIN;

      reading.total += 1;
      if (rms > gate) {
        reading.voiced += 1;
        const headroom = Math.max(floor, 0.02);
        reading.energy += Math.min((rms - floor) / headroom, MAX_EXCESS_RATIO) / MAX_EXCESS_RATIO;
      }

      return;
    }

    if (state === "finished" && !reading.submitted && reading.total >= MIN_SAMPLES) {
      reading.submitted = true;
      onSubmitRef.current(entry, performanceOf(reading));
    }
  }, []);

  const enable = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setStatus("unsupported");
      return;
    }

    setEnabled(true);
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    setStatus("off");
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let timer: number | null = null;

    setStatus("starting");

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          // Automatic gain would normalise away the only thing being measured
          autoGainControl: false,
        },
      })
      .then((granted) => {
        if (cancelled) {
          granted.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = granted;
        context = new AudioContext();

        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(granted).connect(analyser);

        const buffer = new Uint8Array(analyser.fftSize);

        setStatus("listening");
        timer = window.setInterval(() => sample(analyser, buffer), SAMPLE_INTERVAL_MS);
      })
      .catch(() => {
        if (cancelled) return;

        setStatus("denied");
        setEnabled(false);
      });

    return () => {
      cancelled = true;

      if (timer !== null) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      context?.close().catch(() => undefined);

      readingRef.current = null;
      setLevel(0);
    };
  }, [enabled, sample]);

  return { status, level, enabled, enable, disable };
}
