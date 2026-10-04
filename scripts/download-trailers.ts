// Fetches each movie's trailer (trailer.youtube in meta.json) for local development:
//
//   public/trailers/<slug>.mp4           best video + original-language audio
//   public/trailers/<slug>.<locale>.mp4  same video with YouTube's dubbed audio, per site locale
//   public/trailers/<slug>.jpg           thumbnail, used as the player poster
//   public/subtitles/<slug>.<locale>.vtt subtitles per site locale (YouTube's own, else auto-captions)
//   public/images/<slug>.jpg, -card.jpg  banner/background frame (backdrop.fromTrailerAt in meta.json)
//
// It then records what exists in meta.json (originalLanguage, dubs, subtitles), so
// subtitle files added by hand in public/subtitles are picked up too. Video and audio
// files are git-ignored; subtitles are small and committed.
// Requires yt-dlp and ffmpeg on PATH.
//
//   npm run trailers             fetch whatever is missing
//   npm run trailers -- --force  fetch everything again (hand-made subtitles are kept)

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { locales, type Locale } from "../lib/i18n";
import type { MovieMeta } from "../lib/movies";

const ROOT = process.cwd();
const MOVIES_DIR = path.join(ROOT, "content", "movies");
const TRAILERS_DIR = path.join(ROOT, "public", "trailers");
const SUBTITLES_DIR = path.join(ROOT, "public", "subtitles");
const IMAGES_DIR = path.join(ROOT, "public", "images");
const force = process.argv.includes("--force");
// Point at another build (e.g. one with curl_cffi for browser impersonation) via YT_DLP=/path/to/yt-dlp.
const YT_DLP = process.env.YT_DLP ?? "yt-dlp";

// Highest resolution and frame rate first, then the best codec browsers decode
// broadly (VP9 or H.264; AV1 and HDR VP9.2 are skipped), AAC audio, then bitrate. Audio is
// the original-language track, not one of YouTube's dubs.
const VIDEO_SORT = "lang,res,fps,vcodec:vp9,acodec:aac,br";

type Format = { format_id: string; vcodec?: string; acodec?: string; ext: string; abr?: number; language?: string | null; format_note?: string };
type Info = { formats: Format[]; subtitles?: Record<string, unknown>; automatic_captions?: Record<string, unknown> };

const base = (lang: string) => lang.toLowerCase().split("-")[0];

// MP4 language tags must be ISO 639-2 codes; extend alongside lib/i18n.ts.
const ISO_639_2: Record<string, string> = { pt: "por", en: "eng", es: "spa", fr: "fra", de: "deu", it: "ita", ko: "kor", ja: "jpn" };

