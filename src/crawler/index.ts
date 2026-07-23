import type { CrawlResult, Payload } from "../model.js";
import { menuDates } from "./dates.js";
import { crawlSnuco } from "./snuco.js";
import { crawlSnudorm } from "./snudorm.js";
import { crawlVet } from "./vet.js";

const CRAWLER_SOURCES = ["snuco", "snudorm", "vet"] as const;
type CrawlerSource = (typeof CRAWLER_SOURCES)[number];
type CrawlerPromises = Record<CrawlerSource, Promise<Payload[]>>;
type CrawlerWarning = (source: CrawlerSource, error: unknown) => void;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeWorkflowCommand(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function emitCrawlerWarning(source: CrawlerSource, error: unknown): void {
  console.warn(
    `::warning title=${source.toUpperCase()} crawler failed::${escapeWorkflowCommand(errorMessage(error))}`,
  );
}

function rejectDuplicateSlots(payloads: Payload[]): void {
  const slots = new Set<string>();
  for (const payload of payloads) {
    const slot = `${payload.restaurant}\u0000${payload.date}\u0000${payload.type}`;
    if (slots.has(slot)) {
      throw new Error(
        `Duplicate meal payload slot: ${payload.restaurant}, ${payload.date}, ${payload.type}`,
      );
    }
    slots.add(slot);
  }
}

export async function collectCrawlResults(
  crawlers: CrawlerPromises,
  warn: CrawlerWarning = emitCrawlerWarning,
): Promise<CrawlResult> {
  const settled = await Promise.allSettled(CRAWLER_SOURCES.map((source) => crawlers[source]));
  const payloads: Payload[] = [];
  const sourceCounts: CrawlResult["sourceCounts"] = { snuco: 0, snudorm: 0, vet: 0 };
  const failures: unknown[] = [];

  settled.forEach((result, index) => {
    const source = CRAWLER_SOURCES[index];
    if (result.status === "fulfilled") {
      payloads.push(...result.value);
      sourceCounts[source] = result.value.length;
    } else {
      failures.push(result.reason);
      warn(source, result.reason);
    }
  });

  if (failures.length === CRAWLER_SOURCES.length) {
    throw new AggregateError(failures, "All meal crawlers failed");
  }

  rejectDuplicateSlots(payloads);
  return { payloads, sourceCounts };
}

export async function crawlAll(now: Date = new Date()): Promise<CrawlResult> {
  const dates = menuDates(now);
  return collectCrawlResults({
    snuco: crawlSnuco(dates),
    snudorm: crawlSnudorm(dates),
    vet: crawlVet(now),
  });
}
