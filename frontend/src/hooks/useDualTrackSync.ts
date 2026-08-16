import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";

const SYNC_INTERVAL_MS = 150;

// Karaoke has no lip sync to preserve, but the lyric highlight wipe is read
// against the vocal line, so drift becomes noticeable well before it would in
// ordinary video. Past HARD_SEEK_DRIFT a seek is cheaper than waiting for a
// rate correction to converge; below NUDGE_DRIFT the error is not worth acting
// on. In between, the rate correction is proportional to the error and aims to
// close it over CORRECTION_WINDOW seconds, so a large excursion recovers fast
// while a small one is nudged gently. The video is muted, so a rate change
// costs nothing audible and is invisible at these magnitudes.
const HARD_SEEK_DRIFT = 0.3;
const NUDGE_DRIFT = 0.02;
const CORRECTION_WINDOW = 1;
const MAX_RATE_DELTA = 0.1;

const HAVE_FUTURE_DATA = 3;

function reportPlayFailure(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return;
  console.error("Media play failed:", error);
}

interface UseDualTrackSyncOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  /** True when a separate audio element exists and owns the clock. */
  separateAudio: boolean;
  /** Changes whenever the underlying elements remount, so listeners rebind. */
  mediaKey: string;
  /** The audio track could not start. Nothing is playing when this fires. */
  onAudioFailure?: (error: unknown) => void;
  /** Both tracks parked waiting to buffer, or released again. */
  onHoldChange?: (holding: boolean) => void;
}

export interface DualTrackControls {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  /** The element that owns the clock: audio when separate, video otherwise. */
  getMaster: () => HTMLMediaElement | null;
  /** True while both tracks are parked waiting for the slower one to buffer. */
  isHolding: () => boolean;
  /**
   * Attributes for the video element. Paired playback is started by this hook
   * so the audio can go first, so the video must not autoplay itself.
   */
  videoProps: { autoPlay: boolean; muted: boolean };
}

/**
 * Drives a muted video element from a separate audio element so the two behave
 * as one player. The audio track is the clock, because a dropped video frame is
 * invisible while an audio glitch is not.
 *
 * With `separateAudio` false every control collapses onto the video element
 * alone, which is the single muxed stream case. When a video element is absent
 * the audio plays by itself, which is the audio-only source case.
 */
