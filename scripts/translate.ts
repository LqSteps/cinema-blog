// Translates every review and the UI strings from the source language into all
// other locales in lib/i18n.ts, using Claude. Each translation records a hash of
// the source it came from, so only new or edited content is sent to the API.
//
//   npm run translate              translate what is missing or outdated
//   npm run translate -- --check   list what is missing or outdated (no API calls)
//   npm run translate -- --force   retranslate everything
//   npm run translate -- --stamp   mark existing translations as current (after manual edits)
//   npm run translate -- interestelar parasita   only these reviews (UI strings are always included)
//   npm run translate -- --concurrency=8         parallel API requests (default 4)

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import matter from "gray-matter";
import { locales, sourceLocale, type Locale } from "../lib/i18n";

const ROOT = process.cwd();
const MOVIES_DIR = path.join(ROOT, "content", "movies");
const MESSAGES_DIR = path.join(ROOT, "messages");
const argv = process.argv.slice(2);
const args = new Set(argv.filter((arg) => arg.startsWith("--")));
const onlySlugs = new Set(argv.filter((arg) => !arg.startsWith("--")));
const CONCURRENCY = Number(argv.find((arg) => arg.startsWith("--concurrency="))?.split("=")[1] ?? 4);
const mode = args.has("--check") ? "check" : args.has("--stamp") ? "stamp" : "translate";
const force = args.has("--force");

const targets = locales.filter((locale) => locale !== sourceLocale);
// Spelled out where the bare language name leaves the script or variant open.
const languageNames: Partial<Record<Locale, string>> = {
  "pt-PT": "European Portuguese (as written in Portugal)",
  zh: "Simplified Chinese (as written in mainland China)",
  "zh-HK": "Traditional Chinese (as written in Hong Kong)",
  no: "Norwegian Bokmål",
  tl: "Filipino (Tagalog)",
  ms: "Malay (as written in Malaysia)",
  ar: "Modern Standard Arabic",
};
const languageName = (locale: Locale) =>
  languageNames[locale] ?? new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? locale;

const hash = (text: string) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);

type Job = { label: string; run: () => Promise<void> | void };

// --- Claude ---------------------------------------------------------------

let client: Anthropic | undefined;

function systemPrompt(locale: Locale) {
  return `You translate content for Cinephilia, a film review blog, from Brazilian Portuguese into ${languageName(locale)}.

Write the way a native film critic in that language would: keep the author's tone, rhythm and opinions, but don't translate word for word. Use the title each film was officially released under in markets that speak ${languageName(locale)}; if you don't know one, keep the original title. Leave people's names, the brand name "Cinephilia" and placeholders in curly braces such as {director} unchanged. Keep all Markdown (headings, emphasis, links, paragraph breaks) exactly as in the source.

The user message is a JSON object. Return the same object with every string value translated and the same keys.`;
}

async function translateObject<T extends Record<string, unknown>>(
  locale: Locale,
  payload: T,
  schema: Record<string, unknown>,
): Promise<T> {
  client ??= new Anthropic();
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 64000,
    // If a safety classifier declines, the API retries on a recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    system: systemPrompt(locale),
    messages: [{ role: "user", content: JSON.stringify(payload, null, 2) }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(`refused (${message.stop_details?.category ?? "no category"})`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("output was cut off at max_tokens");
  }
  const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  return JSON.parse(text) as T;
}

// --- Reviews (content/movies/<slug>/<locale>.md) --------------------------

const movieSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    excerpt: { type: "string" },
    genres: { type: "array", items: { type: "string" } },
    body: { type: "string" },
  },
  required: ["title", "excerpt", "genres", "body"],
  additionalProperties: false,
};

