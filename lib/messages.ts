import fs from "node:fs";
import path from "node:path";
import { sourceLocale, type Locale } from "./i18n";

export type Messages = Record<string, string>;

const dir = path.join(process.cwd(), "messages");

function read(locale: Locale): Messages {
  const file = path.join(dir, `${locale}.json`);
  if (!fs.existsSync(file)) return {};
  const { _sourceHash, ...messages } = JSON.parse(fs.readFileSync(file, "utf8"));
  return messages;
}

// Source-language strings fill any key a translation is still missing.
export function getMessages(locale: Locale): Messages {
  return { ...read(sourceLocale), ...read(locale) };
}

export function format(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}
