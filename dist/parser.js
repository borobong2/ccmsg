import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { calcCost } from './pricing.js';
const PROJECTS_DIR = join(homedir(), '.claude', 'projects');
function extractText(content) {
    if (typeof content === 'string')
        return content;
    if (Array.isArray(content)) {
        const parts = [];
        for (const block of content) {
            if (block && typeof block === 'object') {
                const b = block;
                if (b.type === 'text' && typeof b.text === 'string') {
                    parts.push(b.text);
                }
                else if (b.type === 'tool_use' && typeof b.name === 'string') {
                    parts.push(`[tool: ${b.name}]`);
                }
                else if (b.type === 'tool_result') {
                    parts.push('[tool result]');
                }
            }
        }
        return parts.join(' ');
    }
    return '';
}
function truncate(str, len) {
    const oneline = str.replace(/\s+/g, ' ').trim();
    return oneline.length > len ? oneline.slice(0, len - 1) + '…' : oneline;
}
function isToolResultMessage(content) {
    if (!Array.isArray(content))
        return false;
    return content.length > 0 && content.every((b) => b && typeof b === 'object' && b.type === 'tool_result');
}
function parseJsonlFile(filePath) {
    try {
        const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
        return lines.flatMap(line => {
            try {
                return [JSON.parse(line)];
            }
            catch {
                return [];
            }
        });
    }
    catch {
        return [];
    }
}
function buildSession(sessionId, messages) {
    // Sort by timestamp
    const sorted = messages
        .filter(m => m.timestamp)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (sorted.length === 0)
        return null;
    // Get project name from cwd
    const cwdMsg = sorted.find(m => m.cwd);
    const cwd = cwdMsg?.cwd ?? '';
    const project = cwd ? basename(cwd) || cwd : sessionId.slice(0, 8);
    // Group into turns: each external user message starts a new turn
    const turns = [];
    let currentUserMsg = null;
    let pendingAssistants = [];
    let turnIndex = 0;
    const flush = () => {
        if (!currentUserMsg)
            return;
        const assistantsWithUsage = pendingAssistants.filter(m => m.message?.usage && m.message.model !== '<synthetic>');
        if (assistantsWithUsage.length === 0 && pendingAssistants.length === 0) {
            // Empty turn, skip
            currentUserMsg = null;
            return;
        }
        let inputTokens = 0;
        let outputTokens = 0;
        let cacheCreationTokens = 0;
        let cacheReadTokens = 0;
        let model = '';
        let cost = 0;
        for (const a of assistantsWithUsage) {
            const u = a.message.usage;
            inputTokens += u.input_tokens;
            outputTokens += u.output_tokens;
            cacheCreationTokens += u.cache_creation_input_tokens;
            cacheReadTokens += u.cache_read_input_tokens;
            if (a.message?.model && a.message.model !== '<synthetic>') {
                model = a.message.model;
            }
            cost += calcCost(u, model);
        }
        turnIndex++;
        turns.push({
            index: turnIndex,
            timestamp: currentUserMsg.timestamp,
            userContent: truncate(extractText(currentUserMsg.message?.content), 60),
            model,
            inputTokens,
            outputTokens,
            cacheCreationTokens,
            cacheReadTokens,
            apiCallCount: assistantsWithUsage.length,
            cost,
        });
        currentUserMsg = null;
        pendingAssistants = [];
    };
    for (const msg of sorted) {
        if (msg.type === 'user' && msg.userType === 'external' && !msg.isSidechain) {
            // Tool result messages continue the current turn instead of starting a new one
            if (isToolResultMessage(msg.message?.content) && currentUserMsg) {
                continue;
            }
            flush();
            currentUserMsg = msg;
            pendingAssistants = [];
        }
        else if (msg.type === 'assistant' && currentUserMsg) {
            pendingAssistants.push(msg);
        }
    }
    flush();
    if (turns.length === 0)
        return null;
    // Dominant model
    const modelCounts = {};
    for (const t of turns) {
        if (t.model)
            modelCounts[t.model] = (modelCounts[t.model] ?? 0) + 1;
    }
    const dominantModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const totalCost = turns.reduce((s, t) => s + t.cost, 0);
    const totalInput = turns.reduce((s, t) => s + t.inputTokens, 0);
    const totalOutput = turns.reduce((s, t) => s + t.outputTokens, 0);
    const totalCacheCreation = turns.reduce((s, t) => s + t.cacheCreationTokens, 0);
    const totalCacheRead = turns.reduce((s, t) => s + t.cacheReadTokens, 0);
    return {
        id: sessionId,
        project,
        startTime: sorted[0].timestamp,
        endTime: sorted[sorted.length - 1].timestamp,
        model: dominantModel,
        turns,
        totalCost,
        totalInput,
        totalOutput,
        totalCacheCreation,
        totalCacheRead,
    };
}
export function loadSessions(opts = {}) {
    let projectDirs;
    try {
        projectDirs = readdirSync(PROJECTS_DIR);
    }
    catch {
        console.error(`Cannot read ${PROJECTS_DIR}`);
        return [];
    }
    const sessions = [];
    for (const dir of projectDirs) {
        const dirPath = join(PROJECTS_DIR, dir);
        try {
            if (!statSync(dirPath).isDirectory())
                continue;
        }
        catch {
            continue;
        }
        // Filter by project if requested
        if (opts.projectFilter && !dir.includes(opts.projectFilter))
            continue;
        let files;
        try {
            files = readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
        }
        catch {
            continue;
        }
        for (const file of files) {
            const sessionId = file.replace('.jsonl', '');
            // Filter by session ID prefix
            if (opts.sessionId && !sessionId.startsWith(opts.sessionId))
                continue;
            const messages = parseJsonlFile(join(dirPath, file));
            if (messages.length === 0)
                continue;
            // Filter by time
            if (opts.since) {
                const hasRecent = messages.some(m => m.timestamp && new Date(m.timestamp) >= opts.since);
                if (!hasRecent)
                    continue;
            }
            // Group only messages for this session
            const sessionMessages = messages.filter(m => !m.sessionId || m.sessionId === sessionId);
            const session = buildSession(sessionId, sessionMessages);
            if (session)
                sessions.push(session);
        }
    }
    return sessions.sort((a, b) => b.startTime.localeCompare(a.startTime));
}
export function parseSince(str) {
    const now = new Date();
    const match = str.match(/^(\d+)(m|h|d|w)$/);
    if (!match) {
        // Try as date
        return new Date(str);
    }
    const n = parseInt(match[1]);
    const unit = match[2];
    const ms = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit];
    return new Date(now.getTime() - n * ms);
}
