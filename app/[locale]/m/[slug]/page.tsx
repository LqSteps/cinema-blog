import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import TrailerPlayer from "@/components/TrailerPlayer";
import { isLocale, localeNames, locales, type Locale } from "@/lib/i18n";
import { facts, years } from "@/lib/facts";
import { format, getMessages } from "@/lib/messages";
import { getAllMovies, getMovie, getMovieSlugs } from "@/lib/movies";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => getMovieSlugs().map((slug) => ({ locale, slug })));
}

async function load(params: Props["params"]) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const movie = getMovie(slug, locale);
  if (!movie) notFound();
  return { locale, movie };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { movie } = await load(params);
  return { title: `${movie.title} (${years(movie)})`, description: movie.excerpt };
}

function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
}

export default async function MoviePage({ params }: Props) {
  const { locale, movie } = await load(params);
  const t = getMessages(locale);
  const others = getAllMovies(locale).filter((m) => m.slug !== movie.slug).slice(0, 3);
  // Dubbed audio in the visitor's language when there is one, otherwise the
  // original audio with subtitles in their language switched on.
  const { trailer } = movie;
  const trailerSrc = trailer.dubs?.[locale] ?? trailer.src;
  const audioLanguage = trailer.dubs?.[locale] ? locale : trailer.originalLanguage?.split("-")[0];
  const subtitles = locales
    .filter((l) => trailer.subtitles?.[l])
    .map((l) => ({ src: trailer.subtitles![l]!, lang: l, label: localeNames[l] }));

  return (
    <main>
      {movie.backdrop && (
        <div className="page-bg" aria-hidden="true" style={{ backgroundImage: `url(${movie.backdrop.card})` }} />
      )}
      <header
        className={`hero${movie.backdrop ? " has-image" : ""}`}
        style={{ "--c1": movie.palette[0], "--c2": movie.palette[1] } as React.CSSProperties}
      >
        {movie.backdrop && (
          <Image src={movie.backdrop.src} alt="" fill sizes="100vw" preload className="hero-image" />
        )}
        <div className="wrap hero-inner">
          <p className="eyebrow">{movie.genres.join(" · ")}</p>
          <h1 className="hero-title">{movie.title}</h1>
          <p className="hero-excerpt">{movie.excerpt}</p>
          <ul className="facts">
            {facts(movie, t).map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
            <li className="facts-score" title={t.rating}>
              <span className="visually-hidden">{t.rating}: </span>★ {movie.rating.toFixed(1)}
            </li>
          </ul>
          <a href="#trailer" className="button button-ghost">
            ▶ {t.skipToTrailer}
          </a>
        </div>
      </header>

      <article className="wrap article">
        {movie.isFallback && <p className="notice">{t.fallbackNotice}</p>}
        <p className="article-meta">
          {movie.originalTitle !== movie.title && (
            <>
              {t.originalTitle}: <em>{movie.originalTitle}</em> ·{" "}
            </>
          )}
          {format(t.publishedOn, { date: formatDate(movie.publishedAt, locale) })}
        </p>
        <div className="prose" dangerouslySetInnerHTML={{ __html: movie.html }} />

        <section id="trailer" className="trailer" aria-labelledby="trailer-heading">
          <h2 id="trailer-heading">{t.trailer}</h2>
          <p>{t.trailerIntro}</p>
          <TrailerPlayer
            src={trailerSrc}
            poster={trailer.poster}
            title={movie.title}
            palette={movie.palette}
            subtitles={subtitles}
            defaultSubtitle={audioLanguage !== locale ? locale : undefined}
            labels={{ play: t.playTrailer, error: t.trailerError }}
          />
        </section>
      </article>

      {others.length > 0 && (
        <section className="wrap section">
          <h2 className="section-title">{t.moreMovies}</h2>
          <div className="grid">
            {others.map((m) => (
              <MovieCard key={m.slug} movie={m} locale={locale} cta={t.readReview} seriesLabel={t.series} />
            ))}
          </div>
          <p className="back">
            <Link href={`/${locale}`}>← {t.backHome}</Link>
          </p>
        </section>
      )}
    </main>
  );
}
