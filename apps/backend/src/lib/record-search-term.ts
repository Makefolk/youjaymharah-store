import type { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import { SEARCH_INSIGHTS_MODULE } from "../modules/search-insights";
import type SearchInsightsModuleService from "../modules/search-insights/service";
import { SEARCH_PERFORMED_EVENT } from "../subscribers/search-performed";

/**
 * Counts a search towards the trending terms. Emitted rather than written
 * here so the shopper's response does not wait on it, and swallowed because a
 * tally is never worth failing a search over.
 */
export async function recordSearchTerm(
  container: MedusaContainer,
  term: string,
  resultCount: number,
) {
  try {
    const service: SearchInsightsModuleService = container.resolve(
      SEARCH_INSIGHTS_MODULE,
    );
    const approved = await service.approveTerm(term);
    if (!approved || !Number.isSafeInteger(resultCount) || resultCount < 0)
      return;
    await container.resolve(Modules.EVENT_BUS).emit({
      name: SEARCH_PERFORMED_EVENT,
      data: { term: approved, result_count: resultCount },
    });
  } catch {
    // The search itself succeeded; the tally is not worth a 500.
  }
}
