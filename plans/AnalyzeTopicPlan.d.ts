/**
 * Analyze Topic Plan - Atomic Plan
 *
 * Platform-agnostic plan for analyzing conversation topics.
 * Works through any transport (IPC, HTTP, stdio, React Native).
 *
 * Key features:
 * - Analyze conversation sentiment
 * - Extract key topics and keywords
 * - Count messages and participants
 * - Pure business logic, zero platform code
 *
 * Usage:
 * ```typescript
 * const plan = new AnalyzeTopicPlan(nodeOneCore);
 * const result = await plan.analyzeTopic({
 *   topicId: 'topic-123'
 * }, context);
 * ```
 */
import type { PlanContext } from '@refinio/api/types/context';
/**
 * Analyze Topic Request
 */
export interface AnalyzeTopicRequest {
    /** Topic/conversation ID to analyze */
    topicId: string;
    /** Include sentiment analysis (default: true) */
    includeSentiment?: boolean;
    /** Include keyword extraction (default: true) */
    includeKeywords?: boolean;
}
/**
 * Topic Analysis Response
 */
export interface AnalyzeTopicResponse {
    /** Topic ID that was analyzed */
    topicId: string;
    /** Total number of messages */
    messageCount: number;
    /** Number of participants */
    participantCount: number;
    /** Sentiment analysis (if requested) */
    sentiment?: {
        score: number;
        label: 'negative' | 'neutral' | 'positive';
    };
    /** Extracted keywords (if requested) */
    keywords?: string[];
    /** Analysis timestamp */
    analyzedAt: string;
}
/**
 * Analyze Topic Plan
 *
 * Atomic plan for conversation analysis.
 */
export declare class AnalyzeTopicPlan {
    private nodeOneCore;
    constructor(nodeOneCore: any);
    /**
     * Analyze a conversation topic
     */
    analyzeTopic(request: AnalyzeTopicRequest, context: PlanContext): Promise<AnalyzeTopicResponse>;
    /**
     * Simulate async delay (for demonstration)
     */
    private simulateDelay;
}
//# sourceMappingURL=AnalyzeTopicPlan.d.ts.map