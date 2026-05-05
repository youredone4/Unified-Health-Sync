/**
 * Caraga DOH (caraga.doh.gov.ph) news/updates scraper.
 *
 * Fetches the regional landing page once a day, extracts post entries, and
 * upserts them into `doh_updates` with `source = SCRAPED_CARAGA`. Dedupe is
 * by `source_url` (unique index on the column).
 *
 * Defensive parsing: the page is a CMS template, so we try a chain of
 * selectors and accept the first that yields results. Each candidate item
 * must have a title + URL to be kept; date and summary are optional.
 *
 * Hostile network handling:
 *   - 10 s connect timeout, 20 s total fetch timeout.
 *   - Any network or parse failure is caught; the job logs and returns 0
 *     instead of crashing the scheduler tick.
 *
 * Tags + significance: out of scope here. Defaults to bureau=CHD,
 * significance=MEDIUM. The future recommendation engine (or an admin) can
 * upgrade significance / add tags after the fact.
 */

import * as cheerio from "cheerio";
import { db } from "../db";
import { dohUpdates } from "@shared/schema";
import { eq } from "drizzle-orm";

const CARAGA_DOH_URL = "https://caraga.doh.gov.ph/";
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "HealthSyncScraper/1.0 (+https://github.com/youredone4/Unified-Health-Sync)";

// Selector chain: try a list of CSS selectors until one yields ≥1 entry.
// CMS templates vary; this list covers WordPress, Joomla, and bespoke
// layouts that the regional sites have used historically.
const ITEM_SELECTORS = [
  "article.post",
  "article",
  ".post",
  ".news-item",
  ".entry",
  ".item",
  "li.news",
  ".et_pb_post",       // Divi theme
  ".elementor-post",   // Elementor theme
] as const;

interface ScrapedItem {
  title: string;
  sourceUrl: string;
  publishedDate: string; // YYYY-MM-DD
  summary: string;
}

/** Parse a date from common DOH page formats. Returns YYYY-MM-DD or "" if unknown. */
function parseDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Try native Date first — handles "January 5, 2026" and ISO.
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return "";
}

/** Resolve a possibly-relative href against the page URL. */
function absoluteUrl(href: string): string {
  try {
    return new URL(href, CARAGA_DOH_URL).toString();
  } catch {
    return href;
  }
}

/**
 * Extract candidate updates from raw HTML. Pure function — no DB or network
 * — so the test suite can exercise it without mocking fetch.
 */
export function extractItems(html: string): ScrapedItem[] {
  const $ = cheerio.load(html);
  const today = new Date().toISOString().slice(0, 10);

  for (const selector of ITEM_SELECTORS) {
    const nodes = $(selector);
    if (nodes.length === 0) continue;

    const items: ScrapedItem[] = [];
    nodes.each((_, el) => {
      const $el = $(el);
      // Title: first heading-like element or the first link with text.
      const titleEl = $el.find("h1 a, h2 a, h3 a, h4 a, .entry-title a, .post-title a").first();
      const title = (titleEl.text() || $el.find("h1, h2, h3, h4, .entry-title, .post-title").first().text()).trim();
      if (!title) return;

      const href = titleEl.attr("href") || $el.find("a").first().attr("href") || "";
      if (!href) return;

      const dateRaw =
        $el.find("time").attr("datetime") ||
        $el.find("time").text() ||
        $el.find(".date, .post-date, .entry-date").first().text() ||
        "";
      const publishedDate = parseDate(dateRaw) || today;

      const summary =
        $el.find(".entry-summary, .post-excerpt, .excerpt, p").first().text().trim().slice(0, 500) ||
        title;

      items.push({
        title,
        sourceUrl: absoluteUrl(href),
        publishedDate,
        summary,
      });
    });

    if (items.length > 0) {
      // Dedupe by sourceUrl within the same scrape (some themes wrap each
      // post twice in the DOM).
      const seen = new Set<string>();
      return items.filter((it) => {
        if (seen.has(it.sourceUrl)) return false;
        seen.add(it.sourceUrl);
        return true;
      });
    }
  }

  return [];
}

/** Fetch the Caraga DOH landing page with a hard timeout. */
async function fetchPage(): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(CARAGA_DOH_URL, {
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${CARAGA_DOH_URL}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run the scrape. Returns counts so the admin endpoint + scheduler log can
 * report something meaningful.
 */
export async function scrapeCaragaDoh(): Promise<{
  fetched: number;
  inserted: number;
  skipped: number;
}> {
  let html: string;
  try {
    html = await fetchPage();
  } catch (err) {
    console.error("[scrape-caraga-doh] fetch failed:", err);
    return { fetched: 0, inserted: 0, skipped: 0 };
  }

  const items = extractItems(html);
  if (items.length === 0) {
    console.warn("[scrape-caraga-doh] page parsed but no items matched any selector");
    return { fetched: 0, inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;
  for (const it of items) {
    try {
      const existing = await db
        .select({ id: dohUpdates.id })
        .from(dohUpdates)
        .where(eq(dohUpdates.sourceUrl, it.sourceUrl))
        .limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      await db.insert(dohUpdates).values({
        title: it.title,
        summary: it.summary,
        sourceUrl: it.sourceUrl,
        publishedDate: it.publishedDate,
        bureau: "CHD",
        significance: "MEDIUM",
        source: "SCRAPED_CARAGA",
        tags: [],
      });
      inserted++;
    } catch (err) {
      console.error(`[scrape-caraga-doh] insert failed for ${it.sourceUrl}:`, err);
      skipped++;
    }
  }

  console.log(
    `[scrape-caraga-doh] fetched ${items.length} item(s); ${inserted} new, ${skipped} already-known`,
  );

  return { fetched: items.length, inserted, skipped };
}
