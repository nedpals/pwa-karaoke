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

export type MicStatus = "off" | "idle" | "starting" | "listening" | "denied" | "unsupported";

interface Reading {
  itemId: string;
  startedAt: number;
  floorSamples: number[];
  floor: number | null;
  total: number;
  voiced: number;
  energy: number;
  submitted: boolean;
}

export interface UseLoudnessScoreOptions {
  active: boolean;
  /** The reservation being sung, so a re-do is measured on its own. */
  itemId: string | null;
  playState: DisplayPlayerState["play_state"] | null;
  onSubmit: (itemId: string, performance: number) => void;
}

export interface UseLoudnessScoreReturn {
  status: MicStatus;
  /** Call from a click handler; browsers open no microphone without one. */
  start: () => void;
  decline: () => void;
}

// A low percentile, so singing over the intro cannot raise the floor to your voice
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

function newReading(itemId: string): Reading {
  return {
    itemId,
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
  active,
  itemId,
  playState,
  onSubmit,
}: UseLoudnessScoreOptions): UseLoudnessScoreReturn {
  const [status, setStatus] = useState<MicStatus>("idle");

  const activeRef = useRef(active);
  const itemIdRef = useRef(itemId);
  const playStateRef = useRef(playState);
  const onSubmitRef = useRef(onSubmit);
  const readingRef = useRef<Reading | null>(null);

  useEffect(() => {
    activeRef.current = active;
    itemIdRef.current = itemId;
    playStateRef.current = playState;
    onSubmitRef.current = onSubmit;
  }, [active, itemId, playState, onSubmit]);

  const sample = useCallback((analyser: AnalyserNode, buffer: Uint8Array) => {
    const rms = readRms(analyser, buffer);

    const item = itemIdRef.current;
    const state = playStateRef.current;

    if (!item || !activeRef.current) {
      readingRef.current = null;
      return;
    }

    let reading = readingRef.current;
    if (reading?.itemId !== item) {
      reading = newReading(item);
      readingRef.current = reading;
    }

    if (state === "playing") {
      // Started on playback, so a slow buffer cannot eat the calibration window
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
      onSubmitRef.current(item, performanceOf(reading));
    }
  }, []);

  const stop = useRef<(() => void) | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop.current?.();
      stop.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (stop.current) return;

    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setStatus("unsupported");
      return;
    }

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
      .then((stream) => {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);

        const buffer = new Uint8Array(analyser.fftSize);
        const timer = window.setInterval(() => sample(analyser, buffer), SAMPLE_INTERVAL_MS);

        const teardown = () => {
          window.clearInterval(timer);
          stream.getTracks().forEach((track) => track.stop());
          context.close().catch(() => undefined);
          readingRef.current = null;
        };

        if (!mounted.current) {
          teardown();
          return;
        }

        stop.current = teardown;
        setStatus("listening");
      })
      .catch(() => {
        if (mounted.current) setStatus("denied");
      });
  }, [sample]);

  const decline = useCallback(() => {
    setStatus("off");
  }, []);

  return { status, start, decline };
}
