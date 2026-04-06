import type { Session, TurnWithContext, SkillStat } from './types.js';
export declare function printSessionsList(sessions: Session[], limit?: number): void;
export declare function printSession(session: Session): void;
export declare function printTopTurns(turns: TurnWithContext[], limit?: number): void;
export declare function printSkills(stats: SkillStat[]): void;
export declare function printJson(data: unknown): void;
