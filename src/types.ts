export interface RawUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  cache_creation?: {
    ephemeral_1h_input_tokens?: number
    ephemeral_5m_input_tokens?: number
  }
}

export interface RawMessage {
  type: 'user' | 'assistant' | 'system' | 'permission-mode' | 'file-history-snapshot'
  uuid?: string
  parentUuid?: string | null
  promptId?: string
  sessionId?: string
  timestamp?: string
  isSidechain?: boolean
  userType?: 'external' | 'internal'
  cwd?: string
  message?: {
    role?: string
    content?: unknown
    model?: string
    id?: string
    usage?: RawUsage
  }
  requestId?: string
}

export interface Turn {
  index: number
  timestamp: string
  userContent: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  apiCallCount: number
  cost: number
}

export interface Session {
  id: string
  project: string
  startTime: string
  endTime: string
  model: string
  turns: Turn[]
  totalCost: number
  totalInput: number
  totalOutput: number
  totalCacheCreation: number
  totalCacheRead: number
}
