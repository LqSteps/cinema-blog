"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";

type Props = {
  src: string;
  title: string;
  poster?: string;
  palette: [string, string];
  subtitles?: { src: string; lang: string; label: string }[];
  // Track shown from the start, when the audio isn't in the visitor's language.
  defaultSubtitle?: string;
  labels: { play: string; error: string };
};

type Status = "idle" | "loading" | "ready" | "error";

// Nothing is downloaded until the visitor presses play: video bandwidth is the
// main hosting cost, and many readers never reach or start the trailer.
export default function TrailerPlayer({ src, title, poster, palette, subtitles = [], defaultSubtitle, labels }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => () => hlsRef.current?.destroy(), []);

  async function start() {
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");

    const isHls = /\.m3u8($|\?)/.test(src);
    // Safari and iOS play HLS natively; everyone else needs hls.js.
    if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      const { default: HlsLib } = await import("hls.js");
      if (!HlsLib.isSupported()) {
        setStatus("error");
        return;
      }
      // Don't fetch renditions larger than the player is actually displayed.
      const hls = new HlsLib({ capLevelToPlayerSize: true });
      hls.on(HlsLib.Events.ERROR, (_event, data) => {
        if (data.fatal) setStatus("error");
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;
    }

    video.onerror = () => setStatus("error");
    try {
      await video.play();
    } catch {
      // Autoplay can still be refused; the native controls let the visitor retry.
    }
    setStatus((current) => (current === "error" ? current : "ready"));
  }

  return (
    <div
      className="player"
      style={{ "--c1": palette[0], "--c2": palette[1] } as React.CSSProperties}
    >
      <video
        ref={videoRef}
        className="player-video"
        poster={poster}
        preload="none"
        playsInline
        controls={status === "ready"}
        aria-label={`${labels.play}: ${title}`}
      >
        {subtitles.map((track) => (
          <track
            key={track.lang}
            kind="subtitles"
            src={track.src}
            srcLang={track.lang}
            label={track.label}
            default={track.lang === defaultSubtitle}
          />
        ))}
      </video>

      {(status === "idle" || status === "loading") && (
        <button
          type="button"
          className="player-cover"
          style={poster ? { backgroundImage: `linear-gradient(rgb(0 0 0 / .35), rgb(0 0 0 / .55)), url(${poster})` } : undefined}
          onClick={start}
          disabled={status === "loading"}
          aria-label={`${labels.play}: ${title}`}
        >
          <span className={`player-button${status === "loading" ? " is-loading" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
            </svg>
          </span>
          <span className="player-label">{labels.play}</span>
        </button>
      )}

      {status === "error" && (
        <p className="player-error" role="alert">
          {labels.error}
        </p>
      )}
    </div>
  );
}
