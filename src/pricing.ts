import type { RawUsage } from './types.js'

interface ModelPricing {
  input: number        // per 1M tokens
  output: number
  cacheWrite: number
  cacheRead: number
}

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6':              { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-opus-4-5':              { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-sonnet-4-6':            { input:  3.00, output: 15.00, cacheWrite:  3.75, cacheRead: 0.30 },
  'claude-sonnet-4-5':            { input:  3.00, output: 15.00, cacheWrite:  3.75, cacheRead: 0.30 },
  'claude-haiku-4-5':             { input:  0.80, output:  4.00, cacheWrite:  1.00, cacheRead: 0.08 },
  'claude-haiku-4-5-20251001':    { input:  0.80, output:  4.00, cacheWrite:  1.00, cacheRead: 0.08 },
}

const DEFAULT_PRICING: ModelPricing = { input: 3.00, output: 15.00, cacheWrite: 3.75, cacheRead: 0.30 }

export function getPricing(model: string): ModelPricing {
  // Match by prefix if exact not found
  for (const [key, pricing] of Object.entries(PRICING)) {
    if (model === key || model.startsWith(key)) return pricing
  }
  return DEFAULT_PRICING
}

export function calcCost(usage: RawUsage, model: string): number {
  const p = getPricing(model)
  const M = 1_000_000
  return (
    (usage.input_tokens * p.input) / M +
    (usage.output_tokens * p.output) / M +
    (usage.cache_creation_input_tokens * p.cacheWrite) / M +
    (usage.cache_read_input_tokens * p.cacheRead) / M
  )
}
