import { readFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { RawMessage, Session, Turn } from './types.js'
import { calcCost } from './pricing.js'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const block of content) {
      if (block && typeof block === 'object') {
        const b = block as Record<string, unknown>
        if (b.type === 'text' && typeof b.text === 'string') {
          parts.push(b.text)
        } else if (b.type === 'tool_use' && typeof b.name === 'string') {
          parts.push(`[tool: ${b.name}]`)
        } else if (b.type === 'tool_result') {
          parts.push('[tool result]')
        }
      }
    }
    return parts.join(' ')
  }
  return ''
}

function truncate(str: string, len: number): string {
  const oneline = str.replace(/\s+/g, ' ').trim()
  return oneline.length > len ? oneline.slice(0, len - 1) + '…' : oneline
}

function isToolResultMessage(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.length > 0 && content.every(
    (b: unknown) => b && typeof b === 'object' && (b as Record<string, unknown>).type === 'tool_result'
  )
}

function parseJsonlFile(filePath: string): RawMessage[] {
  try {
    const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
    return lines.flatMap(line => {
      try { return [JSON.parse(line) as RawMessage] } catch { return [] }
    })
  } catch {
    return []
  }
}

function buildSession(sessionId: string, messages: RawMessage[]): Session | null {
  // Sort by timestamp
  const sorted = messages
    .filter(m => m.timestamp)
    .sort((a, b) => a.timestamp!.localeCompare(b.timestamp!))

  if (sorted.length === 0) return null

  // Get project name from cwd
  const cwdMsg = sorted.find(m => m.cwd)
  const cwd = cwdMsg?.cwd ?? ''
  const project = cwd ? basename(cwd) || cwd : sessionId.slice(0, 8)

  // Detect if session was spawned by a skill (first user message contains <command-message>)
  const firstUserMsg = sorted.find(m => m.type === 'user' && m.userType === 'external' && !m.isSidechain)
  const firstContent = typeof firstUserMsg?.message?.content === 'string'
    ? firstUserMsg.message.content
    : JSON.stringify(firstUserMsg?.message?.content ?? '')
  const skillSpawnMatch = firstContent.match(/<command-message>([^<]+)<\/command-message>/)
  const spawnedBySkill = skillSpawnMatch ? skillSpawnMatch[1].trim() : undefined

  // Group into turns: each external user message starts a new turn
  const turns: Turn[] = []
  let currentUserMsg: RawMessage | null = null
  let pendingAssistants: RawMessage[] = []
  let pendingSystemCmds: string[] = []
  let turnIndex = 0

  const flush = () => {
    if (!currentUserMsg) return

    const assistantsWithUsage = pendingAssistants.filter(
      m => m.message?.usage && m.message.model !== '<synthetic>'
    )

    if (assistantsWithUsage.length === 0 && pendingAssistants.length === 0) {
      currentUserMsg = null
      pendingSystemCmds = []
      return
    }

    let inputTokens = 0
    let outputTokens = 0
    let cacheCreationTokens = 0
    let cacheReadTokens = 0
    let model = ''
    let cost = 0
    const toolSet = new Set<string>()
    const skillSet = new Set<string>()

    for (const a of pendingAssistants) {
      // Collect tool names from assistant content blocks
      if (Array.isArray(a.message?.content)) {
        for (const block of a.message!.content as Record<string, unknown>[]) {
          if (block.type === 'tool_use' && typeof block.name === 'string') {
            if (block.name === 'Skill' && block.input && typeof block.input === 'object') {
              const input = block.input as Record<string, unknown>
              if (typeof input.skill === 'string') skillSet.add(input.skill)
            } else {
              toolSet.add(block.name)
            }
          }
        }
      }
    }

    for (const a of assistantsWithUsage) {
      const u = a.message!.usage!
      inputTokens += u.input_tokens
      outputTokens += u.output_tokens
      cacheCreationTokens += u.cache_creation_input_tokens
      cacheReadTokens += u.cache_read_input_tokens
      if (a.message?.model && a.message.model !== '<synthetic>') {
        model = a.message.model
      }
      cost += calcCost(u, model)
    }

    const fullText = extractText(currentUserMsg.message?.content)

    turnIndex++
    turns.push({
      index: turnIndex,
      timestamp: currentUserMsg.timestamp!,
      userContent: truncate(fullText, 80),
      userContentFull: fullText,
      model,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      apiCallCount: assistantsWithUsage.length,
      cost,
      tools: [...toolSet],
      skills: [...skillSet],
      commands: [...pendingSystemCmds],
    })

    currentUserMsg = null
    pendingAssistants = []
    pendingSystemCmds = []
  }

  for (const msg of sorted) {
    if (msg.type === 'user' && msg.userType === 'external' && !msg.isSidechain) {
      if (isToolResultMessage(msg.message?.content) && currentUserMsg) {
        continue
      }
      flush()
      currentUserMsg = msg
      pendingAssistants = []
      pendingSystemCmds = []
    } else if (msg.type === 'assistant' && currentUserMsg) {
      pendingAssistants.push(msg)
    } else if (msg.type === 'system' && msg.subtype === 'local_command' && currentUserMsg) {
      // Extract slash command name from <command-name>...</command-name>
      const match = (msg.content ?? '').match(/<command-name>([^<]+)<\/command-name>/)
      if (match) pendingSystemCmds.push(match[1].trim())
    }
  }
  flush()

  if (turns.length === 0) return null

  // Dominant model
  const modelCounts: Record<string, number> = {}
  for (const t of turns) {
    if (t.model) modelCounts[t.model] = (modelCounts[t.model] ?? 0) + 1
  }
  const dominantModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

  const totalCost = turns.reduce((s, t) => s + t.cost, 0)
  const totalInput = turns.reduce((s, t) => s + t.inputTokens, 0)
  const totalOutput = turns.reduce((s, t) => s + t.outputTokens, 0)
  const totalCacheCreation = turns.reduce((s, t) => s + t.cacheCreationTokens, 0)
  const totalCacheRead = turns.reduce((s, t) => s + t.cacheReadTokens, 0)

  return {
    id: sessionId,
    project,
    startTime: sorted[0].timestamp!,
    endTime: sorted[sorted.length - 1].timestamp!,
    model: dominantModel,
    turns,
    totalCost,
    totalInput,
    totalOutput,
    totalCacheCreation,
    totalCacheRead,
    spawnedBySkill,
  }
}

