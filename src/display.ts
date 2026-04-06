import chalk from 'chalk'
import type { Session, Turn } from './types.js'

function fmtCost(cost: number): string {
  if (cost === 0) return '$0.000'
  if (cost < 0.001) return `$${cost.toFixed(5)}`
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(3)}`
}

function fmtNum(n: number): string {
  return n.toLocaleString()
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA') // YYYY-MM-DD
}

function modelShort(model: string): string {
  return model
    .replace('claude-', '')
    .replace('-20251001', '')
    .replace('-20240229', '')
}

const LINE = chalk.dim('─'.repeat(72))
const SEP  = chalk.dim('·')

export function printSessionsList(sessions: Session[], limit?: number): void {
  const list = limit ? sessions.slice(0, limit) : sessions

  if (list.length === 0) {
    console.log(chalk.yellow('No sessions found.'))
    return
  }

  const total = sessions.length
  const showing = list.length
  console.log(chalk.bold(`\n  Sessions`) + chalk.dim(` (showing ${showing} of ${total})\n`))

  const header = [
    chalk.dim('  ID      '),
    chalk.dim(padR('Project', 28)),
    chalk.dim(padR('Date', 12)),
    chalk.dim(padL('Turns', 6)),
    chalk.dim(padL('Input', 8)),
    chalk.dim(padL('Output', 8)),
    chalk.dim(padL('Cost', 8)),
  ].join('  ')
  console.log(header)
  console.log(chalk.dim('  ' + '─'.repeat(88)))

  for (const s of list) {
    const row = [
      chalk.cyan(s.id.slice(0, 8)),
      padR(s.project, 28),
      chalk.dim(fmtDate(s.startTime)),
      padL(String(s.turns.length), 6),
      padL(fmtNum(s.totalInput + s.totalCacheRead), 8),
      padL(fmtNum(s.totalOutput), 8),
      chalk.green(padL(fmtCost(s.totalCost), 8)),
    ].join('  ')
    console.log('  ' + row)
  }
  console.log()
}

export function printSession(session: Session): void {
  console.log()
  console.log(
    chalk.bold(`  Session `) + chalk.cyan(session.id.slice(0, 8)) +
    chalk.dim('  ' + SEP + '  ') + chalk.bold(session.project) +
    chalk.dim('  ' + SEP + '  ') + fmtDate(session.startTime) +
    (session.model ? chalk.dim('  ' + SEP + '  ') + chalk.dim(modelShort(session.model)) : '')
  )
  console.log('  ' + LINE)
  console.log()

  for (const turn of session.turns) {
    printTurn(turn)
  }

  console.log('  ' + LINE)

  // Summary row
  const summary = [
    chalk.bold(`  ${session.turns.length} turns`),
    SEP,
    `in ${chalk.blue(fmtNum(session.totalInput))}`,
    `cache+ ${chalk.yellow(fmtNum(session.totalCacheCreation))}`,
    `cache↺ ${chalk.dim(fmtNum(session.totalCacheRead))}`,
    `out ${chalk.magenta(fmtNum(session.totalOutput))}`,
    SEP,
    chalk.green.bold(fmtCost(session.totalCost)),
  ].join(chalk.dim('  '))
  console.log('\n' + summary + '\n')
}

function printTurn(turn: Turn): void {
  const numStr = chalk.dim(padL(`#${turn.index}`, 4))
  const timeStr = chalk.dim(fmtTime(turn.timestamp))
  const content = turn.userContent
    ? chalk.white(`"${turn.userContent}"`)
    : chalk.dim('[no content]')

  console.log(`  ${numStr}  ${timeStr}  ${content}`)

  // Skills line
  if (turn.skills.length > 0 || turn.commands.length > 0) {
    const parts: string[] = []
    if (turn.skills.length > 0) {
      parts.push(turn.skills.map(s => chalk.cyan(`/skill:${s}`)).join(' '))
    }
    if (turn.commands.length > 0) {
      parts.push(turn.commands.map(c => chalk.cyan(c)).join(' '))
    }
    console.log(`         ${chalk.dim('skills')}  ${parts.join('  ')}`)
  }

  // Tools line
  if (turn.tools.length > 0) {
    const toolStr = turn.tools.map(t => chalk.dim(t)).join(chalk.dim(', '))
    console.log(`         ${chalk.dim('tools ')}  ${toolStr}`)
  }

  if (turn.apiCallCount === 0) {
    console.log(chalk.dim(`         (no API calls)`))
  } else {
    const callsStr = turn.apiCallCount > 1
      ? chalk.dim(`${turn.apiCallCount} API calls`)
      : chalk.dim(`1 API call `)

    const tokens = [
      `in ${chalk.blue(fmtNum(turn.inputTokens))}`,
      `cache+ ${chalk.yellow(fmtNum(turn.cacheCreationTokens))}`,
      `cache↺ ${chalk.dim(fmtNum(turn.cacheReadTokens))}`,
      `out ${chalk.magenta(fmtNum(turn.outputTokens))}`,
    ].join(chalk.dim('  '))

    const costStr = chalk.green(fmtCost(turn.cost))

    console.log(`         ${callsStr}  ${chalk.dim('·')}  ${tokens}  ${chalk.dim('·')}  ${costStr}`)
  }
  console.log()
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

function padR(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

function padL(str: string, len: number): string {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str
}