function ytDlp(args: string[]) {
  const result = spawnSync(YT_DLP, ["--no-playlist", "--quiet", "--no-warnings", ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`yt-dlp exited with ${result.status ?? result.error?.message}`);
}

function ffmpeg(args: string[]) {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
}

function fetchVideo(slug: string, url: string) {
  ytDlp([
    "--format", "bv*+ba/b",
    "--format-sort", VIDEO_SORT,
    "--merge-output-format", "mp4",
    // Moves the index to the start so playback begins before the file finishes loading.
    "--postprocessor-args", "Merger+ffmpeg:-movflags +faststart",
    "--write-thumbnail", "--convert-thumbnails", "jpg",
    "--force-overwrites",
    "--output", path.join(TRAILERS_DIR, `${slug}.%(ext)s`),
    url,
  ]);
}

// Downloads one dubbed audio track and pairs it with the already-downloaded video.
function fetchDub(slug: string, url: string, locale: Locale, audio: Format) {
  const tmp = path.join(TRAILERS_DIR, `${slug}.${locale}.audio.${audio.ext}`);
  try {
    ytDlp(["--format", audio.format_id, "--force-overwrites", "--output", tmp, url]);
    ffmpeg([
      "-i", path.join(TRAILERS_DIR, `${slug}.mp4`),
      "-i", tmp,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c", "copy",
      "-metadata:s:a:0", `language=${ISO_639_2[locale] ?? "und"}`,
      "-movflags", "+faststart",
      path.join(TRAILERS_DIR, `${slug}.${locale}.mp4`),
    ]);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function fetchSubtitle(slug: string, url: string, track: string, auto: boolean, locale: Locale) {
  const stem = path.join(SUBTITLES_DIR, `${slug}.${locale}.tmp`);
  ytDlp([
    "--skip-download",
    // YouTube rate-limits caption requests (HTTP 429) when they come in quick succession.
    "--sleep-subtitles", "8",
    auto ? "--write-auto-subs" : "--write-subs",
    "--sub-langs", track,
    "--sub-format", "vtt",
    "--output", stem,
    url,
  ]);
  const downloaded = `${stem}.${track}.vtt`;
  fs.writeFileSync(path.join(SUBTITLES_DIR, `${slug}.${locale}.vtt`), cleanVtt(fs.readFileSync(downloaded, "utf8")));
  fs.rmSync(downloaded);
}

// Grabs one frame as the page backdrop, trimming letterbox bars, in two sizes.
function makeBackdrop(slug: string, seconds: number, trim: { top?: number; bottom?: number } = {}) {
  const video = path.join(TRAILERS_DIR, `${slug}.mp4`);
  const probe = spawnSync(
    "ffmpeg",
    ["-ss", String(seconds), "-i", video, "-t", "1", "-vf", "cropdetect=limit=24:round=2", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const crop = [...probe.stderr.matchAll(/crop=(\d+:\d+:\d+:\d+)/g)].pop()?.[1];
  const top = trim.top ?? 0;
  const bottom = trim.bottom ?? 0;
  const filters =
    (crop ? `crop=${crop},` : "") + (top || bottom ? `crop=iw:ih*${1 - top - bottom}:0:ih*${top},` : "");
  for (const [suffix, width] of [["", 1920], ["-card", 960]] as const) {
    ffmpeg([
      "-ss", String(seconds), "-i", video, "-frames:v", "1",
      "-vf", `${filters}scale='min(${width},iw)':-2`,
      "-q:v", "3",
      path.join(IMAGES_DIR, `${slug}${suffix}.jpg`),
    ]);
  }
}

// YouTube's VTT carries positioning hints and karaoke-style word timings that
// browsers render badly; keep plain cues only.
function cleanVtt(vtt: string) {
  return vtt
    .replace(/^(Kind|Language):.*\n/gm, "")
    .replace(/ (align|position|line|size):\S+/g, "")
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>|<\/?c(\.[\w.]+)?>/g, "");
}

// Manual subtitles beat auto-captions; for auto-captions prefer the transcript of
// a track spoken in that language ("-orig") over a machine translation.
function pickSubtitle(info: Info, locale: Locale) {
  const match = (tracks: Record<string, unknown> | undefined) =>
    Object.keys(tracks ?? {})
      .filter((lang) => base(lang) === locale)
      .sort((a, b) => Number(b.endsWith("-orig")) - Number(a.endsWith("-orig")) || a.length - b.length)[0];
  const manual = match(info.subtitles);
  if (manual) return { track: manual, auto: false };
  const auto = match(info.automatic_captions);
  return auto ? { track: auto, auto: true } : null;
}

fs.mkdirSync(TRAILERS_DIR, { recursive: true });
fs.mkdirSync(SUBTITLES_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });
let failures = 0;

for (const slug of fs.readdirSync(MOVIES_DIR)) {
  const metaFile = path.join(MOVIES_DIR, slug, "meta.json");
  if (!fs.existsSync(metaFile)) continue;
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8")) as MovieMeta;
  const url = meta.trailer.youtube;
  if (!url) continue;

  try {
    console.log(`\n== ${slug}: ${url}`);
    // Needs only the local video, so it runs even when YouTube is rate-limiting.
    const at = meta.backdrop?.fromTrailerAt;
    if (at !== undefined && fs.existsSync(path.join(TRAILERS_DIR, `${slug}.mp4`)) &&
        (force || !fs.existsSync(path.join(IMAGES_DIR, `${slug}.jpg`)))) {
      console.log(`↓ backdrop at ${at}s`);
      makeBackdrop(slug, at, meta.backdrop?.trim);
    }
    const info = JSON.parse(
      execFileSync(YT_DLP, ["--no-playlist", "-J", url], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
    ) as Info;
    const audioTracks = info.formats.filter((f) => f.vcodec === "none" && f.acodec && f.acodec !== "none");
    // YouTube doesn't always label the original track; fall back to the one recorded in meta.json.
    const original =
      audioTracks.find((f) => /original/i.test(f.format_note ?? ""))?.language ?? meta.trailer.originalLanguage ?? null;

    if (force || !fs.existsSync(path.join(TRAILERS_DIR, `${slug}.mp4`))) {
      console.log("↓ video");
      fetchVideo(slug, url);
    }

    const dubs: Partial<Record<Locale, string>> = {};
    for (const locale of locales) {
      if (original && base(original) === locale) continue;
      if (meta.trailer.skip?.dubs?.includes(locale)) continue;
      // Prefer AAC (m4a) for the widest browser support, then bitrate.
      const audio = audioTracks
        .filter((f) => f.language && base(f.language) === locale)
        .sort((a, b) => Number(b.ext === "m4a") - Number(a.ext === "m4a") || (b.abr ?? 0) - (a.abr ?? 0))[0];
      if (!audio) continue;
      if (force || !fs.existsSync(path.join(TRAILERS_DIR, `${slug}.${locale}.mp4`))) {
        console.log(`↓ ${locale} dub (${audio.language})`);
        fetchDub(slug, url, locale, audio);
      }
      dubs[locale] = `/trailers/${slug}.${locale}.mp4`;
    }

    const subtitles: Partial<Record<Locale, string>> = {};
    for (const locale of locales) {
      const file = path.join(SUBTITLES_DIR, `${slug}.${locale}.vtt`);
      if (!fs.existsSync(file) && !meta.trailer.skip?.subtitles?.includes(locale)) {
        const pick = pickSubtitle(info, locale);
        if (pick) {
          console.log(`↓ ${locale} subtitles (${pick.auto ? "auto" : "manual"}: ${pick.track})`);
          fetchSubtitle(slug, url, pick.track, pick.auto, locale);
        }
      }
      if (fs.existsSync(file)) subtitles[locale] = `/subtitles/${slug}.${locale}.vtt`;
    }

    meta.trailer = {
      ...meta.trailer,
      originalLanguage: original ?? meta.trailer.originalLanguage,
      dubs,
      subtitles,
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + "\n");
    console.log(
      `✓ original audio: ${original ?? "unknown"} · dubs: ${Object.keys(dubs).join(", ") || "none"} · subtitles: ${Object.keys(subtitles).join(", ") || "none"}`,
    );
  } catch (error) {
    failures++;
    console.error(`✗ ${slug}: ${error instanceof Error ? error.message : error}`);
  }
}

if (failures) process.exitCode = 1;
