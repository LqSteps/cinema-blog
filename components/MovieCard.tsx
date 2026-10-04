import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@/lib/movies";
import type { Locale } from "@/lib/i18n";
import { years } from "@/lib/facts";

export default function MovieCard({ movie, locale, cta, seriesLabel }: { movie: Movie; locale: Locale; cta: string; seriesLabel: string }) {
  return (
    <Link href={`/${locale}/m/${movie.slug}`} className="card">
      <div
        className="card-art"
        style={{ "--c1": movie.palette[0], "--c2": movie.palette[1] } as React.CSSProperties}
      >
        <span className="card-year">
          {years(movie)}
          {movie.kind === "series" && ` · ${seriesLabel}`}
        </span>
        <span className="card-score">{movie.rating.toFixed(1)}</span>
        {movie.backdrop ? (
          <Image src={movie.backdrop.card} alt="" fill sizes="(max-width: 700px) 100vw, 360px" className="card-image" />
        ) : (
          <span className="card-art-title">{movie.title}</span>
        )}
      </div>
      <div className="card-body">
        <p className="card-genres">{movie.genres.join(" · ")}</p>
        <h3 className="card-title">{movie.title}</h3>
        <p className="card-excerpt">{movie.excerpt}</p>
        <span className="card-cta">{cta} →</span>
      </div>
    </Link>
  );
}