function movieJobs(): Job[] {
  const jobs: Job[] = [];
  for (const slug of fs.readdirSync(MOVIES_DIR)) {
    if (onlySlugs.size && !onlySlugs.has(slug)) continue;
    const sourceFile = path.join(MOVIES_DIR, slug, `${sourceLocale}.md`);
    if (!fs.existsSync(sourceFile)) continue;
    const raw = fs.readFileSync(sourceFile, "utf8");
    const sourceHash = hash(raw);
    const source = matter(raw);

    for (const locale of targets) {
      const targetFile = path.join(MOVIES_DIR, slug, `${locale}.md`);
      const existing = fs.existsSync(targetFile) ? matter(fs.readFileSync(targetFile, "utf8")) : null;
      const label = `content/movies/${slug}/${locale}.md`;

      if (mode === "stamp") {
        if (existing && existing.data.sourceHash !== sourceHash) {
          jobs.push({
            label,
            run: () => fs.writeFileSync(targetFile, matter.stringify(existing.content, { ...existing.data, sourceHash })),
          });
        }
        continue;
      }
      if (!force && existing?.data.sourceHash === sourceHash) continue;

      jobs.push({
        label,
        run: async () => {
          const result = await translateObject(
            locale,
            {
              title: String(source.data.title),
              excerpt: String(source.data.excerpt),
              genres: (source.data.genres ?? []) as string[],
              body: source.content.trim(),
            },
            movieSchema,
          );
          const { body, ...frontmatter } = result;
          fs.writeFileSync(targetFile, matter.stringify(`\n${body}\n`, { ...frontmatter, sourceHash }));
        },
      });
    }
  }
  return jobs;
}

// --- UI strings (messages/<locale>.json) ----------------------------------

function messageJobs(): Job[] {
  const raw = fs.readFileSync(path.join(MESSAGES_DIR, `${sourceLocale}.json`), "utf8");
  const sourceHash = hash(raw);
  const source: Record<string, string> = JSON.parse(raw);
  const schema = {
    type: "object",
    properties: Object.fromEntries(Object.keys(source).map((key) => [key, { type: "string" }])),
    required: Object.keys(source),
    additionalProperties: false,
  };

  return targets.flatMap((locale): Job[] => {
    const targetFile = path.join(MESSAGES_DIR, `${locale}.json`);
    const existing = fs.existsSync(targetFile) ? JSON.parse(fs.readFileSync(targetFile, "utf8")) : null;
    const label = `messages/${locale}.json`;
    const write = (data: Record<string, string>) =>
      fs.writeFileSync(targetFile, JSON.stringify({ _sourceHash: sourceHash, ...data }, null, 2) + "\n");

    if (mode === "stamp") {
      if (!existing || existing._sourceHash === sourceHash) return [];
      const { _sourceHash, ...data } = existing;
      return [{ label, run: () => write(data) }];
    }
    if (!force && existing?._sourceHash === sourceHash) return [];
    return [{ label, run: async () => write(await translateObject(locale, source, schema)) }];
  });
}

// --- Runner ---------------------------------------------------------------

async function main() {
  const jobs = [...messageJobs(), ...movieJobs()];

  if (jobs.length === 0) {
    console.log("Everything is up to date.");
    return;
  }
  if (mode === "check") {
    console.log(`${jobs.length} file(s) missing or outdated:`);
    for (const job of jobs) console.log(`  ${job.label}`);
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  const queue = [...jobs];
  async function worker() {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        await job.run();
        console.log(`✓ ${job.label}`);
      } catch (error) {
        failures++;
        if (error instanceof Anthropic.AuthenticationError) {
          console.error(`✗ ${job.label}: no valid credentials (set ANTHROPIC_API_KEY or run \`ant auth login\`)`);
        } else if (error instanceof Anthropic.RateLimitError) {
          console.error(`✗ ${job.label}: rate limited, run again in a minute`);
        } else if (error instanceof Anthropic.APIError) {
          console.error(`✗ ${job.label}: API error ${error.status}: ${error.message}`);
        } else {
          console.error(`✗ ${job.label}: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  if (failures) {
    console.error(`\n${failures} of ${jobs.length} failed. Run the command again to retry them.`);
    process.exitCode = 1;
  }
}

main();
