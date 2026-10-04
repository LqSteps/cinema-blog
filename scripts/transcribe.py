"""Drafts subtitles for a trailer with Whisper, for trailers YouTube has no usable captions for.

    npm run transcribe:setup                          # once: creates .venv-whisper
    npm run transcribe -- <slug>                      # original audio, language auto-detected
    npm run transcribe -- <slug> --dub pt             # transcribe the pt dub (public/trailers/<slug>.pt.mp4)
    npm run transcribe -- <slug> --language ko        # force the spoken language

Writes drafts/subtitles/<slug>.<language>.draft.vtt (git-ignored). The output is a
draft: Whisper mishears names and lines, especially over music. Review the text and
timings, translate it, then save each language as public/subtitles/<slug>.<locale>.vtt
and run `npm run trailers` so meta.json picks the files up. For trailers with
subtitles burned into the video, add a cue setting such as `line:70%` so the
tracks don't overlap.
"""

import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
TRAILERS = ROOT / "public" / "trailers"
DRAFTS = ROOT / "drafts" / "subtitles"

# Cue limits that keep subtitles readable.
MAX_CUE_SECONDS = 6.0
MAX_CUE_CHARS = 84  # about two lines
PAUSE_SPLIT_SECONDS = 0.8


def load_audio(path: Path) -> np.ndarray:
    # Decode with ffmpeg instead of faster-whisper's own decoder (PyAV), whose
    # version can be incompatible with the installed faster-whisper.
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, np.float32)


def timestamp(seconds: float) -> str:
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{int(hours):02}:{int(minutes):02}:{secs:06.3f}"


def build_cues(segments):
    """Groups words into cues, splitting at sentence ends, pauses and length limits.
    Word timings avoid the multi-second cues Whisper's segments produce over music."""
    cues, words = [], []

    def flush():
        if words:
            text = " ".join(w.word.strip() for w in words).strip()
            if text:
                cues.append((words[0].start, words[-1].end, text))
            words.clear()

    for segment in segments:
        for word in segment.words or []:
            if words:
                text_len = sum(len(w.word) for w in words) + len(word.word)
                if (
                    word.start - words[-1].end > PAUSE_SPLIT_SECONDS
                    or word.end - words[0].start > MAX_CUE_SECONDS
                    or text_len > MAX_CUE_CHARS
                ):
                    flush()
            words.append(word)
            if word.word.strip().endswith((".", "?", "!", "。", "？", "！")):
                flush()
        flush()  # never let a cue span two segments
    return cues


def main():
    parser = argparse.ArgumentParser(description="Draft subtitles for a trailer with Whisper.")
    parser.add_argument("slug", help="movie folder name, e.g. interestelar")
    parser.add_argument("--dub", help="transcribe the dubbed file <slug>.<dub>.mp4 instead of the original")
    parser.add_argument("--language", help="spoken language code (default: auto-detect)")
    parser.add_argument("--model", default="large-v3-turbo", help="Whisper model (default: large-v3-turbo)")
    args = parser.parse_args()

    video = TRAILERS / (f"{args.slug}.{args.dub}.mp4" if args.dub else f"{args.slug}.mp4")
    if not video.exists():
        sys.exit(f"{video.relative_to(ROOT)} not found. Run `npm run trailers` first.")

    print(f"Transcribing {video.relative_to(ROOT)} with {args.model} (first run downloads the model)…", flush=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        load_audio(video),
        language=args.language or args.dub,
        vad_filter=True,  # skips music-only stretches, where Whisper tends to invent lines
        word_timestamps=True,
        condition_on_previous_text=False,
    )
    cues = build_cues(segments)

    DRAFTS.mkdir(parents=True, exist_ok=True)
    out = DRAFTS / f"{args.slug}.{info.language}.draft.vtt"
    lines = ["WEBVTT", ""]
    for start, end, text in cues:
        lines += [f"{timestamp(start)} --> {timestamp(end)}", text, ""]
    out.write_text("\n".join(lines))
    print(f"✓ {len(cues)} cues, language {info.language} ({info.language_probability:.0%}) → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
