import type { CrawlResult, Payload } from "../model.js";
import { menuDates } from "./dates.js";
import { crawlSnuco } from "./snuco.js";
import { crawlSnudorm } from "./snudorm.js";
import { crawlVet } from "./vet.js";

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

export async function crawlAll(now: Date = new Date()): Promise<CrawlResult> {
  const dates = menuDates(now);
  const [snuco, snudorm, vet] = await Promise.all([
    crawlSnuco(dates),
    crawlSnudorm(dates),
    crawlVet(now),
  ]);
  const payloads = [...snuco, ...snudorm, ...vet];
  rejectDuplicateSlots(payloads);
  return {
    payloads,
    sourceCounts: {
      snuco: snuco.length,
      snudorm: snudorm.length,
      vet: vet.length,
    },
  };
}
