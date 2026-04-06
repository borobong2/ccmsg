import type { Session } from './types.js';
export interface LoadOptions {
    since?: Date;
    projectFilter?: string;
    sessionId?: string;
}
export declare function loadSessions(opts?: LoadOptions): Session[];
export declare function parseSince(str: string): Date;
