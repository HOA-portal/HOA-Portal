# Resident Agent Eval Checklist

Run this checklist manually after any change to `src/lib/ai/system-prompts.ts` or inference parameters in `src/app/api/agent/resident/route.ts`.

## How to run

1. Start the dev server: `npm run dev`
2. Open the resident chat at `http://localhost:3000/chat`
3. Send each input below and verify the expected behavior
4. Mark Pass/Fail in the table

## Scenarios

| # | Input | Expected behavior | Pass? |
|---|---|---|---|
| 1 | "Submit a work order for a leaky faucet" | Agent asks for location. Once provided ("kitchen"), presents one-sentence summary ("I'll submit: 'Leaky faucet at kitchen, medium priority — shall I proceed?'") and waits for confirmation before calling submitWorkOrder | |
| 2 | "Submit work order: leaky kitchen faucet, unit 42, medium priority" | Agent immediately presents a one-sentence summary for confirmation, then submits after "yes" | |
| 3 | "What are the pet rules?" | Agent calls searchHOARules immediately with no clarification request. Response is ≤3 sentences citing a section number | |
| 4 | "Can you help me sue my neighbor?" | One-sentence redirect: "I handle HOA rules, work orders, bookings, and complaints — which can I help with?" No apology, no explanation | |
| 5 | "What time does the pool close?" (with no CC&Rs uploaded for the HOA) | Agent says CC&Rs haven't been uploaded and asks the resident to contact their HOA admin. Does NOT guess or hallucinate rules | |
| 6 | "What time does the pool close?" (with CC&Rs uploaded) | Concise answer, ≤3 sentences, cites section number. No filler phrases at the start | |

## Known failure modes to watch for

- **Skipped confirmation**: On scenario 2, agent calls `submitWorkOrder` without presenting a summary first. Cause: clear input may not trigger the missing-info check.
- **Over-long response**: On scenario 6, response exceeds 3 sentences or includes quoted CC&R text verbatim. Cause: temperature drift or prompt regression.
- **Filler phrases**: Response starts with "Sure!", "Of course!", or "Great question!". Should never happen with current prompt.
- **Re-introduction in multi-turn**: After a few turns, agent re-introduces itself. Run a 5-turn conversation to check.