export function useDualTrackSync({
  videoRef,
  audioRef,
  separateAudio,
  mediaKey,
  onAudioFailure,
  onHoldChange,
}: UseDualTrackSyncOptions): DualTrackControls {
  const holdingRef = useRef(false);
  // Playback intent is owned here rather than derived from the state the app
  // broadcasts. Deriving it from a reported play_state means reporting
  // "buffering" withdraws the very intent that release() needs to resume.
  const intendsPlaybackRef = useRef(false);
  const onAudioFailureRef = useRef(onAudioFailure);
  const onHoldChangeRef = useRef(onHoldChange);

  useEffect(() => {
    onAudioFailureRef.current = onAudioFailure;
    onHoldChangeRef.current = onHoldChange;
  }, [onAudioFailure, onHoldChange]);

  const setHolding = useCallback((value: boolean) => {
    if (holdingRef.current === value) return;
    holdingRef.current = value;
    onHoldChangeRef.current?.(value);
  }, []);

  const getMaster = useCallback(
    () => (separateAudio ? audioRef.current : videoRef.current),
    [separateAudio, audioRef, videoRef],
  );

  const isHolding = useCallback(() => holdingRef.current, []);

  const alignVideo = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!separateAudio || !video || !audio) return;

    video.playbackRate = 1;
    if (Math.abs(video.currentTime - audio.currentTime) > NUDGE_DRIFT) {
      video.currentTime = audio.currentTime;
    }
  }, [separateAudio, videoRef, audioRef]);

  /**
   * Starts the audio first and only brings the video in once it is actually
   * playing. A muted video is always allowed to autoplay, so starting both at
   * once would leave a silent video running whenever the audio is blocked.
   */
  const startPaired = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!audio) return;

    audio
      .play()
      .then(() => {
        if (!video) return;
        alignVideo();
        video.play().catch(reportPlayFailure);
      })
      .catch((error) => {
        // A play interrupted by a seek, a pause or a source swap is routine,
        // and the caller that interrupted it will start playback again. Only a
        // genuine refusal means the audio cannot play.
        if (error instanceof Error && error.name === "AbortError") return;
        video?.pause();
        onAudioFailureRef.current?.(error);
      });
  }, [videoRef, audioRef, alignVideo]);

  const play = useCallback(() => {
    intendsPlaybackRef.current = true;

    if (!separateAudio) {
      videoRef.current?.play().catch(reportPlayFailure);
      return;
    }
    startPaired();
  }, [separateAudio, videoRef, startPaired]);

  const pause = useCallback(() => {
    intendsPlaybackRef.current = false;
    videoRef.current?.pause();
    if (separateAudio) audioRef.current?.pause();
  }, [separateAudio, videoRef, audioRef]);

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (video) video.currentTime = time;
      if (separateAudio && audio) audio.currentTime = time;
    },
    [separateAudio, videoRef, audioRef],
  );

  // The video track is silent when paired; the audio element carries volume.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = separateAudio;
    if (!separateAudio) video.playbackRate = 1;
  }, [separateAudio, videoRef, mediaKey]);

  useEffect(() => {
    if (!separateAudio) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video || !audio) return;
      if (audio.paused || video.seeking || holdingRef.current) return;

      const drift = video.currentTime - audio.currentTime;
      const magnitude = Math.abs(drift);

      if (magnitude > HARD_SEEK_DRIFT) {
        video.currentTime = audio.currentTime;
        video.playbackRate = 1;
      } else if (magnitude > NUDGE_DRIFT) {
        // Nudging the rate corrects drift invisibly; seeking would stutter.
        const correction = Math.min(MAX_RATE_DELTA, magnitude / CORRECTION_WINDOW);
        video.playbackRate = drift > 0 ? 1 - correction : 1 + correction;
      } else if (video.playbackRate !== 1) {
        video.playbackRate = 1;
      }
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [separateAudio, videoRef, audioRef, mediaKey]);

  // Either track stalling parks both, otherwise one runs ahead while the other
  // rebuffers and they never recover without a hard seek.
  useEffect(() => {
    if (!separateAudio) return;

    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    const hold = () => {
      if (!intendsPlaybackRef.current || holdingRef.current) return;
      setHolding(true);
      video.pause();
      audio.pause();
    };

    const release = () => {
      if (!holdingRef.current) return;
      if (!intendsPlaybackRef.current) {
        setHolding(false);
        return;
      }
      if (video.readyState < HAVE_FUTURE_DATA || audio.readyState < HAVE_FUTURE_DATA) return;

      setHolding(false);
      startPaired();
    };

    video.addEventListener("waiting", hold);
    audio.addEventListener("waiting", hold);
    video.addEventListener("canplay", release);
    audio.addEventListener("canplay", release);
    video.addEventListener("canplaythrough", release);
    audio.addEventListener("canplaythrough", release);
    audio.addEventListener("play", alignVideo);
    audio.addEventListener("seeked", alignVideo);

    return () => {
      video.removeEventListener("waiting", hold);
      audio.removeEventListener("waiting", hold);
      video.removeEventListener("canplay", release);
      audio.removeEventListener("canplay", release);
      video.removeEventListener("canplaythrough", release);
      audio.removeEventListener("canplaythrough", release);
      audio.removeEventListener("play", alignVideo);
      audio.removeEventListener("seeked", alignVideo);
    };
  }, [separateAudio, videoRef, audioRef, alignVideo, startPaired, setHolding, mediaKey]);

  const videoProps = useMemo(
    () => ({ autoPlay: !separateAudio, muted: separateAudio }),
    [separateAudio],
  );

  return { play, pause, seek, getMaster, isHolding, videoProps };
}
