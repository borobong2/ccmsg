#!/usr/bin/env node
import { loadSessions, parseSince } from './parser.js'
import { printSessionsList, printSession, printJson } from './display.js'

const HELP = `
ccmsg — per-message Claude Code usage analyzer

Usage:
  ccmsg                        List recent sessions (last 20)
  ccmsg sessions               List recent sessions
  ccmsg show <id>              Show per-message breakdown for a session
  ccmsg today                  Sessions from today

Options:
  --all                        Show all sessions (no limit)
  --project <name>             Filter by project name
  --since <time>               Filter by time (e.g. 1h, 6h, 1d, 7d)
  --json                       Output as JSON
  --help                       Show this help

Examples:
  ccmsg show 32b87704
  ccmsg today
  ccmsg --since 2d
  ccmsg --project chat-event-sourcing
`

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  const opts = {
    command: 'sessions' as string,
    sessionId: undefined as string | undefined,
    all: false,
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
    else if (arg === 'sessions') { opts.command = 'sessions' }
    else if (arg === 'today') { opts.command = 'today' }
    else if (arg === 'show' && args[i + 1]) { opts.command = 'show'; opts.sessionId = args[++i] }
    else if (!arg.startsWith('-') && opts.command === 'sessions') {
      // Positional: treat as session ID shorthand
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
    if (opts.json) {
      printJson(session)
    } else {
      printSession(session)
    }
    return
  }

  // sessions / today / default
  if (opts.json) {
    printJson(sessions)
    return
  }

  const limit = opts.all ? undefined : 20
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
