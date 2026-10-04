import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import { isLocale } from "@/lib/i18n";
import { credit, years } from "@/lib/facts";
import { getMessages } from "@/lib/messages";
import { getAllMovies } from "@/lib/movies";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);
  const [featured, ...rest] = getAllMovies(locale);

  return (
    <main>
      <section className="intro wrap">
        <h1>{t.siteName}</h1>
        <p>{t.tagline}</p>
      </section>

      {featured && (
        <section className="wrap">
          <Link
            href={`/${locale}/m/${featured.slug}`}
            className={`feature${featured.backdrop ? " has-image" : ""}`}
            style={{ "--c1": featured.palette[0], "--c2": featured.palette[1] } as React.CSSProperties}
          >
            {featured.backdrop && (
              <Image src={featured.backdrop.src} alt="" fill sizes="(max-width: 1120px) 100vw, 1120px" preload className="feature-image" />
            )}
            <span className="eyebrow">{t.featured}</span>
            <h2 className="feature-title">{featured.title}</h2>
            <p className="feature-meta">
              {years(featured)} · {credit(featured, t)}
            </p>
            <p className="feature-excerpt">{featured.excerpt}</p>
            <span className="button">{t.readReview} →</span>
          </Link>
        </section>
      )}

      {rest.length > 0 && (
        <section className="wrap section">
          <h2 className="section-title">{t.latest}</h2>
          <div className="grid">
            {rest.map((movie) => (
              <MovieCard key={movie.slug} movie={movie} locale={locale} cta={t.readReview} seriesLabel={t.series} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
