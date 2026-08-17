import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type ReactEventHandler,
} from "react";
import { useDualTrackSync } from "../../hooks/useDualTrackSync";

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
 * the video-only ladder reaches 1080p. Keeping both shapes behind one ref means
 * the player drives playback the same way either way.
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
    const mediaKey = separateAudio ? "paired" : "muxed";

    const { play, pause, seek, getMaster, isHolding, videoProps } = useDualTrackSync({
      videoRef,
      audioRef,
      separateAudio,
      mediaKey,
      onAudioFailure,
      onHoldChange,
    });

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
          if (isHolding()) return;
          handler?.(event);
        },
      [isHolding],
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
            key={`${mediaKey}:video`}
            ref={videoRef}
            className={className}
            {...videoProps}
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
            key={`${mediaKey}:audio`}
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