export interface LoadOptions {
  since?: Date
  projectFilter?: string
  sessionId?: string
}

export function loadSessions(opts: LoadOptions = {}): Session[] {
  let projectDirs: string[]
  try {
    projectDirs = readdirSync(PROJECTS_DIR)
  } catch {
    console.error(`Cannot read ${PROJECTS_DIR}`)
    return []
  }

  const sessions: Session[] = []

  for (const dir of projectDirs) {
    const dirPath = join(PROJECTS_DIR, dir)
    try {
      if (!statSync(dirPath).isDirectory()) continue
    } catch { continue }

    // Filter by project if requested
    if (opts.projectFilter && !dir.includes(opts.projectFilter)) continue

    let files: string[]
    try {
      files = readdirSync(dirPath).filter(f => f.endsWith('.jsonl'))
    } catch { continue }

    for (const file of files) {
      const sessionId = file.replace('.jsonl', '')

      // Filter by session ID prefix
      if (opts.sessionId && !sessionId.startsWith(opts.sessionId)) continue

      const messages = parseJsonlFile(join(dirPath, file))
      if (messages.length === 0) continue

      // Filter by time
      if (opts.since) {
        const hasRecent = messages.some(m => m.timestamp && new Date(m.timestamp) >= opts.since!)
        if (!hasRecent) continue
      }

      // Group only messages for this session
      const sessionMessages = messages.filter(
        m => !m.sessionId || m.sessionId === sessionId
      )

      const session = buildSession(sessionId, sessionMessages)
      if (session) sessions.push(session)
    }
  }

  return sessions.sort((a, b) => b.startTime.localeCompare(a.startTime))
}

export function parseSince(str: string): Date {
  const now = new Date()
  const match = str.match(/^(\d+)(m|h|d|w)$/)
  if (!match) {
    // Try as date
    return new Date(str)
  }
  const n = parseInt(match[1])
  const unit = match[2]
  const ms = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit]!
  return new Date(now.getTime() - n * ms)
}
