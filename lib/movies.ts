import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { sourceLocale, type Locale } from "./i18n";

export const MOVIES_DIR = path.join(process.cwd(), "content", "movies");

// Language-independent facts, stored once per movie in meta.json.
export type MovieMeta = {
  originalTitle: string;
  kind?: "movie" | "series"; // defaults to movie
  year: number;
  yearEnd?: number; // series: last year on air
  director?: string; // movies
  creator?: string; // series
  seasons?: number; // series
  runtime: number; // minutes; per episode for series
  rating: number; // our score, 0-10
  publishedAt: string; // ISO date
  palette: [string, string]; // accent colors; also the fallback when there's no backdrop
  backdrop?: {
    src: string; // wide image for the page banner and background
    card: string; // smaller version for listing cards
    fromTrailerAt?: number; // seconds: `npm run trailers` grabs the frame here
    trim?: { top?: number; bottom?: number }; // fraction of the height to cut, e.g. to drop a watermark
  };
  trailer: {
    youtube?: string; // source video, fetched locally by `npm run trailers`
    src: string; // HLS playlist (.m3u8) or MP4 URL
    poster?: string;
    originalLanguage?: string; // BCP 47 tag of the original audio, e.g. "en-US"
    dubs?: Partial<Record<Locale, string>>; // same video with dubbed audio, per language
    subtitles?: Partial<Record<Locale, string>>; // WebVTT per language
    // Languages `npm run trailers` must not fetch, e.g. a poor dub or captions
    // that duplicate subtitles burned into the video.
    skip?: { dubs?: Locale[]; subtitles?: Locale[] };
  };
};

// Translatable fields, one Markdown file per language.
export type MovieText = {
  title: string;
  excerpt: string;
  genres: string[];
};

export type Movie = MovieMeta &
  MovieText & {
    slug: string;
    html: string;
    // True when this language has no translation yet and the source text is shown.
    isFallback: boolean;
  };

export function getMovieSlugs(): string[] {
  return fs
    .readdirSync(MOVIES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export function getMovie(slug: string, locale: Locale): Movie | null {
  const dir = path.join(MOVIES_DIR, slug);
  const metaFile = path.join(dir, "meta.json");
  if (!fs.existsSync(metaFile)) return null;

  let file = path.join(dir, `${locale}.md`);
  const isFallback = !fs.existsSync(file);
  if (isFallback) file = path.join(dir, `${sourceLocale}.md`);
  if (!fs.existsSync(file)) return null;

  const meta: MovieMeta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  const text = data as MovieText;

  return {
    ...meta,
    title: text.title,
    excerpt: text.excerpt,
    genres: text.genres ?? [],
    slug,
    html: marked.parse(content, { async: false }),
    isFallback,
  };
}

export function getAllMovies(locale: Locale): Movie[] {
  return getMovieSlugs()
    .map((slug) => getMovie(slug, locale))
    .filter((movie): movie is Movie => movie !== null)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
