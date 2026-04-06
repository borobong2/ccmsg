#!/usr/bin/env node
import { loadSessions, parseSince } from './parser.js'
import { printSessionsList, printSession, printTopTurns, printSkills, printJson } from './display.js'
import type { TurnWithContext, SkillStat } from './types.js'

const HELP = `
ccmsg — per-message Claude Code usage analyzer

Usage:
  ccmsg                        List recent sessions (last 20)
  ccmsg sessions               List recent sessions
  ccmsg show <id>              Show per-message breakdown for a session
  ccmsg today                  Sessions from today
  ccmsg top                    Top turns by cost across all sessions
  ccmsg skills                 Skill usage aggregation across all sessions

Options:
  --all                        Show all sessions / turns (no limit)
  --limit <n>                  Limit results (default: 20)
  --project <name>             Filter by project name
  --since <time>               Filter by time (e.g. 1h, 6h, 1d, 7d)
  --json                       Output as JSON
  --help                       Show this help

Examples:
  ccmsg show 32b87704
  ccmsg today
  ccmsg top --since 7d
  ccmsg top --limit 50
  ccmsg skills --since 30d
  ccmsg --project chat-event-sourcing
`

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  const opts = {
    command: 'sessions' as string,
    sessionId: undefined as string | undefined,
    all: false,
    limit: undefined as number | undefined,
    project: undefined as string | undefined,
    since: undefined as string | undefined,
    json: false,
    help: false,
  }

  let i = 0
  while (i < args.length) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') { opts.help = true }
    else if (arg === '--all') { opts.all = true }
    else if (arg === '--json') { opts.json = true }
    else if (arg === '--project' && args[i + 1]) { opts.project = args[++i] }
    else if (arg === '--since' && args[i + 1]) { opts.since = args[++i] }
    else if (arg === '--limit' && args[i + 1]) { opts.limit = parseInt(args[++i]) }
    else if (arg === 'sessions') { opts.command = 'sessions' }
    else if (arg === 'today') { opts.command = 'today' }
    else if (arg === 'top') { opts.command = 'top' }
    else if (arg === 'skills') { opts.command = 'skills' }
    else if (arg === 'show' && args[i + 1]) { opts.command = 'show'; opts.sessionId = args[++i] }
    else if (!arg.startsWith('-') && opts.command === 'sessions') {
      opts.command = 'show'
      opts.sessionId = arg
    }
    i++
  }

  return opts
}

async function main() {
  const opts = parseArgs(process.argv)

  if (opts.help) {
    console.log(HELP)
    process.exit(0)
  }

  const loadOpts = {
    since: opts.since ? parseSince(opts.since) : opts.command === 'today' ? startOfToday() : undefined,
    projectFilter: opts.project,
    sessionId: opts.command === 'show' ? opts.sessionId : undefined,
  }

  const sessions = loadSessions(loadOpts)
  const limit = opts.all ? undefined : (opts.limit ?? 20)

  if (opts.command === 'show') {
    if (!opts.sessionId) {
      console.error('Usage: ccmsg show <session-id>')
      process.exit(1)
    }
    if (sessions.length === 0) {
      console.error(`No session found matching: ${opts.sessionId}`)
      process.exit(1)
    }
    const session = sessions[0]
    if (opts.json) { printJson(session) } else { printSession(session) }
    return
  }

  if (opts.command === 'top') {
    const allTurns: TurnWithContext[] = sessions.flatMap(s =>
      s.turns.map(t => ({ ...t, sessionId: s.id, project: s.project }))
    )
    const sorted = allTurns.sort((a, b) => b.cost - a.cost)
    if (opts.json) { printJson(limit ? sorted.slice(0, limit) : sorted) }
    else { printTopTurns(sorted, limit) }
    return
  }

  if (opts.command === 'skills') {
    const statsMap = new Map<string, SkillStat>()

    const addToSkill = (name: string, tokens: { i: number, o: number, cc: number, cr: number, cost: number }) => {
      const s = statsMap.get(name) ?? { name, uses: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, cost: 0 }
      s.uses++
      s.inputTokens += tokens.i
      s.outputTokens += tokens.o
      s.cacheCreationTokens += tokens.cc
      s.cacheReadTokens += tokens.cr
      s.cost += tokens.cost
      statsMap.set(name, s)
    }

    for (const session of sessions) {
      // Session-level: spawned by a skill (slash command invocation)
      if (session.spawnedBySkill) {
        addToSkill(session.spawnedBySkill, {
          i: session.totalInput, o: session.totalOutput,
          cc: session.totalCacheCreation, cr: session.totalCacheRead,
          cost: session.totalCost,
        })
        continue  // don't double-count turn-level skills within same session
      }

      // Turn-level: Skill tool_use within a session
      for (const turn of session.turns) {
        for (const skill of turn.skills) {
          addToSkill(skill, {
            i: turn.inputTokens, o: turn.outputTokens,
            cc: turn.cacheCreationTokens, cr: turn.cacheReadTokens,
            cost: turn.cost,
          })
        }
      }
    }
    const stats = [...statsMap.values()].sort((a, b) => b.cost - a.cost)
    if (opts.json) { printJson(stats) } else { printSkills(stats) }
    return
  }

  // sessions / today / default
  if (opts.json) { printJson(sessions); return }
  printSessionsList(sessions, limit)
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
