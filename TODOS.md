# TODOS

Deferred work items. Each entry includes enough context to pick up without re-deriving the background.

---

## TODO-1: Fix `relevance` field in `searchHOARules`

**File:** `src/lib/ai/resident-tools.ts`

**What:** `Math.round(rrf_score * 100)` returns 1–3 for all results, which reads as near-zero quality.

**Why:** The `similarity` column returned by `match_ccr_chunks_with_context` is an RRF composite score (`1/(60+vector_rank) + 1/(60+text_rank)`), not cosine similarity. Max value is ~0.033. Multiplying by 100 gives a "relevance" of 1–3, which could make the LLM treat every result as very low quality.

**Fix options:**
- Replace with a descriptive label (`high`/`medium`/`low`) once TODO-2 thresholds are calibrated
- Or remove the field entirely from the tool return value if the LLM doesn't use it meaningfully

**Depends on:** TODO-2 (coordinate the fix — both fields should ship together)

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
