import type { CatalogType } from "@/lib/metadata";

export type SubtitleItem = {
  id: string;
  url: string;
  lang: string;
  label: string;
  source: string;
  downloads?: number;
};

export type SubtitleTarget = {
  type: CatalogType;
  imdbId: string;
  season?: number;
  episode?: number;
};

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

const aliases: Record<string, string> = {
  baq: "eu",
  chi: "zh",
  cze: "cs",
  dut: "nl",
  ell: "el",
  fre: "fr",
  ger: "de",
  gre: "el",
  ice: "is",
  mac: "mk",
  may: "ms",
  per: "fa",
  rum: "ro",
  slo: "sk",
  tib: "bo",
  wel: "cy",
};

export function subtitleLanguageLabel(lang: string): string {
  const normalized = normalizeSubtitleLang(lang);
  return languageNames.of(normalized) ?? lang.toUpperCase();
}

export function normalizeSubtitleLang(lang: string): string {
  const lower = lang.toLowerCase();
  return aliases[lower] ?? lower;
}
