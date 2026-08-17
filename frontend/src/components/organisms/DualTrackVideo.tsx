import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactEventHandler,
} from "react";

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

/**
 * The slice of HTMLMediaElement the player drives. Exposing exactly this lets
 * the player treat a paired video and audio track as one element.
 */
export interface DualTrackHandle {
  currentTime: number;
  volume: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  play: () => Promise<void>;
  pause: () => void;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

interface DualTrackVideoProps {
  videoUrl: string | null;
  /** When set, videoUrl carries no audio and the two play as one. */
  audioUrl: string | null;
  className?: string;
  onPlay?: ReactEventHandler<HTMLMediaElement>;
  onPause?: ReactEventHandler<HTMLMediaElement>;
  onWaiting?: ReactEventHandler<HTMLMediaElement>;
  onCanPlay?: ReactEventHandler<HTMLMediaElement>;
  onCanPlayThrough?: ReactEventHandler<HTMLMediaElement>;
  onEnded?: ReactEventHandler<HTMLMediaElement>;
  /** Neither track is playing and the audio refused to start. */
  onAudioFailure?: (error: unknown) => void;
  /** Both tracks parked to buffer, or released again. */
  onHoldChange?: (holding: boolean) => void;
  /** A track could not be loaded at all. */
  onTrackError?: (error: Error) => void;
}

/**
 * A media element that may be backed by one muxed stream or by a silent video
 * paired with a separate audio track.
 *
 * The paired case exists because YouTube's muxed streams top out at 360p while
 * the video-only ladder reaches 1080p. The audio track is the clock, because a
 * dropped video frame is invisible while an audio glitch is not, and the video
 * is driven to follow it. Keeping both shapes behind one ref means the player
 * drives playback the same way either way.
 */
export const DualTrackVideo = forwardRef<DualTrackHandle, DualTrackVideoProps>(
  function DualTrackVideo(
    {
      videoUrl,
      audioUrl,
      className,
      onPlay,
      onPause,
      onWaiting,
      onCanPlay,
      onCanPlayThrough,
      onEnded,
      onAudioFailure,
      onHoldChange,
      onTrackError,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const separateAudio = Boolean(audioUrl);

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

    /** The element that owns the clock: audio when separate, video otherwise. */
    const getMaster = useCallback(
      (): HTMLMediaElement | null => (separateAudio ? audioRef.current : videoRef.current),
      [separateAudio],
    );

    const alignVideo = useCallback(() => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!separateAudio || !video || !audio) return;

      video.playbackRate = 1;
      if (Math.abs(video.currentTime - audio.currentTime) > NUDGE_DRIFT) {
        video.currentTime = audio.currentTime;
      }
    }, [separateAudio]);

    /**
     * Starts the audio first and only brings the video in once it is actually
     * playing. A muted video is always allowed to autoplay, so starting both at
     * once would leave a silent video running whenever the audio is blocked.
     */
    const startPaired = useCallback((): Promise<void> => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!audio) return Promise.resolve();

      return audio
        .play()
        .then(() => {
          if (!video) return;
          alignVideo();
          video.play().catch(reportPlayFailure);
        })
        .catch((error) => {
          // A play interrupted by a seek, a pause or a source swap is routine,
          // and the caller that interrupted it will start playback again. Only
          // a genuine refusal means the audio cannot play.
          if (error instanceof Error && error.name === "AbortError") return;
          video?.pause();
          onAudioFailureRef.current?.(error);
        });
    }, [alignVideo]);

    const play = useCallback((): Promise<void> => {
      intendsPlaybackRef.current = true;

      // The muxed path returns the element's own promise, so a caller's
      // existing rejection handling behaves exactly as it does without pairing.
      if (!separateAudio) {
        return videoRef.current?.play() ?? Promise.resolve();
      }
      return startPaired();
    }, [separateAudio, startPaired]);

    const pause = useCallback(() => {
      intendsPlaybackRef.current = false;
      videoRef.current?.pause();
      if (separateAudio) audioRef.current?.pause();
    }, [separateAudio]);

    const seek = useCallback(
      (time: number) => {
        const video = videoRef.current;
        const audio = audioRef.current;
        if (video) video.currentTime = time;
        if (separateAudio && audio) audio.currentTime = time;
      },
      [separateAudio],
    );

    // The video track is silent when paired; the audio element carries volume.
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      video.muted = separateAudio;
      if (!separateAudio) video.playbackRate = 1;
    }, [separateAudio]);

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
    }, [separateAudio]);

    // Either track stalling parks both, otherwise one runs ahead while the
    // other rebuffers and they never recover without a hard seek.
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
    }, [separateAudio, alignVideo, startPaired, setHolding]);

    useImperativeHandle(
      ref,
      () => ({
        get currentTime() {
          return getMaster()?.currentTime ?? 0;
        },
        set currentTime(value: number) {
          seek(value);
        },
        get volume() {
          return getMaster()?.volume ?? 1;
        },
        set volume(value: number) {
          const master = getMaster();
          if (master) master.volume = value;
        },
        get duration() {
          return getMaster()?.duration ?? 0;
        },
        get paused() {
          return getMaster()?.paused ?? true;
        },
        get ended() {
          return getMaster()?.ended ?? false;
        },
        play,
        pause,
        addEventListener: (type, listener) => getMaster()?.addEventListener(type, listener),
        removeEventListener: (type, listener) => getMaster()?.removeEventListener(type, listener),
      }),
      [getMaster, seek, play, pause],
    );

    // While parked, a pause is the hold's own doing and one track becoming
    // ready says nothing about the pair, so those events are not the player's
    // to see. onHoldChange carries the buffering state instead.
    const suppressWhileHolding = useCallback(
      (handler?: ReactEventHandler<HTMLMediaElement>): ReactEventHandler<HTMLMediaElement> =>
        (event) => {
          if (holdingRef.current) return;
          handler?.(event);
        },
      [],
    );

    // Bound to whichever element owns the clock, so `event.currentTarget` is
    // the audio element when paired and the video element when muxed.
    const masterEvents = {
      onPlay,
      onEnded,
      onWaiting,
      onPause: suppressWhileHolding(onPause),
      onCanPlay: suppressWhileHolding(onCanPlay),
      onCanPlayThrough: suppressWhileHolding(onCanPlayThrough),
    };

    return (
      <>
        {videoUrl && (
          <video
            key={separateAudio ? "paired-video" : "muxed-video"}
            ref={videoRef}
            className={className}
            // Paired playback is started here so the audio can go first, so the
            // video must not autoplay itself.
            autoPlay={!separateAudio}
            muted={separateAudio}
            src={videoUrl}
            onError={() => onTrackError?.(new Error("Video track failed to load"))}
            {...(separateAudio ? {} : masterEvents)}
          >
            <track kind="captions" />
            <p className="text-center">Your browser does not support the video tag.</p>
          </video>
        )}

        {separateAudio && (
          <audio
            ref={audioRef}
            src={audioUrl ?? undefined}
            onError={() => onTrackError?.(new Error("Audio track failed to load"))}
            {...masterEvents}
          />
        )}
      </>
    );
  },
);
