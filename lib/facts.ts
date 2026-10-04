import { format, type Messages } from "./messages";
import type { MovieMeta } from "./movies";

type Facts = Pick<MovieMeta, "kind" | "year" | "yearEnd" | "director" | "creator" | "seasons" | "runtime">;

export function years(item: Facts) {
  return item.kind === "series" && item.yearEnd && item.yearEnd !== item.year
    ? `${item.year}–${item.yearEnd}`
    : String(item.year);
}

// "Directed by …" for movies, "Created by …" for series.
export function credit(item: Facts, t: Messages) {
  return item.kind === "series"
    ? format(t.createdBy, { creator: item.creator ?? "" })
    : format(t.directedBy, { director: item.director ?? "" });
}

export function facts(item: Facts, t: Messages): string[] {
  if (item.kind === "series") {
    return [
      years(item),
      t.series,
      format(item.seasons === 1 ? t.season : t.seasons, { n: item.seasons ?? 0 }),
      format(t.minutesPerEpisode, { n: item.runtime }),
      credit(item, t),
    ];
  }
  return [years(item), format(t.minutes, { n: item.runtime }), credit(item, t)];
}
