# TODOS

Deferred work items. Each entry includes enough context to pick up without re-deriving the background.

---

## ~~TODO-1: Fix `relevance` field in `searchHOARules`~~ — DONE (commit 7d41ce5)

Field removed entirely from `src/lib/ai/resident-tools.ts`. Was returning 1–3 for all results
(RRF score × 100), misleading the LLM. Removed until TODO-2 calibration is done.

---

## TODO-2: Add calibrated RRF-based confidence field to `searchHOARules`

**File:** `src/lib/ai/resident-tools.ts`

**What:** Add a `confidence: "high" | "medium" | "low"` field to each result in `searchHOARules` so the agent can hedge answers when results are weakly relevant.

**Why deferred:** The original plan proposed thresholds of `>= 0.40` (high) and `>= 0.25` (medium), but the `similarity` field is an RRF score with a maximum of ~0.033. Those thresholds would classify every result as "low", making the feature useless.

**How to calibrate:**
1. After deploying to production (or with a seeded HOA), run:
   ```sql
   SELECT avg_similarity, query_text FROM rag_query_logs ORDER BY created_at DESC LIMIT 50;
   ```
2. Examine the distribution of `avg_similarity` values
3. Set `high`/`medium`/`low` cutpoints based on the actual distribution (e.g., top quartile = high, mid = medium, bottom = low)
4. Add the confidence field alongside relevance in the `results.map()` block
5. Add system prompt instruction: when all results are "low" confidence, add a caveat to the answer

**Depends on:** TODO-1 (fix or remove `relevance` first)
