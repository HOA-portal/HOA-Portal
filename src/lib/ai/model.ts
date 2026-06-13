import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

/**
 * Returns the active chat model based on env vars.
 * AGENT_LLM_PROVIDER: "openai" (default) | "anthropic"
 * AGENT_LLM_MODEL:    model ID for the chosen provider (default: "gpt-4o-mini")
 *
 * To switch to Anthropic on Vercel: set AGENT_LLM_PROVIDER=anthropic and AGENT_LLM_MODEL=claude-sonnet-4-5
 */
export function getAgentModel() {
  const provider = process.env.AGENT_LLM_PROVIDER ?? 'openai'
  const modelId = process.env.AGENT_LLM_MODEL ?? 'gpt-4o-mini'
  if (provider === 'anthropic') return anthropic(modelId)
  return openai(modelId)
}
