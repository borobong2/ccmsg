import type { RawUsage } from './types.js';
interface ModelPricing {
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
}
export declare function getPricing(model: string): ModelPricing;
export declare function calcCost(usage: RawUsage, model: string): number;
export {};
